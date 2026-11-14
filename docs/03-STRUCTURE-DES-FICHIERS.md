# 03 — Structure Réelle des Fichiers et Dossiers (Maison Céleste V2)

Ce document détaille l'organisation de l'ensemble du projet **Maison Céleste V2**, la responsabilité de chaque sous-dossier et fichier, ainsi que leurs dépendances mutuelles.

---

## 1. Arborescence Complète du Projet V2

```text
maison-celeste-v2/
├── .env                              # Variables d'environnement locales (Supabase, WhatsApp, Telegram)
├── .env.example                      # Gabarit public des variables d'environnement
├── .env.local                        # Surcharges locales de variables
├── .gitignore                        # Règles d'exclusion pour Git
├── index.html                        # Point d'entrée HTML5 avec balises meta et polices Google Fonts
├── package.json                      # Dépendances npm et scripts de build/dev
├── package-lock.json                 # Verrouillage des versions exactes des paquets
├── postcss.config.js                 # Configuration du préprocesseur PostCSS
├── tailwind.config.js                # Configuration Tailwind CSS (thèmes dynamiques, ombres, polices)
├── tsconfig.json                     # Configuration du compilateur TypeScript
├── tsconfig.node.json                # Configuration TypeScript pour Vite
├── vercel.json                       # Configuration de déploiement et règles de redirection SPA Vercel
├── vite.config.ts                    # Configuration du bundler Vite 5
├── supabase-v2-migration.sql         # Script SQL complet de migration (Tables, Seeds, RPC, Storage, RLS)
├── fix-permissions.sql               # Script de déblocage et renforcement des permissions RLS
│
├── .github/                          # Automatisation CI/CD et DevOps
│   └── workflows/
│       ├── ci.yml                    # Validation continue du build et des types TypeScript
│       └── database-backup.yml       # Sauvegarde automatisée quotidienne de la base PostgreSQL
│
├── docs/                             # Documentation d'architecture et guides complets
│   ├── 01-PRESENTATION.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-STRUCTURE-DES-FICHIERS.md
│   ├── 04-TECHNOLOGIES.md
│   ├── 05-FONCTIONNALITES.md
│   ├── 06-FRONTEND.md
│   ├── 07-BACKEND.md
│   ├── 08-BASE-DE-DONNEES.md
│   ├── 09-API.md
│   ├── 10-SECURITE.md
│   ├── 11-INSTALLATION-LOCALE.md
│   ├── 12-DEPLOIEMENT.md
│   ├── 13-MAINTENANCE.md
│   ├── AUDIT-TECHNIQUE-MAISON-CELESTE.md
│   └── ETUDE-BACKEND-BAAS-VS-CUSTOM.md
│
├── public/                           # Fichiers statiques copiés tels quels dans le bundle
│   ├── logo-icon.svg                 # Icône logo vectorielle
│   ├── orlea-logo.svg                # Logo vectoriel officiel avec sceau doré
│   └── images/products/              # Photographies locales HD de secours
│
├── src/                              # Code source applicatif TypeScript / React
│   ├── App.tsx                       # Composant racine orchestrant le routage des vues
│   ├── index.css                     # Styles globaux Tailwind et variables CSS dynamiques
│   ├── main.tsx                      # Point d'entrée de montage React 18 dans le DOM
│   │
│   ├── components/                   # Composants React modulaires
│   │   ├── admin/                    # Modules du tableau de bord administrateur (Back-Office)
│   │   │   ├── AdminLayout.tsx       # Conteneur principal, sidebar mobile (drawer) & desktop
│   │   │   ├── AdminLogin.tsx        # Porte d'accès sécurisée par Supabase Auth (Email + Password)
│   │   │   ├── AdminMarketing.tsx    # Configuration des Pixels Meta / TikTok et logs d'événements
│   │   │   ├── AdminOrders.tsx       # CRM des commandes, filtres, export CSV, suppression
│   │   │   ├── AdminOverview.tsx     # Tableau de bord analytique et KPIs financiers en direct
│   │   │   ├── AdminProducts.tsx     # Gestion des articles, variantes et téléversement d'images
│   │   │   ├── AdminSettings.tsx     # Paramètres White-Label & Configuration Bot Telegram
│   │   │   ├── AdminShipping.tsx     # Grille tarifaire des 58 Wilayas (Domicile & Stop Desk)
│   │   │   ├── NewOrderAlertModal.tsx# Modale festive avec confettis lors d'une nouvelle commande
│   │   │   ├── OrderDeliverySlip.tsx # Bordereau d'expédition de livraison au format colis standard
│   │   │   └── OrderDetailsModal.tsx # Fiche complète de commande avec bouton WhatsApp client
│   │   │
│   │   └── storefront/               # Modules de la boutique publique (Front-Office)
│   │       ├── CartDrawer.tsx        # Tiroir latéral du panier multi-articles & formulaire COD
│   │       ├── CartNotification.tsx  # Toast d'ajout au panier avec bouton « Continuer mes achats »
│   │       ├── ContactPage.tsx       # Page de contact et coordonnées du service client
│   │       ├── CookieConsentBanner.tsx# Bannière de consentement pour les cookies et le tracking
│   │       ├── Footer.tsx            # Pied de page avec lien discret « Espace Gérant »
│   │       ├── HomePage.tsx          # Page d'accueil, grille responsive 2 colonnes mobile, filtres
│   │       ├── Navbar.tsx            # En-tête client (Logo, Recherche, Dark Mode, Panier)
│   │       ├── NavigationDrawer.tsx  # Menu mobile latéral coulissant
│   │       ├── OrderTracking.tsx     # Module de suivi de commande en direct par numéro de téléphone
│   │       ├── ProductPage.tsx       # Fiche produit haute joaillerie avec formulaire COD 1-clic
│   │       └── ShippingRates.tsx     # Grille publique des tarifs de livraison des 58 Wilayas
│   │
│   ├── config/                       # Configuration et données de référence
│   │   ├── store.config.ts           # Valeurs par défaut, palettes de thèmes White-Label
│   │   └── wilayas.json              # Base officielle des 58 Wilayas et 1 541 communes d'Algérie
│   │
│   ├── context/                      # Gestion d'état global réactif
│   │   └── StoreContext.tsx          # Fournisseur de contexte central (StoreProvider & useStore)
│   │
│   ├── data/                         # Jeux de données initiaux et de démonstration
│   │   ├── mockOrders.ts             # Exemples de commandes réalistes
│   │   ├── mockProducts.ts           # Catalogue initial de 12 produits
│   │   └── mockReviews.ts            # Avis clients vérifiés
│   │
│   ├── services/                     # Services d'infrastructure & APIs
│   │   ├── api.ts                    # Abstraction des requêtes Supabase PostgreSQL & Edge Functions
│   │   ├── consentManager.ts         # Gestionnaire des préférences de cookies/tracking
│   │   ├── storage.ts                # Compression WebP HTML5 Canvas & Upload Supabase Storage
│   │   ├── supabaseClient.ts         # Initialisation du client singleton Supabase avec persistance JWT
│   │   ├── telegramService.ts        # Service de notification instantanée vers le Bot Telegram
│   │   └── trackingManager.ts        # Orchestration unifiée des Pixels Meta et TikTok
│   │
│   ├── types/                        # Déclarations TypeScript strictes
│   │   ├── index.ts                  # Interfaces Product, Order, Wilaya, StoreConfig
│   │   └── marketing.ts              # Interfaces pour les événements de tracking
│   │
│   └── utils/                        # Utilitaires purs réutilisables
│       ├── formatters.ts             # Formatage des prix (DA), dates et normalisation téléphonique
│       └── imageCompressor.ts        # Algorithmes de compression d'images
│
└── supabase/                         # Code serveur et fonctions Serverless
    └── functions/
        └── create-order/
            └── index.ts              # Edge Function Serverless Deno (Validation serveur & Telegram)
```

---

## 2. Responsabilités des Nouveaux Fichiers V2

1. **`supabase/functions/create-order/index.ts` (Deno) :**  
   Cœur de la logique serveur serverless : recalcule les prix certifiés, valide le format du numéro mobile algérien, exécute la RPC de baisse de stock et envoie l'alerte au Bot Telegram.
2. **`src/services/storage.ts` :**  
   Convertit les photos sélectionnées en format moderne **WebP** via un élément Canvas invisible, réduisant le poids moyen à ~100 Ko avant de l'envoyer sur le bucket CDN Supabase `product-images`.
3. **`src/services/telegramService.ts` :**  
   Prépare les messages de commande richement formatés avec toutes les données clients et variantes, et gère la détection automatique du Chat ID via l'API Telegram.
4. **`.github/workflows/database-backup.yml` :**  
   Pipeline automatisé GitHub Actions qui exporte un dump compressé de la base de données PostgreSQL chaque nuit pour garantir une sauvegarde indépendante du cloud.
