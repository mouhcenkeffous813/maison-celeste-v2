// ==============================================================================
// SUPABASE EDGE FUNCTION : CREATE-ORDER
// ==============================================================================
// Validation stricte des commandes Cash on Delivery (Algérie),
// recalcul des prix et frais de port côté serveur, décrémentation atomique
// des stocks et notification instantanée via Bot Telegram commerçant.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Gestion pré-vol CORS (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    const {
      customerName,
      customerPhone,
      wilayaId,
      wilayaName,
      commune,
      address,
      deliveryType = 'home',
      productId,
      selectedColor,
      selectedSize,
      quantity = 1,
      items,
      notes,
    } = payload;

    // 1. VALIDATION DES CHAMPS OBLIGATOIRES
    if (!customerName || !customerPhone || !wilayaId || !commune || !address) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Champs obligatoires manquants (nom, téléphone, wilaya, commune, adresse).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. VALIDATION STRICTE DU FORMAT TÉLÉPHONE ALGÉRIEN (05/06/07 + 8 chiffres)
    const cleanPhoneDigits = customerPhone.replace(/\D/g, '');
    let normalizedPhone = cleanPhoneDigits;
    if (cleanPhoneDigits.startsWith('213') && cleanPhoneDigits.length === 12) {
      normalizedPhone = '0' + cleanPhoneDigits.substring(3);
    }

    const algerianPhoneRegex = /^(05|06|07)[0-9]{8}$/;
    if (!algerianPhoneRegex.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Numéro de téléphone algérien invalide. Format attendu : 05XX, 06XX ou 07XX (10 chiffres).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. INITIALISATION DU CLIENT SUPABASE AVEC SERVICE_ROLE_KEY
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. RÉCUPÉRATION DES TARIFS DE LA WILAYA DEPUIS POSTGRESQL
    let calculatedShippingFee = deliveryType === 'desk' ? 350 : 600;
    const { data: wilayaData } = await supabase
      .from('wilayas')
      .select('home_delivery_price, stop_desk_price')
      .eq('id', Number(wilayaId))
      .maybeSingle();

    if (wilayaData) {
      calculatedShippingFee = deliveryType === 'desk'
        ? Number(wilayaData.stop_desk_price)
        : Number(wilayaData.home_delivery_price);
    }

    // 5. RECALCUL SÉCURISÉ DU MONTANT DU PANIER CÔTÉ SERVEUR (BASE PRODUCTS)
    const orderItems = (items && Array.isArray(items) && items.length > 0)
      ? items
      : [{
          productId: productId || 'prod-001',
          selectedColor: selectedColor || '',
          selectedSize: selectedSize || '',
          quantity: Number(quantity) || 1,
        }];

    let serverProductTotal = 0;
    let mainProductTitle = '';
    let mainProductImage = '';
    const itemsWithServerPrices: any[] = [];

    for (const item of orderItems) {
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('title, price, images, product_variants(*)')
        .eq('id', item.productId)
        .single();

      if (prodErr || !prodData) {
        throw new Error(`Produit ${item.productId} introuvable en base.`);
      }

      const realUnitPrice = Number(prodData.price);
      const itemQty = Number(item.quantity) || 1;
      const itemTotal = realUnitPrice * itemQty;
      serverProductTotal += itemTotal;

      if (!mainProductTitle) {
        mainProductTitle = prodData.title;
        mainProductImage = Array.isArray(prodData.images) && prodData.images[0] ? prodData.images[0] : '';
      }

      // Identifier la variante pour décrémenter le stock
      const variants = prodData.product_variants || [];
      const matchedVariant = variants.find(
        (v: any) => v.color_name === item.selectedColor && v.size === item.selectedSize
      ) || variants[0];

      itemsWithServerPrices.push({
        productId: item.productId,
        variantId: matchedVariant?.id || null,
        productTitle: prodData.title,
        productImage: mainProductImage,
        selectedColor: item.selectedColor || (matchedVariant?.color_name ?? ''),
        selectedSize: item.selectedSize || (matchedVariant?.size ?? ''),
        quantity: itemQty,
        unitPrice: realUnitPrice,
        totalPrice: itemTotal,
      });

      // 6. DÉCRÉMENTATION TRANSACTIONNELLE DU STOCK VIA RPC
      if (matchedVariant?.id) {
        const { error: rpcErr } = await supabase.rpc('decrease_product_stock', {
          p_product_id: item.productId,
          p_variant_id: matchedVariant.id,
          p_quantity: itemQty,
        });

        if (rpcErr) {
          console.warn('[RPC Stock] Avertissement décrémentation stock:', rpcErr.message);
        }
      }
    }

    // Vérification du seuil de livraison gratuite
    const { data: storeCfg } = await supabase
      .from('store_config')
      .select('free_shipping_threshold, free_shipping_enabled')
      .eq('id', 'current')
      .maybeSingle();

    if (
      storeCfg?.free_shipping_enabled &&
      storeCfg.free_shipping_threshold > 0 &&
      serverProductTotal >= Number(storeCfg.free_shipping_threshold)
    ) {
      calculatedShippingFee = 0;
    }

    const serverGrandTotal = serverProductTotal + calculatedShippingFee;

    // 7. GÉNÉRATION DE L'IDENTIFIANT UNIQUE ET DU N° DE COMMANDE
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orderNumber = `CMD-DZ-${randomSuffix}`;

    // Sérialisation des articles multiples dans les notes pour rétrocompatibilité
    const ITEMS_DELIMITER = '\n\n__MC_ITEMS_DATA__:';
    let combinedNotes = notes || null;
    if (itemsWithServerPrices.length > 0) {
      const cleanRawNotes = notes ? notes.split(ITEMS_DELIMITER)[0] : '';
      combinedNotes = (cleanRawNotes ? cleanRawNotes + ITEMS_DELIMITER : ITEMS_DELIMITER) + JSON.stringify(itemsWithServerPrices);
    }

    const orderRow = {
      id: uniqueId,
      order_number: orderNumber,
      customer_name: customerName.trim(),
      customer_phone: normalizedPhone,
      wilaya_id: Number(wilayaId),
      wilaya_name: wilayaName,
      commune: commune.trim(),
      address: address.trim(),
      delivery_type: deliveryType,
      product_id: itemsWithServerPrices[0].productId,
      product_title: itemsWithServerPrices.length === 1 ? mainProductTitle : `Panier Multi-articles (${itemsWithServerPrices.length})`,
      product_image: mainProductImage,
      selected_color: itemsWithServerPrices[0].selectedColor,
      selected_size: itemsWithServerPrices[0].selectedSize,
      quantity: itemsWithServerPrices.reduce((sum, i) => sum + i.quantity, 0),
      unit_price: itemsWithServerPrices[0].unitPrice,
      product_total: serverProductTotal,
      shipping_fee: calculatedShippingFee,
      grand_total: serverGrandTotal,
      status: 'pending',
      notes: combinedNotes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 8. INSERTION SÉCURISÉE DANS LA TABLE ORDERS
    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert([orderRow])
      .select()
      .single();

    if (insertError) {
      console.error('[Database] Erreur insertion commande:', insertError);
      throw insertError;
    }

    // 9. NOTIFICATION TELEGRAM INSTANTANÉE AU COMMERÇANT (GROUPE SITEWEB)
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    let telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID') || '-1004337566144';
    if (telegramChatId === '682438619') {
      telegramChatId = '-1004337566144';
    }
    let telegramSent = false;

    if (telegramBotToken && telegramChatId) {
      try {
        const escapeHtml = (str: string) => {
          if (!str) return '';
          return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        };

        const dateFormatted = new Date().toLocaleString('fr-FR', {
          timeZone: 'Africa/Algiers',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const deliveryTypeLabel = deliveryType === 'desk'
          ? 'Bureau / Stop Desk (Agence)'
          : 'À Domicile';

        const fullAddress = [
          address,
          commune,
          wilayaName,
          `(${deliveryTypeLabel})`,
        ].filter(Boolean).join(', ');

        let totalQty = 0;
        const itemsHtml = itemsWithServerPrices
          .map((it: any) => {
            const qty = Number(it.quantity) || 1;
            totalQty += qty;
            const unitPrice = Number(it.unitPrice) || 0;
            const lineTotal = (unitPrice * qty).toLocaleString('fr-FR');
            const variantDesc = [it.selectedColor, it.selectedSize].filter(Boolean).join(' • ');
            return (
              `• <b>${escapeHtml(it.productTitle)}</b>` +
              (variantDesc ? ` (<i>${escapeHtml(variantDesc)}</i>)` : '') +
              `\n  ▫️ Quantité : ${qty} × ${unitPrice.toLocaleString('fr-FR')} DA = <b>${lineTotal} DA</b>`
            );
          })
          .join('\n\n');

        let cleanNotes = '';
        if (notes) {
          cleanNotes = String(notes).split('__MC_ITEMS_DATA__:')[0].trim();
        }

        let intlPhone = cleanPhoneDigits;
        if (cleanPhoneDigits.startsWith('0')) {
          intlPhone = '213' + cleanPhoneDigits.substring(1);
        } else if (!cleanPhoneDigits.startsWith('213') && cleanPhoneDigits.length > 0) {
          intlPhone = '213' + cleanPhoneDigits;
        }
        const waUrl = `https://wa.me/${intlPhone}`;

        const telegramMessageHtml =
          `🛒 <b>NOUVELLE COMMANDE – MAISON CÉLESTE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📦 <b>Numéro de commande :</b> <code>${escapeHtml(orderNumber)}</code>\n` +
          `📅 <b>Date et heure :</b> ${dateFormatted}\n\n` +
          `👤 <b>Nom du client :</b> ${escapeHtml(customerName)}\n` +
          `📞 <b>Numéro de téléphone :</b> ${escapeHtml(normalizedPhone)}\n` +
          `📍 <b>Adresse de livraison :</b> ${escapeHtml(fullAddress)}\n` +
          (cleanNotes ? `📝 <b>Note client :</b> <i>« ${escapeHtml(cleanNotes)} »</i>\n` : '') +
          `\n` +
          `💎 <b>Produits commandés :</b>\n` +
          `${itemsHtml}\n\n` +
          `📊 <b>Quantité totale :</b> ${totalQty} article${totalQty > 1 ? 's' : ''}\n` +
          `💰 <b>Total de la commande :</b> <b>${serverGrandTotal.toLocaleString('fr-FR')} DA</b>` +
          (calculatedShippingFee ? ` <i>(dont ${calculatedShippingFee.toLocaleString('fr-FR')} DA livraison)</i>` : '') +
          `\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          (intlPhone ? `📲 <a href="${waUrl}">Contacter le client sur WhatsApp</a>\n\n` : '') +
          `🌸 <i>Maison Céleste Algérie — Notification Automatique</i>`;

        const tgRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: telegramMessageHtml,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });

        const tgData = await tgRes.json();
        if (!tgData.ok && tgData.description && tgData.description.includes("can't parse")) {
          // Re-tentative de secours en texte brut en cas d'erreur de balisage
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: telegramMessageHtml.replace(/<[^>]+>/g, ''),
              disable_web_page_preview: true,
            }),
          });
        }
        telegramSent = true;
      } catch (tgErr) {
        console.warn('[Telegram] Impossible d\'envoyer la notification Telegram:', tgErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        telegramSent,
        order: {
          id: insertedOrder.id,
          orderNumber: insertedOrder.order_number,
          customerName: insertedOrder.customer_name,
          customerPhone: insertedOrder.customer_phone,
          wilayaId: insertedOrder.wilaya_id,
          wilayaName: insertedOrder.wilaya_name,
          commune: insertedOrder.commune,
          address: insertedOrder.address,
          deliveryType: insertedOrder.delivery_type,
          productId: insertedOrder.product_id,
          productTitle: insertedOrder.product_title,
          productImage: insertedOrder.product_image,
          selectedColor: insertedOrder.selected_color,
          selectedSize: insertedOrder.selected_size,
          quantity: insertedOrder.quantity,
          unitPrice: insertedOrder.unit_price,
          productTotal: insertedOrder.product_total,
          shippingFee: insertedOrder.shipping_fee,
          grandTotal: insertedOrder.grand_total,
          status: insertedOrder.status,
          items: itemsWithServerPrices,
          notes: notes,
          createdAt: insertedOrder.created_at,
          updatedAt: insertedOrder.updated_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[create-order] Exception non gérée:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur interne du serveur lors de la validation de la commande.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
