import { Order } from '../types';

// Identifiant unique du Groupe Telegram "Siteweb" (Maison Céleste)
export const DEFAULT_TELEGRAM_CHAT_ID = '-1004337566144';

const STORAGE_KEYS = {
  BOT_TOKEN: 'celeste_telegram_bot_token',
  CHAT_ID: 'celeste_telegram_chat_id',
  ENABLED: 'celeste_telegram_enabled',
};

// Registre anti-doublon en mémoire de session
const processedOrders = new Set<string>();

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const telegramService = {
  /**
   * Récupère le Token du Bot si stocké localement ou en variable d'environnement
   * (Pour le backend/serverless, le token est géré en variable d'environnement serveur)
   */
  getBotToken(): string {
    const metaEnv = (import.meta as any).env || {};
    return (
      localStorage.getItem(STORAGE_KEYS.BOT_TOKEN) ||
      metaEnv.VITE_TELEGRAM_BOT_TOKEN ||
      ''
    );
  },

  /**
   * Récupère le Chat ID configuré (Groupe Siteweb par défaut)
   */
  getChatId(): string {
    const metaEnv = (import.meta as any).env || {};
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CHAT_ID) : null;
    
    // Auto-migration immédiate : si l'ancien chat ID privé (682438619) est encore en cache dans localStorage
    if (stored === '682438619') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.CHAT_ID, DEFAULT_TELEGRAM_CHAT_ID);
      }
      return DEFAULT_TELEGRAM_CHAT_ID;
    }

    return (
      stored ||
      metaEnv.VITE_TELEGRAM_CHAT_ID ||
      DEFAULT_TELEGRAM_CHAT_ID
    );
  },

  /**
   * Vérifie si les notifications sont configurées et actives
   */
  isConfigured(): boolean {
    const chatId = this.getChatId();
    return Boolean(chatId && chatId.trim().length > 0);
  },

  /**
   * Enregistre les paramètres Telegram dans le stockage local
   */
  saveConfig(botToken: string, chatId: string, enabled = true) {
    if (botToken) localStorage.setItem(STORAGE_KEYS.BOT_TOKEN, botToken.trim());
    if (chatId) localStorage.setItem(STORAGE_KEYS.CHAT_ID, chatId.trim());
    localStorage.setItem(STORAGE_KEYS.ENABLED, String(enabled));
  },

  /**
   * Génère le lien WhatsApp Algérie pour le commerçant
   */
  formatWhatsAppUrl(phone: string, orderNumber: string, customerName: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    let intlPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      intlPhone = '213' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('213') && cleanPhone.length > 0) {
      intlPhone = '213' + cleanPhone;
    }
    const msg = encodeURIComponent(
      `Bonjour ${customerName}, c'est Maison Céleste concernant votre commande N° ${orderNumber}. Pouvez-vous nous confirmer votre disponibilité pour la livraison ?`
    );
    return `https://wa.me/${intlPhone}?text=${msg}`;
  },

  /**
   * Formate le message de nouvelle commande conforme aux spécifications
   */
  formatOrderMessage(order: Order): string {
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

    const deliveryLabel =
      order.deliveryType === 'desk'
        ? 'Bureau / Stop Desk (Agence ZR / Yalidine)'
        : 'À Domicile (Adresse personnelle)';

    const fullAddress = [
      order.address,
      order.commune,
      order.wilayaName,
      `(${deliveryLabel})`,
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
        `• <b>${escapeHtml(order.productTitle || 'Bijou Signature')}</b>` +
        (variantDesc ? ` (<i>${escapeHtml(variantDesc)}</i>)` : '') +
        `\n  ▫️ Quantité : ${qty} × ${unitPrice.toLocaleString('fr-FR')} DA = <b>${lineTotal} DA</b>`;
    }

    let cleanNotes = '';
    if (order.notes) {
      cleanNotes = String(order.notes).split('__MC_ITEMS_DATA__:')[0].trim();
    }

    const waLink = this.formatWhatsAppUrl(order.customerPhone, order.orderNumber, order.customerName);

    return (
      `🛒 <b>NOUVELLE COMMANDE – MAISON CÉLESTE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📦 <b>Numéro de commande :</b> <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `📅 <b>Date et heure :</b> ${dateFormatted}\n\n` +
      `👤 <b>Nom du client :</b> ${escapeHtml(order.customerName)}\n` +
      `📞 <b>Numéro de téléphone :</b> ${escapeHtml(order.customerPhone)}\n` +
      `📍 <b>Adresse de livraison :</b> ${escapeHtml(fullAddress)}\n` +
      (cleanNotes ? `📝 <b>Note client :</b> <i>« ${escapeHtml(cleanNotes)} »</i>\n` : '') +
      `\n` +
      `💎 <b>Produits commandés :</b>\n` +
      `${itemsHtml}\n\n` +
      `📊 <b>Quantité totale :</b> ${totalQuantity} article${totalQuantity > 1 ? 's' : ''}\n` +
      `💰 <b>Total de la commande :</b> <b>${order.grandTotal.toLocaleString('fr-FR')} DA</b>` +
      (order.shippingFee ? ` <i>(dont ${order.shippingFee.toLocaleString('fr-FR')} DA livraison)</i>` : '') +
      `\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📲 <a href="${waLink}">Contacter le client sur WhatsApp</a>\n\n` +
      `🌸 <i>Maison Céleste Algérie — Notification Directe Groupe Siteweb</i>`
    );
  },

  /**
   * Envoie la notification de nouvelle commande sur Telegram (Groupe Siteweb)
   * avec garantie anti-doublon et repli sécurisé
   */
  async sendNewOrderNotification(order: Order): Promise<boolean> {
    const orderKey = order.orderNumber || order.id;
    if (processedOrders.has(orderKey)) {
      console.log('[Telegram] Notification ignorée (déjà traitée pour cette commande):', orderKey);
      return true;
    }

    const chatId = this.getChatId();
    if (!chatId || chatId.trim().length === 0) {
      console.warn('[Telegram] Notifications désactivées ou Chat ID non configuré.');
      return false;
    }

    // 1. TENTATIVE SÉCURISÉE VIA LA FONCTION SERVERLESS BACKEND (/api/telegram-notify)
    try {
      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order,
          chatId: chatId.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          processedOrders.add(orderKey);
          console.log('[Telegram] Notification envoyée avec succès via /api/telegram-notify pour:', orderKey);
          return true;
        }
      }
    } catch {
      // Le backend serverless n'est pas accessible, bascule sur la méthode directe si token disponible
    }

    // 2. REPLI DIRECT EN CAS DE DÉVELOPPEMENT LOCAL OU TOKEN DIRECT
    const token = this.getBotToken();
    if (!token) {
      console.warn('[Telegram] Aucun token Telegram disponible pour le repli direct.');
      return false;
    }

    try {
      const messageHtml = this.formatOrderMessage(order);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: messageHtml,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        // Repli en texte brut en cas d'erreur de balises
        if (data.description && data.description.includes("can't parse")) {
          const rawText = messageHtml.replace(/<[^>]+>/g, '');
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId.trim(),
              text: rawText,
              disable_web_page_preview: true,
            }),
          });
          const retryData = await retryRes.json();
          if (retryData.ok) {
            processedOrders.add(orderKey);
            return true;
          }
        }
        console.error('[Telegram] Erreur Telegram lors de l\'envoi:', data.description || 'Erreur inconnue');
        return false;
      }

      processedOrders.add(orderKey);
      console.log('[Telegram] Notification directe envoyée avec succès pour:', orderKey);
      return true;
    } catch (err: any) {
      console.error('[Telegram] Erreur réseau lors de l\'envoi direct:', err.message || err);
      return false;
    }
  },

  /**
   * Envoie une notification de test pour vérifier la connexion avec le groupe
   */
  async sendTestNotification(
    customToken?: string,
    customChatId?: string
  ): Promise<{ success: boolean; message: string }> {
    const chatId = (customChatId || this.getChatId()).trim();
    if (!chatId) {
      return { success: false, message: 'Chat ID manquant. Indiquez l\'identifiant du groupe Siteweb (-1004337566144).' };
    }

    // 1. Tenter via /api/telegram-notify
    try {
      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          chatId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return { success: true, message: 'Notification de test reçue dans le groupe Siteweb !' };
        }
      }
    } catch {
      // Repli direct
    }

    // 2. Repli direct avec le token
    const token = (customToken || this.getBotToken()).trim();
    if (!token) {
      return { success: false, message: 'Token manquant et backend indisponible pour le test direct.' };
    }

    try {
      const testHtml =
        `🔔 <b>TEST NOTIFICATION TELEGRAM — MAISON CÉLESTE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ <b>La connexion avec le groupe Siteweb fonctionne parfaitement !</b>\n\n` +
        `Désormais, chaque nouvelle commande passée sur votre site sera instantanément notifiée ici avec tous les détails.\n\n` +
        `🌸 <i>Système Opérationnel — Maison Céleste Algérie</i>`;

      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: testHtml,
          parse_mode: 'HTML',
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        return {
          success: false,
          message: data.description || 'Erreur lors de l\'envoi du message de test.',
        };
      }

      return {
        success: true,
        message: 'Notification de test envoyée avec succès sur Telegram !',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Erreur réseau lors de la communication avec Telegram.',
      };
    }
  },

  /**
   * Récupère les derniers chats reçus par le bot (priorisant les groupes)
   */
  async fetchRecentChatIds(
    customToken?: string
  ): Promise<Array<{ id: number | string; name: string; username?: string; type: string }>> {
    // 1. Tenter via /api/telegram-notify
    try {
      const res = await fetch('/api/telegram-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-updates' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.chats)) {
          return data.chats;
        }
      }
    } catch {
      // Repli direct
    }

    // 2. Repli direct
    const token = (customToken || this.getBotToken()).trim();
    if (!token) return [];

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?allowed_updates=["message","my_chat_member","chat_member"]`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.result)) return [];

      const chatsMap = new Map<string, { id: number | string; name: string; username?: string; type: string }>();

      for (const update of data.result) {
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

      return Array.from(chatsMap.values()).sort((a, b) => {
        const isGroupA = a.type === 'supergroup' || a.type === 'group';
        const isGroupB = b.type === 'supergroup' || b.type === 'group';
        if (isGroupA && !isGroupB) return -1;
        if (!isGroupA && isGroupB) return 1;
        return 0;
      });
    } catch (e) {
      console.warn('[Telegram] Impossible de récupérer les updates:', e);
      return [];
    }
  },
};
