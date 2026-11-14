# 09 — Spécifications des APIs et Services (Maison Céleste V2)

Ce document décrit l'ensemble des points d'accès API utilisés dans **Maison Céleste V2**, leurs formats de requêtes et réponses, ainsi que les protocoles de communication.

---

## 1. Vue d'Ensemble des Points d'Accès

| Service | Protocole | Endpoint / URL | Rôle |
| :--- | :--- | :--- | :--- |
| **Edge Function Commande** | HTTPS POST | `/functions/v1/create-order` | Validation stricte, calcul prix, stock et Telegram |
| **API REST Produits** | HTTPS GET | `/rest/v1/products?select=*,product_variants(*)` | Chargement du catalogue et des variantes |
| **API REST Commandes** | HTTPS GET/POST/PATCH/DELETE | `/rest/v1/orders` | Gestion CRM des commandes (PostgREST) |
| **API RPC Stock** | HTTPS POST | `/rest/v1/rpc/decrease_product_stock` | Décrémentation atomique de stock |
| **Supabase Storage** | HTTPS POST/GET | `/storage/v1/object/public/product-images/...` | Téléversement et distribution d'images WebP |
| **Supabase Auth** | HTTPS POST | `/auth/v1/token?grant_type=password` | Authentification JWT Administrateur |
| **Telegram Bot API** | HTTPS POST/GET | `https://api.telegram.org/bot<TOKEN>/...` | Notifications push et détection de Chat ID |

---

## 2. L'Edge Function `create-order`

* **Méthode :** `POST`
* **URL :** `https://omzqajugkhkjxlkfmxpo.supabase.co/functions/v1/create-order`
* **En-têtes :**
  ```http
  Content-Type: application/json
  apikey: <SUPABASE_ANON_KEY>
  Authorization: Bearer <SUPABASE_ANON_KEY>
  ```
* **Corps de la Requête (JSON) :**
  ```json
  {
    "customerName": "Nawel Boudiaf",
    "customerPhone": "0552334411",
    "wilayaId": 16,
    "wilayaName": "Alger",
    "commune": "Sidi Yahia",
    "address": "Boulevard Principal",
    "deliveryType": "home",
    "productId": "prod-002",
    "productTitle": "Collier pendentif rond",
    "productImage": "https://images.unsplash.com/...",
    "selectedColor": "Doré",
    "selectedSize": "Standard",
    "quantity": 1,
    "notes": "Appeler avant la livraison"
  }
  ```
* **Réponse de Succès (`200 OK`) :**
  ```json
  {
    "success": true,
    "order": {
      "id": "ord-1731580000-abcde",
      "orderNumber": "CMD-DZ-4821",
      "customerName": "Nawel Boudiaf",
      "customerPhone": "0552334411",
      "wilayaId": 16,
      "wilayaName": "Alger",
      "commune": "Sidi Yahia",
      "address": "Boulevard Principal",
      "deliveryType": "home",
      "unitPrice": 4500,
      "productTotal": 4500,
      "shippingFee": 400,
      "grandTotal": 4900,
      "status": "pending",
      "createdAt": "2026-11-14T11:00:00.000Z"
    }
  }
  ```

---

## 3. L'API Telegram Bot (`@Colisssbot`)

### 3.1 Envoi d'Alerte de Commande (`sendMessage`)
* **Endpoint :** `POST https://api.telegram.org/bot9023085999:AAGBO6w0C0jb7w4oiy2j6wqwk782J34mACs/sendMessage`
* **Corps (JSON) :**
  ```json
  {
    "chat_id": "682438619",
    "text": "🛍️ *NOUVELLE COMMANDE REÇUE !*\n📦 *N° :* `CMD-DZ-4821`\n👤 *Client :* Nawel Boudiaf (0552334411)\n📍 *Destination :* Alger (Sidi Yahia)\n💰 *Total COD :* *4 900 DA*",
    "parse_mode": "Markdown",
    "disable_web_page_preview": true
  }
  ```

### 3.2 Détection Automatique du Chat ID (`getUpdates`)
* **Endpoint :** `GET https://api.telegram.org/bot9023085999:AAGBO6w0C0jb7w4oiy2j6wqwk782J34mACs/getUpdates`
* **Rôle :** Lit les derniers messages reçus par `@Colisssbot` pour extraire automatiquement le Chat ID de l'administrateur lorsqu'il clique sur *« Détecter auto »* dans le Dashboard.

---

## 4. API Supabase Storage (Upload WebP)

* **Endpoint :** `POST /storage/v1/object/product-images/products/<fileName>.webp`
* **En-têtes :**
  ```http
  Content-Type: image/webp
  Authorization: Bearer <ADMIN_JWT_TOKEN>
  ```
* **Format de l'URL publique résultante :**
  `https://omzqajugkhkjxlkfmxpo.supabase.co/storage/v1/object/public/product-images/products/collier-luxe-1731580000.webp`
