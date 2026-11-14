# 13 — Guide d'Exploitation & Maintenance Quotidienne (Maison Céleste V2)

Ce document fournit au gérant et à l'équipe technique le guide opérationnel pour exploiter, surveiller et maintenir la boutique **Maison Céleste V2** au quotidien.

---

## 1. Routine d'Exploitation Quotidienne du Commerçant

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      WORKFLOW QUOTIDIEN DU GÉRANT                      │
│                                                                        │
│  1. Réception Alerte Sonore Push sur Telegram (@Colisssbot)           │
│         │                                                              │
│         ▼                                                              │
│  2. Clic sur le lien direct WhatsApp intégré dans le message Telegram  │
│         │                                                              │
│         ▼                                                              │
│  3. Confirmation de l'adresse et de la disponibilité du client         │
│         │                                                              │
│         ▼                                                              │
│  4. Dans le Dashboard (/#admin), passage du statut :                   │
│     "En attente" ➔ "Confirmée" ➔ "En préparation"                      │
│         │                                                              │
│         ▼                                                              │
│  5. Clic sur [Bordereau] pour imprimer l'étiquette de colis standard   │
│         │                                                              │
│         ▼                                                              │
│  6. Remise au livreur (Yalidine / ZR Express / coursier interne)       │
│         │                                                              │
│         ▼                                                              │
│  7. Passage à l'état "Expédiée" puis "Livrée & Payée (COD)"           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gestion & Réapprovisionnement des Stocks

1. **Baisse Automatique :** À chaque commande passée, la procédure PostgreSQL `decrease_product_stock` décrémente automatiquement le stock de la variante exacte commandée (ex: taille Standard, couleur Doré).
2. **Réapprovisionnement :**
   * Rendez-vous sur `/#admin` ➔ Onglet **Produits**.
   * Cliquez sur le crayon de modification du produit.
   * Dans la section **Variantes physiques**, augmentez la quantité numérique du stock de la couleur ou taille réapprovisionnée.
   * Cliquez sur **Enregistrer le produit** : le nouveau stock est immédiatement disponible en ligne.

---

## 3. Sauvegardes & Sécurité des Données

### 3.1 Sauvegardes Automatiques Quotidiennes (GitHub Actions)
Le workflow `.github/workflows/database-backup.yml` s'exécute automatiquement chaque nuit à 02h00 UTC :
* Il exporte l'ensemble des tables (`orders`, `products`, `product_variants`, `store_config`, `wilayas`).
* Il compresse le fichier SQL et le téléverse sous forme d'artefact GitHub chiffré conservé pendant 30 jours.

### 3.2 Prévention de la Mise en Veille Supabase (Plan Gratuit)
Sur l'offre gratuite de Supabase, une base sans activité pendant 7 jours consécutifs peut être mise en pause :
* **En exploitation normale :** Les commandes quotidiennes des clients et vos connexions au Dashboard maintiennent la base toujours active.
* **En période creuse :** Connectez-vous simplement à votre tableau de bord Supabase ou à votre espace gérant une fois par semaine pour réinitialiser le minuteur d'inactivité.

---

## 4. Guide de Dépannage Rapide (Troubleshooting)

### A. Une notification Telegram ne s'affiche pas
1. Vérifiez que votre Chat ID est bien renseigné dans les **Paramètres White-Label** du Dashboard.
2. Si besoin, ouvrez Telegram, envoyez `/start` à `@Colisssbot` puis cliquez sur **« Détecter auto »** dans le Dashboard.
3. Cliquez sur **« Tester le Bot »** : si le message test arrive, la connexion est rétablie.

### B. Une photo ne se téléverse pas
1. Notre convertisseur WebP accepte les formats JPEG, PNG et WebP jusqu'à 50 Mo.
2. Assurez-vous d'être bien connecté en tant qu'administrateur avec votre compte Supabase Auth pour disposer des droits d'écriture dans le bucket `product-images`.
