import { Order } from '../types';

// Configuration par défaut Telegram (Bot Colisssbot de Maison Céleste)
export const DEFAULT_TELEGRAM_BOT_TOKEN = '9023085999:AAGBO6w0C0jb7w4oiy2j6wqwk782J34mACs';

const STORAGE_KEYS = {
  BOT_TOKEN: 'celeste_telegram_bot_token',
  CHAT_ID: 'celeste_telegram_chat_id',
  ENABLED: 'celeste_telegram_enabled',
};

export const telegramService = {
  /**
   * Récupère le Token du Bot (depuis env, localStorage ou valeur par défaut)
   */
  getBotToken(): string {
    const metaEnv = (import.meta as any).env || {};
    return (
      localStorage.getItem(STORAGE_KEYS.BOT_TOKEN) ||
      metaEnv.VITE_TELEGRAM_BOT_TOKEN ||
      DEFAULT_TELEGRAM_BOT_TOKEN
    );
  },

  /**
   * Récupère le Chat ID configuré
   */
  getChatId(): string {
    const metaEnv = (import.meta as any).env || {};
    return (
      localStorage.getItem(STORAGE_KEYS.CHAT_ID) ||
      metaEnv.VITE_TELEGRAM_CHAT_ID ||
      ''
    );
  },

  /**
   * Vérifie si les notifications sont configurées et actives
   */
  isConfigured(): boolean {
    const token = this.getBotToken();
    const chatId = this.getChatId();
    return Boolean(token && chatId && chatId.trim().length > 0);
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
    } else if (!cleanPhone.startsWith('213')) {
      intlPhone = '213' + cleanPhone;
    }
    const msg = encodeURIComponent(
      `Bonjour ${customerName}, c'est Maison Céleste concernant votre commande N° ${orderNumber}. Pouvez-vous nous confirmer votre disponibilité pour la livraison ?`
    );
    return `https://wa.me/${intlPhone}?text=${msg}`;
  },

  /**
   * Formate le message ultra-détaillé de nouvelle commande
   */
  formatOrderMessage(order: Order): string {
    const dateFormatted = new Date(order.createdAt).toLocaleString('fr-FR', {
      timeZone: 'Africa/Algiers',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Formattage du mode de livraison
    const deliveryLabel =
      order.deliveryType === 'home'
        ? '🏠 À Domicile (Adresse personnelle)'
        : '🏢 Bureau / Stop Desk (Agence ZR / Yalidine)';

    // Articles commandés (panier multiple ou article unique)
    let itemsBlock = '';
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      itemsBlock = order.items
        .map((it, idx) => {
          const variantDesc = [it.selectedColor, it.selectedSize].filter(Boolean).join(' • ');
          const lineTotal = (it.unitPrice * it.quantity).toLocaleString('fr-FR');
          return (
            `  ${idx + 1}. *${it.productTitle}*\n` +
            (variantDesc ? `     ▫️ _Variante :_ ${variantDesc}\n` : '') +
            `     ▫️ _Qté :_ ${it.quantity} × ${it.unitPrice.toLocaleString('fr-FR')} DA = *${lineTotal} DA*`
          );
        })
        .join('\n\n');
    } else {
      const variantDesc = [order.selectedColor, order.selectedSize].filter(Boolean).join(' • ');
      const lineTotal = (order.unitPrice * order.quantity).toLocaleString('fr-FR');
      itemsBlock =
        `  1. *${order.productTitle}*\n` +
        (variantDesc ? `     ▫️ _Variante :_ ${variantDesc}\n` : '') +
        `     ▫️ _Qté :_ ${order.quantity} × ${order.unitPrice.toLocaleString('fr-FR')} DA = *${lineTotal} DA*`;
    }

    const waLink = this.formatWhatsAppUrl(order.customerPhone, order.orderNumber, order.customerName);

    return (
      `🛍️ *NOUVELLE COMMANDE REÇUE !*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *N° Commande :* \`${order.orderNumber}\`\n` +
      `📅 *Date :* ${dateFormatted}\n\n` +
      `👤 *INFORMATIONS CLIENT*\n` +
      `• *Nom :* ${order.customerName}\n` +
      `• *Téléphone :* [${order.customerPhone}](tel:${order.customerPhone})\n` +
      `• *Wilaya :* *${order.wilayaName}* (${order.commune})\n` +
      `• *Adresse :* ${order.address}\n` +
      `• *Mode :* ${deliveryLabel}\n` +
      (order.notes ? `• *Note client :* _« ${order.notes} »_\n` : '') +
      `\n` +
      `💎 *ARTICLES COMMANDÉS*\n` +
      `${itemsBlock}\n\n` +
      `💰 *RÉCAPITULATIF FINANCIER*\n` +
      `• Sous-total articles : ${order.productTotal.toLocaleString('fr-FR')} DA\n` +
      `• Frais de livraison : ${order.shippingFee.toLocaleString('fr-FR')} DA\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💵 *TOTAL À ENCAISSER (COD) :* *${order.grandTotal.toLocaleString('fr-FR')} DA*\n\n` +
      `📲 [Cliquez ici pour contacter le client sur WhatsApp](${waLink})\n\n` +
      `🌸 _Maison Céleste Algérie — Notification Directe_`
    );
  },

  /**
   * Envoie la notification de nouvelle commande sur Telegram
   */
  async sendNewOrderNotification(order: Order): Promise<boolean> {
    const token = this.getBotToken();
    const chatId = this.getChatId();

    if (!token || !chatId || chatId.trim().length === 0) {
      console.warn('[Telegram] Notifications désactivées ou Chat ID non configuré.');
      return false;
    }

    try {
      const message = this.formatOrderMessage(order);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.error('[Telegram] Erreur API Telegram:', data);
        return false;
      }

      console.log('[Telegram] Notification envoyée avec succès pour:', order.orderNumber);
      return true;
    } catch (err) {
      console.error('[Telegram] Erreur réseau lors de l\'envoi:', err);
      return false;
    }
  },

  /**
   * Envoie une notification de test pour vérifier la connexion
   */
  async sendTestNotification(customToken?: string, customChatId?: string): Promise<{ success: boolean; message: string }> {
    const token = (customToken || this.getBotToken()).trim();
    const chatId = (customChatId || this.getChatId()).trim();

    if (!token) {
      return { success: false, message: 'Token du Bot manquant.' };
    }
    if (!chatId) {
      return { success: false, message: 'Chat ID manquant. Indiquez votre Chat ID ou envoyez un message au bot.' };
    }

    try {
      const testMessage =
        `🔔 *TEST NOTIFICATION TELEGRAM — MAISON CÉLESTE*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *La connexion avec votre boutique fonctionne parfaitement !*\n\n` +
        `Désormais, chaque nouvelle commande passée sur votre site sera instantanément notifiée ici avec tous les détails (Client, Téléphone, Wilaya, Articles et Montant COD).\n\n` +
        `🌸 _Système Opérationnel — Maison Céleste Algérie_`;

      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: 'Markdown',
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
   * Récupère les derniers messages reçus par le bot pour détecter automatiquement le Chat ID
   */
  async fetchRecentChatIds(customToken?: string): Promise<Array<{ id: number | string; name: string; username?: string; type: string }>> {
    const token = (customToken || this.getBotToken()).trim();
    if (!token) return [];

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates`;
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

      return Array.from(chatsMap.values());
    } catch (e) {
      console.warn('[Telegram] Impossible de récupérer les updates:', e);
      return [];
    }
  },
};
