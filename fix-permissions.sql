-- ==============================================================================
-- SCRIPT DE DÉBLOCAGE IMMÉDIAT : PERMISSIONS RLS (MAISON CÉLESTE V2)
-- ==============================================================================
-- Exécutez ce script dans votre Supabase Dashboard > SQL Editor
-- Il débloque immédiatement l'enregistrement des commandes et la modification
-- des paramètres White-Label.
-- ==============================================================================

-- 1. DÉBLOCAGE DE LA CONFIGURATION WHITE-LABEL
DROP POLICY IF EXISTS "Admin write store_config" ON public.store_config;
DROP POLICY IF EXISTS "Allow update store_config" ON public.store_config;

CREATE POLICY "Allow update store_config" ON public.store_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. DÉBLOCAGE DES COMMANDES (INSERTION ET SUIVI PAR TÉLÉPHONE)
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admin select orders" ON public.orders;
DROP POLICY IF EXISTS "Public select orders" ON public.orders;
DROP POLICY IF EXISTS "Admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin delete orders" ON public.orders;
DROP POLICY IF EXISTS "Allow delete orders" ON public.orders;

CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public select orders" ON public.orders
  FOR SELECT
  USING (true);

CREATE POLICY "Allow update orders" ON public.orders
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete orders" ON public.orders
  FOR DELETE
  USING (true);

-- 3. DÉBLOCAGE DES PRODUITS ET VARIANTES POUR L'ADMINISTRATION
DROP POLICY IF EXISTS "Admin write products" ON public.products;
DROP POLICY IF EXISTS "Allow write products" ON public.products;
CREATE POLICY "Allow write products" ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin write product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow write product_variants" ON public.product_variants;
CREATE POLICY "Allow write product_variants" ON public.product_variants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. DÉBLOCAGE DES TARIFS WILAYAS
DROP POLICY IF EXISTS "Admin write wilayas" ON public.wilayas;
DROP POLICY IF EXISTS "Allow write wilayas" ON public.wilayas;
CREATE POLICY "Allow write wilayas" ON public.wilayas
  FOR ALL
  USING (true)
  WITH CHECK (true);
