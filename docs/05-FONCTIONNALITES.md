# 05 — Fonctionnalités Détaillées (Maison Céleste V2)

Ce document dresse l'inventaire exhaustif des fonctionnalités de **Maison Céleste V2**, réparties entre la **Boutique Publique (Front-Office)** et le **Tableau de Bord Administrateur (Back-Office)**.

---

## 1. Boutique Publique (Expérience Acheteur B2C)

### 1.1 Catalogue & Navigation
* **Grille Mobile Optimisée 2 Colonnes :** Affichage harmonieux sur smartphone avec cartes de produits compactes, prix en DA, prix barrés, notes d'avis et badges promotionnels.
* **Filtres Dynamiques par Catégorie :** Filtrage instantané sans rechargement de page (*Colliers & Pendentifs*, *Bracelets & Joncs*, *Bagues & Alliances*, *Coffrets & Packs*, *Montres*, *Caftans*).
* **Recherche Intelligente :** Barre de recherche en temps réel filtrant par titre, description ou matière.
* **Mode Sombre (Dark Mode) :** Bascule visuelle élégante préservant la palette de couleurs dorée, mémorisée dans le navigateur.

### 1.2 Fiche Produit & Formulaire COD 1-Page
* **Galerie Photo Interactive :** Carrousel de visuels haute définition avec sélecteur de miniatures.
* **Sélecteur de Variantes :** Choix interactif des coloris (avec pastilles couleur hexadécimales) et des tailles, avec mise à jour en direct de l'état du stock.
* **Tunnel COD Instantané :**
  - Formulaire de commande directe intégré sous les caractéristiques du produit.
  - Sélection de la Wilaya parmi les **58 Wilayas d'Algérie** avec mise à jour automatique des communes associées.
  - Choix du mode : **À Domicile** ou **Stop Desk (Bureau de retrait)** avec affichage instantané du tarif exact.
  - Validation du numéro mobile algérien (`05`, `06`, `07`).
  - Validation en 1 clic : déclenchement de confettis festifs et proposition de confirmation immédiate via WhatsApp.

### 1.3 Tiroir Panier Multi-Articles (*CartDrawer*)
* **Notification d'Ajout Discrète (*CartNotification*) :** Toast élégant proposant deux options : *« Continuer mes achats »* (pour explorer la boutique librement) ou *« Voir mon panier »*.
* **Bouton « ← CONTINUER MES ACHATS » :** Permet de refermer le tiroir du panier à tout moment sans perdre sa sélection ni réinitialiser les quantités.
* **Commande Groupée Multi-Produits :** Formulaire de livraison consolidé calculant les frais d'expédition uniques pour l'ensemble du panier.

### 1.4 Suivi de Commande en Direct (*OrderTracking*)
* Les clients peuvent saisir leur numéro de téléphone pour consulter l'historique et l'avancement de leurs commandes (*En attente*, *Confirmée*, *En préparation*, *Expédiée*, *Livrée*), sans avoir besoin de créer un mot de passe.

---

## 2. Tableau de Bord Administrateur (Back-Office Gérant)

### 2.1 Accès Strictement Restreint & Sécurité
* **Porte d'Accès Sécurisée ([`AdminLogin.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminLogin.tsx)) :** Protégée par **Supabase Auth (Email + Mot de passe crypté)**.
* **Zéro Bouton d'Inscription Public :** Aucun visiteur ou client ne peut créer de compte admin sur le site.
* **Masquage pour les Clients :** Le bouton Dashboard est invisible dans le header et le menu mobile pour les visiteurs non connectés.
* **Accès Gérant :** Accessible via l'URL privée `/#admin` ou via le lien discret `🔒 Espace Gérant` dans le pied de page.

### 2.2 CRM & Traitement des Commandes ([`AdminOrders.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminOrders.tsx))
* **Tableau de Suivi en Direct :** Numéro de commande, date, coordonnées client, destination, articles & variantes, montant total COD et statut.
* **Cycle de Vie des Commandes :** Modification du statut en 1 clic via menu déroulant (*En attente* ➔ *Confirmée* ➔ *En préparation* ➔ *Expédiée* ➔ *Livrée* ➔ *Annulée*).
* **Alerte Sonore & Modale Festive :** Bip sonore de caisse enregistreuse et fenêtre modale dorée s'ouvrant automatiquement à l'arrivée d'une nouvelle commande.
* **Contact Client WhatsApp 1-Clic :** Bouton ouvrant directement une discussion WhatsApp pré-remplie avec le numéro algérien du client.
* **Impression de Bordereau de Colis ([`OrderDeliverySlip.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/OrderDeliverySlip.tsx)) :** Génération d'une étiquette propre au format colis standard prête à coller sur le paquet.
* **Export CSV Transporteurs :** Téléchargement instantané des commandes au format CSV compatible avec les logiciels d'expédition (Yalidine, ZR Express).
* **Suppression de Commande 🗑️ :** Bouton corbeille avec confirmation pour effacer les commandes d'essai ou annulées.

### 2.3 Gestion du Catalogue & Upload WebP ([`AdminProducts.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminProducts.tsx))
* **Création, Modification et Suppression de Produits :** Titre, sous-titre, description, prix normal, prix barré, catégorie et visuels.
* **Gestion des Variantes Multiples :** Définition des couleurs (nom + code hexadécimal), tailles et stock physique individuel par variante.
* **Téléversement d'Images avec Compression WebP ([`storage.ts`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/services/storage.ts)) :** Compression automatique côté client avant envoi sur Supabase Storage (économie de 95 % de bande passante).

### 2.4 Notifications Telegram Commerçant ([`AdminSettings.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminSettings.tsx))
* **Configuration du Bot Telegram :** Token du Bot et Chat ID du commerçant.
* **Bouton « Détecter auto » :** Détecte automatiquement l'identifiant du gérant après l'envoi d'un simple `/start` à `@Colisssbot`.
* **Bouton « Tester le Bot » :** Envoie immédiatement un message de vérification sur le smartphone du gérant.

### 2.5 Personnalisation White-Label (Marque Blanche)
* **Sélecteur de Thèmes en Direct :** 4 palettes de luxe prédéfinies (*Or & Nude*, *Bleu Nuit Céleste*, *Émeraude Royale*, *Bordeaux Rubis*) ou sélection de couleurs personnalisées via sélecteur hexadécimal.
* **Paramètres de Marque :** Modification instantanée du nom de la boutique, slogan, logo, numéro de téléphone d'assistance et seuil de livraison gratuite.
* **Pixels Publicitaires :** Saisie des identifiants Meta Pixel (Facebook/Instagram) et TikTok Pixel pour la mesure automatique du ROI des campagnes.

### 2.6 Grille Tarifaire des 58 Wilayas ([`AdminShipping.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminShipping.tsx))
* Consultation et ajustement des tarifs de livraison à domicile et en bureau de retrait (*Stop Desk*) pour chacune des 58 Wilayas d'Algérie.
