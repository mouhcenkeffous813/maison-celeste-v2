# 01 — Présentation Générale du Projet (Maison Céleste V2)

## 1. Vue d'ensemble

**Maison Céleste V2** est une solution e-commerce moderne, ultra-rapide et responsive, développée pour répondre aux exigences spécifiques de la vente en ligne en Algérie avec paiement à la livraison (**Cash on Delivery - COD**).

L'application allie l'esthétique raffinée d'une maison de haute joaillerie et couture (palette rose poudré, or 18k, textures soyeuses et typographie serif prestigieuse) à une **architecture hybride de pointe (React 18 + Supabase PostgreSQL + Serverless Edge Functions)** conçue pour maximiser le taux de conversion sur smartphone et sécuriser l'intégrité financière des commandes.

---

## 2. Objectifs Métier et Vision V2

1. **Expérience d'achat fluide (1-Page Checkout COD) :**
   - Suppression des frictions liées aux paniers d'achat traditionnels multi-étapes.
   - Formulaire de commande directe intégré sur chaque fiche produit et tiroir panier (*CartDrawer*).
   - Bouton ergonomique « Continuer mes achats » et notifications élégantes non intrusives.
   - Calcul automatique et instantané des frais de livraison pour l'ensemble des **58 Wilayas d'Algérie** (à domicile ou au bureau de retrait *Stop Desk*).

2. **Adaptation au marché algérien :**
   - Format de devises en Dinar Algérien (**DA**).
   - Validation stricte des numéros de téléphone mobiles algériens (formats `05`, `06`, `07` et `+213`).
   - Intégration de boutons directs **WhatsApp** pour confirmation immédiate et réassurance client.
   - Suivi de commande en temps réel via numéro de téléphone sans obligation d'inscription préalable.

3. **Sécurité et Intégrité Serveur (Nouveautés V2) :**
   - **Validation Serverless par Edge Function :** Recalcul autoritaire des prix réels et des frais de port côté serveur avant validation (protection anti-falsification).
   - **Décrémentation atomique des stocks (ACID) :** Procédure stockée SQL empêchant tout sur-vendu lors de pics de commandes.
   - **Alertes push instantanées via Bot Telegram :** Le commerçant reçoit chaque commande en direct sur son smartphone avec le Bot officiel `@Colisssbot`.

4. **Autonomie totale du commerçant & Back-Office d'Élite :**
   - Tableau de bord d'administration complet (**Dashboard Gérant**) protégé par **Supabase Auth (Email + Mot de passe)**.
   - Gestion des stocks en direct par variante (couleur et taille).
   - Téléversement d'images optimisé avec compression automatique **WebP** côté client (gain de 95% de poids).
   - Personnalisation White-Label (thèmes de couleurs en direct, logo, coordonnées WhatsApp, pixels Meta/TikTok).
   - Export comptable des commandes au format CSV compatible transporteurs (Yalidine, ZR Express) et impression de bordereaux de colis.

---

## 3. Positionnement Technique V2

| Critère | Spécification V2 | Rôle & Bénéfice |
| :--- | :--- | :--- |
| **Type d'Application** | Single Page Application (SPA) / JAMstack | Navigation instantanée sans rechargement de page |
| **Framework Principal** | **React 18** avec **TypeScript strict** | Composants réactifs, typage robuste sans runtime bugs |
| **Outil de Build** | **Vite 5** (Rollup / ESBuild) | Build de production optimisé en moins de 6 secondes |
| **Moteur CSS** | **Tailwind CSS 3.4** | Design system moderne et thèmes interchangeables dynamiques |
| **Couche Serveur** | **Supabase Edge Functions (Deno)** | Recalcul sécurisé des prix, validation et alertes Telegram |
| **Base de Données** | **PostgreSQL 15+ (Supabase Cloud)** | Stockage centralisé ACID (produits, variantes, commandes) |
| **Authentification Admin** | **Supabase Auth (GoTrue / JWT)** | Accès crypté et sécurisé réservé au gérant |
| **Stockage Médias** | **Supabase Storage + WebP Canvas** | CDN haute vitesse, réduction drastique de la bande passante |
| **Notifications Instantanées** | **Telegram Bot API (@Colisssbot)** | Alertes push sur smartphone avec lien direct WhatsApp |
| **Hébergement Frontend** | **Vercel Global Edge Network** | Disponibilité mondiale, SSL automatique et CDN Edge |

---

## 4. Publics Cibles

1. **Clients Finaux (B2C) :**
   - Acheteurs mobiles naviguant depuis Instagram, Facebook, TikTok ou des campagnes publicitaires digitales.
   - Clients recherchant une commande simple et rapide sans inscription préalable ni carte bancaire.

2. **Équipe Gestionnaire / Commerçant (Back-Office) :**
   - Gérant de la boutique traitant les commandes quotidiennes avec alertes sonores et notifications Telegram push.
   - Préparateurs de commandes éditant des bordereaux de livraison et modifiant les statuts (*En attente*, *Confirmée*, *En préparation*, *Expédiée*, *Livrée*, *Annulée*).
