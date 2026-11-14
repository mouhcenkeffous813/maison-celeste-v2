# 04 — Stack Technologique Complète (Maison Céleste V2)

Ce document répertorie l'ensemble des technologies, bibliothèques, moteurs et services composant l'architecture de **Maison Céleste V2**, ainsi que les raisons techniques de chaque choix.

---

## 1. Vue d'Ensemble de la Stack V2

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        STACK MAISON CÉLESTE V2                         │
├───────────────────┬────────────────────────────────────────────────────┤
│ Frontend SPA      │ React 18 • TypeScript 5 • Vite 5 • Tailwind CSS 3  │
├───────────────────┼────────────────────────────────────────────────────┤
│ Serverless Edge   │ Supabase Edge Functions (Deno Runtime / TypeScript)│
├───────────────────┼────────────────────────────────────────────────────┤
│ Base de Données   │ PostgreSQL 15+ Managé • PostgREST • Supabase Cloud │
├───────────────────┼────────────────────────────────────────────────────┤
│ Authentification  │ Supabase Auth (GoTrue) • Sessions JWT Chiffrées   │
├───────────────────┼────────────────────────────────────────────────────┤
│ Médias & CDN      │ Supabase Storage • Compression Client WebP Canvas  │
├───────────────────┼────────────────────────────────────────────────────┤
│ Notifications     │ Telegram Bot API (@Colisssbot) • WhatsApp C2C      │
├───────────────────┼────────────────────────────────────────────────────┤
│ Tracking Ads      │ Meta Pixel API • TikTok Pixel API • Consent Manager│
├───────────────────┼────────────────────────────────────────────────────┤
│ DevOps & CI/CD    │ GitHub Actions • Vercel Global Edge Network        │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 2. Technologies Frontend

### React 18
* **Rôle :** Moteur de rendu de l'interface utilisateur.
* **Bénéfices :** Virtual DOM ultra-performant, React Context API pour la gestion d'état centralisée sans bibliothèque superflue, hooks modernes (`useState`, `useEffect`, `useMemo`, `useCallback`).

### TypeScript 5
* **Rôle :** Typage statique strict sur l'intégralité du code source.
* **Bénéfices :** Détection préventive des bugs à la compilation, auto-complétion intelligente et documentation vivante du schéma de données (`Order`, `Product`, `Wilaya`, `StoreConfig`).

### Vite 5
* **Rôle :** Outil de développement et bundler de production.
* **Bénéfices :** Démarrage du serveur de développement en moins de 300 ms via ESBuild, minification Rollup de production générant un bundle de moins de 190 Ko gzippé.

### Tailwind CSS 3.4
* **Rôle :** Système de design utilitaire responsive.
* **Bénéfices :** Zéro CSS mort en production grâce au Tree-Shaking, support du Dark Mode natif et injection dynamique de variables CSS pour le moteur de thèmes White-Label.

### Lucide React & Canvas Confetti
* **Rôle :** Iconographie vectorielle et micro-interactions festives.
* **Bénéfices :** Icônes légères importées à la demande, animation visuelle de confettis renforçant la satisfaction client lors de la validation d'achat.

---

## 3. Technologies Backend & Serverless

### Supabase Edge Functions (Deno Runtime)
* **Rôle :** Exécution de code serveur distribué géographiquement à la périphérie du réseau (*Edge*).
* **Bénéfices :** Temps de démarrage quasi-instantané (cold start < 50 ms), recalcul imperméable des prix, validation stricte du format mobile algérien et envoi sécurisé des notifications Telegram.

### PostgreSQL 15+ (Supabase Cloud)
* **Rôle :** Base de données relationnelle centrale.
* **Bénéfices :** Intégrité relationnelle ACID, fonctions stockées PL/pgSQL (RPC `decrease_product_stock` avec `FOR UPDATE`), indexation b-tree pour les recherches instantanées par téléphone et par Wilaya.

### Supabase Auth (GoTrue)
* **Rôle :** Gestionnaire d'identités et d'authentification administrateur.
* **Bénéfices :** Chiffrement fort des mots de passe (bcrypt), émission de jetons cryptés JWT (`access_token` et `refresh_token`), élimination définitive des anciens codes PIN côté client.

### Supabase Storage & WebP Canvas
* **Rôle :** Hébergement et distribution CDN des visuels produits.
* **Bénéfices :** Compression HTML5 Canvas côté client réduisant le poids moyen des photographies de 5 Mo à 100 Ko en format WebP, économisant 95 % de la bande passante.

---

## 4. Intégrations & Canaux Tiers

### Telegram Bot API
* **Rôle :** Acheminement des alertes de commande vers le commerçant.
* **Bénéfices :** Gratuit, instantané, sonore, affichant un récapitulatif ultra-complet avec bouton direct WhatsApp pour contacter le client en 1 clic.

### WhatsApp Business (Click-to-Chat Algérie)
* **Rôle :** Confirmation et relance des acheteurs COD.
* **Bénéfices :** Taux de confirmation supérieur à 85 % sur le marché algérien grâce au pré-remplissage automatique des coordonnées de commande.

### Tracking Marketing Unifié (Meta & TikTok Pixels)
* **Rôle :** Mesure des conversions publicitaires (PageView, ViewContent, AddToCart, Purchase).
* **Bénéfices :** Gestionnaire de consentement (*Consent Manager*) intégré respectant la confidentialité et prévenant les doublons de tracking.
