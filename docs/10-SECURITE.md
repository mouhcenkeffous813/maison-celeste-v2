# 10 — Sécurité & Protection des Données (Maison Céleste V2)

Ce document décrit l'ensemble des mesures de cybersécurité mises en œuvre dans **Maison Céleste V2** pour protéger les données commerciales, l'intégrité financière des commandes et la confidentialité des clients.

---

## 1. Principes Fondamentaux de Sécurité V2

1. **Défense en Profondeur :** La sécurité ne repose jamais sur le seul navigateur. Chaque action critique (prix, stocks, accès administrateur) est validée de manière autoritaire côté serveur.
2. **Moindre Privilège (Least Privilege) :** Les clés publiques exposées dans le frontend (`anon`) ne possèdent que les droits strictement nécessaires (insérer une commande, lire le catalogue public). Les opérations destructives ou sensibles requièrent un jeton JWT administrateur authentifié.
3. **Zéro Donnée Bancaire (PCI-DSS Out of Scope) :** En adoptant le modèle **Cash on Delivery (Paiement en espèces à la livraison)**, la boutique ne manipule ni ne stocke aucun numéro de carte bancaire, supprimant tout risque de fuite de données bancaires.

---

## 2. Résolution des Failles de la Version 1

| Risque Identifié en V1 | Statut V2 | Solution Technique Implémentée |
| :--- | :---: | :--- |
| **Manipulation des prix dans le navigateur** | 🟢 **SÉCURISÉ** | L'Edge Function serverless `create-order` recalcule obligatoirement les prix unitaires et frais de port depuis la base de données. |
| **Contournement de l'accès Admin par PIN** | 🟢 **SÉCURISÉ** | Remplacé par **Supabase Auth (GoTrue)** avec chiffrement bcrypt et jetons signés JWT. Tout code PIN a été banni. |
| **Inscription libre d'inconnus en tant qu'admin** | 🟢 **SÉCURISÉ** | Aucun onglet ni formulaire d'inscription n'est exposé sur le site. Les comptes admin sont créés en privé dans la console Supabase. |
| **Bouton Dashboard exposé aux visiteurs** | 🟢 **SÉCURISÉ** | Le bouton Dashboard est 100 % invisible dans le header et le menu mobile pour les clients ordinaires. |
| **Risque de sur-vendu lors de pics de trafic** | 🟢 **SÉCURISÉ** | Fonction stockée PostgreSQL `decrease_product_stock` avec verrouillage atomique de ligne (`SELECT FOR UPDATE`). |
| **Lecture des commandes clients par des tiers** | 🟢 **SÉCURISÉ** | Politiques RLS strictes : `SELECT` sur la table `orders` réservé au rôle `authenticated`. |

---

## 3. Politiques Row Level Security (RLS) PostgreSQL

La sécurité au niveau des lignes est activée sur toutes les tables :

```sql
-- 1. Table ORDERS : N'importe qui peut commander, seul l'admin peut lire/modifier
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin select orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin delete orders" ON public.orders
  FOR DELETE TO authenticated USING (true);

-- 2. Table PRODUCTS : Lecture publique, modification admin
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public select products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Admin write products" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

---

## 4. Sécurité des Médias & Upload WebP

1. **Désinfection des Noms de Fichiers :** Avant tout envoi, le nom de l'image est nettoyé pour ne contenir que des caractères alphanumériques minuscules et des tirets, neutralisant les risques de *Path Traversal*.
2. **Re-génération par Canvas HTML5 :** L'image originale n'est jamais envoyée brute. Elle est décodée puis re-dessinée dans un Canvas en mémoire qui génère un nouveau fichier WebP propre, éliminant tout script malveillant ou métadonnée cachée (stripping EXIF).
3. **Bucket Supabase Storage Protégé :** Le bucket `product-images` n'autorise l'écriture (`INSERT`/`UPDATE`) qu'aux requêtes munies d'un jeton JWT administrateur valide.
