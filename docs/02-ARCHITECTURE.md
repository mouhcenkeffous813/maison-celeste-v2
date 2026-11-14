# 02 — Architecture Technique & Diagrammes (Maison Céleste V2)

Ce document décrit l'architecture logicielle du projet **Maison Céleste V2**, les flux de données entre les différents composants, ainsi que les modèles de conception appliqués.

---

## 1. Architecture Globale du Système V2

L'application adopte une **Architecture Hybride Moderne** :
* **Côté Client :** Une Single Page Application (SPA) ultra-réactive développée en **React 18** et **TypeScript**, utilisant le React Context API (`StoreContext`) pour l'état global et un service d'abstraction API (`api.ts`).
* **Côté Serveur Serverless :** Une **Edge Function Supabase (Deno)** `create-order` qui prend en charge les validations critiques (prix, téléphone algérien, décrémentation atomique des stocks, notifications Telegram).
* **Côté Base de Données :** Une instance managée **PostgreSQL 15+** sur **Supabase Cloud** avec politiques de sécurité Row Level Security (RLS) et fonctions RPC.

```mermaid
graph TD
    Client["Client Mobile / Desktop (Acheteur)"] -->|Navigation & Commande| UI["Boutique Storefront (React 18)"]
    Admin["Commerçant / Gérant"] -->|Gestion Sécurisée| AdminUI["Dashboard Back-Office (Supabase Auth)"]
    
    UI -->|Hooks & Actions| StateContext["StoreContext (React Context)"]
    AdminUI -->|Hooks & Actions| StateContext
    
    StateContext -->|Appels Asynchrones| ServiceAPI["Service API (api.ts)"]
    
    subgraph "Couche Serverless (Edge Network)"
        ServiceAPI -->|Création Commande HTTPS| EdgeFunction["Edge Function Deno ('create-order')"]
        EdgeFunction -->|1. Recalcul Prix & Tél| EdgeFunction
        EdgeFunction -->|2. Alerte Push Instantanée| TelegramBot["Bot Telegram API (@Colisssbot)"]
    end

    subgraph "Plateforme Supabase Cloud"
        EdgeFunction -->|3. Décrémentation Stock| RPC["RPC decrease_product_stock()"]
        EdgeFunction -->|4. Insertion Certifiée| DB_Orders[("Table orders")]
        ServiceAPI -->|Lecture Catalogue / Wilayas| PostgREST["API REST PostgREST"]
        PostgREST --> DB_Products[("Tables products & variants")]
        PostgREST --> DB_Config[("Table store_config")]
        AdminUI -->|Upload Photos WebP| Storage["Supabase Storage (product-images)"]
        AdminUI -->|Auth Email/Mot de passe| Auth["Supabase Auth (GoTrue JWT)"]
        DB_Orders -->|Événements Temps Réel| Realtime["Supabase Realtime (WebSockets)"]
    end

    Realtime -.->|Diffusion Nouvelles Commandes| StateContext
    TelegramBot -->|Notification Sonore Push| AdminPhone["Smartphone du Gérant"]
```

---

## 2. Flux de Commande Sécurisé V2 (Cash on Delivery)

Le flux de commande intègre une double validation client/serveur pour éliminer toute possibilité de falsification :

```mermaid
sequenceDiagram
    autonumber
    actor Client as Acheteur (Smartphone)
    participant Form as ProductPage / CartDrawer
    participant Context as StoreContext.tsx
    participant API as api.ts
    participant Edge as Edge Function (create-order)
    participant DB as PostgreSQL (Orders & RPC)
    participant TG as Bot Telegram (@Colisssbot)
    actor Admin as Commerçant (Telegram)

    Client->>Form: Sélectionne Wilaya, Commune, Mode (Domicile / Stop Desk)
    Form->>Form: Calcul indicatif immédiat des frais de livraison
    Client->>Form: Saisit Nom & Téléphone puis clique sur [COMMANDER]
    Form->>Context: createOrder(orderPayload)
    Context->>API: api.createOrder(payload)
    
    API->>Edge: Invoque POST /functions/v1/create-order
    Note over Edge: 1. Vérification regex du numéro algérien (05/06/07)<br/>2. Rechargement des prix certifiés depuis la table products<br/>3. Recalcul autoritaire du montant total COD
    
    Edge->>DB: Appel RPC decrease_product_stock(produit, variante, qté)
    DB-->>Edge: Stock décrémenté de manière atomique (ACID)
    
    Edge->>DB: INSERT INTO orders VALUES (commande_certifiée)
    DB-->>Edge: 201 Created
    
    Edge->>TG: Envoi notification détaillée en Markdown
    TG-->>Admin: 🔔 Bip sonore immédiat avec lien direct WhatsApp !
    
    Edge-->>API: 200 OK (Objet Order certifié)
    API-->>Context: Mise à jour du state React
    Context-->>Form: Confirmation d'achat & Déclenchement Confettis
    Form-->>Client: Écran de succès festif avec récapitulatif
```

---

## 3. Architecture d'Administration & Sécurité de Session V2

L'ancien code PIN côté client a été **intégralement remplacé par Supabase Auth (GoTrue)** :

```mermaid
graph LR
    subgraph "Accès Sécurisé Admin"
        DirectURL["URL privée /#admin"]
        FooterLink["Lien discret 'Espace Gérant' en bas de page"]
    end

    DirectURL --> AuthGate["Garde d'Authentification (AdminLayout)"]
    FooterLink --> AuthGate

    AuthGate --> CheckAuth{"Session JWT Active ?"}
    CheckAuth -->|Non| LoginForm["AdminLogin (Email + Mot de Passe)"]
    CheckAuth -->|Oui| Dashboard["Tableau de Bord Gérant (AdminLayout)"]

    LoginForm -->|supabase.auth.signInWithPassword| SupabaseAuth["Serveur Supabase Auth"]
    SupabaseAuth -->|Identifiants Valides| IssueJWT["Émission Token JWT sécurisé"]
    IssueJWT --> Dashboard
    SupabaseAuth -->|Erreur| ShowError["Message d'erreur sécurisé"]

    subgraph "Modules du Dashboard"
        Dashboard --> Overview["KPIs Financiers & Ventes en Direct"]
        Dashboard --> Orders["CRM Commandes, Bordereaux, Export CSV, Suppression"]
        Dashboard --> Products["Catalogue, Variantes & Upload WebP"]
        Dashboard --> Settings["White-Label (Thèmes, WhatsApp, Pixels, Bot Telegram)"]
        Dashboard --> Shipping["Tarifs des 58 Wilayas (Domicile & Stop Desk)"]
    end
```

---

## 4. Stratégie de Résilience & Tolérance aux Pannes (Fail-Safe)

Pour assurer une disponibilité de 99.99 % même en cas de coupure réseau temporaire ou de maintenance cloud :

1. **Tentative Primaire :** Appel de l'Edge Function `create-order` pour validation serveur et décrémentation atomique.
2. **Fallback Secondaire Automatique :** Si l'Edge Function ne répond pas dans le délai imparti, `api.ts` bascule immédiatement sur l'insertion directe sécurisée dans Supabase PostgreSQL avec exécution de la RPC `decrease_product_stock` et envoi de l'alerte Telegram via [`telegramService.ts`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/services/telegramService.ts).
3. **Fallback Hors-Ligne Tertiaire :** Si la connexion Internet est totalement coupée, la commande est enregistrée dans le cache local et synchronisée dès le rétablissement de la connexion.
