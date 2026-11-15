/**
 * Vercel Serverless Function : /api/telegram-notify
 * 
 * Envoie de façon hautement sécurisée les notifications Telegram sans JAMAIS
 * exposer le Bot Token côté client/navigateur.
 */

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatOrderHtml(order: any): string {
  const dateFormatted = order.createdAt
    ? new Date(order.createdAt).toLocaleString('fr-FR', {
        timeZone: 'Africa/Algiers',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Algiers' });

  const deliveryTypeLabel = order.deliveryType === 'desk'
    ? 'Bureau / Stop Desk (Agence)'
    : 'À Domicile';

  const fullAddress = [
    order.address,
    order.commune,
    order.wilayaName,
    `(${deliveryTypeLabel})`,
  ].filter(Boolean).join(', ');

  let itemsHtml = '';
  let totalQuantity = 0;

  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    itemsHtml = order.items
      .map((it: any) => {
        const qty = Number(it.quantity) || 1;
        totalQuantity += qty;
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
  } else {
    const qty = Number(order.quantity) || 1;
    totalQuantity = qty;
    const unitPrice = Number(order.unitPrice) || 0;
    const lineTotal = (unitPrice * qty).toLocaleString('fr-FR');
    const variantDesc = [order.selectedColor, order.selectedSize].filter(Boolean).join(' • ');
    itemsHtml =
      `• <b>${escapeHtml(order.productTitle || 'Produit')}</b>` +
      (variantDesc ? ` (<i>${escapeHtml(variantDesc)}</i>)` : '') +
      `\n  ▫️ Quantité : ${qty} × ${unitPrice.toLocaleString('fr-FR')} DA = <b>${lineTotal} DA</b>`;
  }

  // Nettoyage de la note client si balise interne présente
  let cleanNotes = '';
  if (order.notes) {
    const parts = String(order.notes).split('__MC_ITEMS_DATA__:');
    cleanNotes = parts[0].trim();
  }

  // Formatage du lien WhatsApp Algérie
  const rawPhone = String(order.customerPhone || '').replace(/\D/g, '');
  let intlPhone = rawPhone;
  if (rawPhone.startsWith('0')) {
    intlPhone = '213' + rawPhone.substring(1);
  } else if (!rawPhone.startsWith('213') && rawPhone.length > 0) {
    intlPhone = '213' + rawPhone;
  }
  const waUrl = `https://wa.me/${intlPhone}`;

  return (
    `🛒 <b>NOUVELLE COMMANDE – MAISON CÉLESTE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📦 <b>Numéro de commande :</b> <code>${escapeHtml(order.orderNumber || order.id)}</code>\n` +
    `📅 <b>Date et heure :</b> ${dateFormatted}\n\n` +
    `👤 <b>Nom du client :</b> ${escapeHtml(order.customerName)}\n` +
    `📞 <b>Numéro de téléphone :</b> ${escapeHtml(order.customerPhone)}\n` +
    `📍 <b>Adresse de livraison :</b> ${escapeHtml(fullAddress)}\n` +
    (cleanNotes ? `📝 <b>Note client :</b> <i>« ${escapeHtml(cleanNotes)} »</i>\n` : '') +
    `\n` +
    `💎 <b>Produits commandés :</b>\n` +
    `${itemsHtml}\n\n` +
    `📊 <b>Quantité totale :</b> ${totalQuantity} article${totalQuantity > 1 ? 's' : ''}\n` +
    `💰 <b>Total de la commande :</b> <b>${Number(order.grandTotal).toLocaleString('fr-FR')} DA</b>` +
    (order.shippingFee ? ` <i>(dont ${Number(order.shippingFee).toLocaleString('fr-FR')} DA livraison)</i>` : '') +
    `\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (intlPhone ? `📲 <a href="${waUrl}">Contacter le client sur WhatsApp</a>\n\n` : '') +
    `🌸 <i>Maison Céleste Algérie — Notification Automatique</i>`
  );
}

async function sendTelegram(token: string, chatId: string | number, text: string, parseMode = 'HTML') {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload: any = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  // Tolérance aux pannes : repli automatique en texte brut si parsing HTML rejeté
  if (!data.ok && parseMode && data.description && data.description.includes("can't parse")) {
    const rawText = text.replace(/<[^>]+>/g, '');
    const retryRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: rawText,
        disable_web_page_preview: true,
      }),
    });
    return await retryRes.json();
  }

  return data;
}

export default async function handler(req: any, res: any) {
  // En-têtes CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée (POST requis)' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || '9023085999:AAGBO6w0C0jb7w4oiy2j6wqwk782J34mACs';
  const defaultChatId = process.env.TELEGRAM_CHAT_ID || '-1004337566144';

  if (!token) {
    console.error('[telegram-notify] TELEGRAM_BOT_TOKEN manquant dans les variables d\'environnement');
    return res.status(500).json({
      success: false,
      error: 'TELEGRAM_BOT_TOKEN non configuré sur le serveur.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    let targetChatId = body.chatId || defaultChatId;
    // Si l'ancien Chat ID privé est transmis par un client avec un cache/localStorage antérieur, forcer la redirection vers le groupe Siteweb
    if (String(targetChatId).trim() === '682438619') {
      targetChatId = defaultChatId;
    }
    const action = body.action || 'order';

    // 1. ACTION DE TEST
    if (action === 'test') {
      const testHtml =
        `🔔 <b>TEST NOTIFICATION TELEGRAM — MAISON CÉLESTE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>La connexion avec le groupe Siteweb fonctionne parfaitement !</b>\n\n` +
        `Désormais, chaque nouvelle commande passée sur Maison Céleste sera instantanément publiée ici avec tous ses détails.\n\n` +
        `🌸 <i>Système Opérationnel — Maison Céleste Algérie</i>`;

      const result = await sendTelegram(token, targetChatId, testHtml, 'HTML');
      if (!result.ok) {
        return res.status(400).json({ success: false, error: result.description || 'Erreur Telegram' });
      }
      return res.status(200).json({ success: true, message: 'Message de test envoyé avec succès !' });
    }

    // 2. RÉCUPÉRATION DES CHATS / UPDATES (POUR DÉTECTION SÉCURISÉE)
    if (action === 'get-updates') {
      const updatesRes = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?allowed_updates=["message","my_chat_member","chat_member"]`
      );
      const updatesData = await updatesRes.json();
      if (!updatesData.ok || !Array.isArray(updatesData.result)) {
        return res.status(200).json({ success: true, chats: [] });
      }

      const chatsMap = new Map<string, { id: number | string; name: string; username?: string; type: string }>();

      for (const update of updatesData.result) {
        const msg = update.message || update.channel_post || update.my_chat_member;
        if (msg && msg.chat) {
          const chat = msg.chat;
          const chatKey = String(chat.id);
          const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || 'Utilisateur';
          chatsMap.set(chatKey, {
            id: chat.id,
            name,
            username: chat.username,
            type: chat.type,
          });
        }
      }

      // Placer les groupes et supergroupes en premier
      const chats = Array.from(chatsMap.values()).sort((a, b) => {
        const isGroupA = a.type === 'supergroup' || a.type === 'group';
        const isGroupB = b.type === 'supergroup' || b.type === 'group';
        if (isGroupA && !isGroupB) return -1;
        if (!isGroupA && isGroupB) return 1;
        return 0;
      });

      return res.status(200).json({ success: true, chats });
    }

    // 3. ACTION NOTIFICATION DE NOUVELLE COMMANDE
    const order = body.order;
    if (!order) {
      return res.status(400).json({ success: false, error: 'Données de commande (order) manquantes.' });
    }

    const messageHtml = formatOrderHtml(order);
    const result = await sendTelegram(token, targetChatId, messageHtml, 'HTML');

    if (!result.ok) {
      console.error('[telegram-notify] Erreur retournée par Telegram:', result.description);
      return res.status(400).json({ success: false, error: result.description || 'Erreur Telegram' });
    }

    return res.status(200).json({ success: true, messageId: result.result?.message_id });
  } catch (error: any) {
    console.error('[telegram-notify] Exception:', error.message);
    return res.status(500).json({ success: false, error: 'Erreur interne lors de la notification.' });
  }
}
