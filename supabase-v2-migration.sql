-- ==============================================================================
-- MAISON CÉLESTE V2 — MIGRATION HYBRIDE BaaS + EDGE FUNCTIONS (SUPABASE)
-- ==============================================================================
-- Projet Supabase : omzqajugkhkjxlkfmxpo
-- Exécutez ce script complet dans le SQL Editor de votre projet Supabase.
-- ==============================================================================

-- 1. EXTENSIONS NÉCESSAIRES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLES EXISTANTES (AVEC NOUVELLES COLONNES ET SÉCURITÉ)
-- ==============================================================================

-- 2.1 Table des Commandes (Cash on Delivery Algérie)
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  wilaya_id INTEGER NOT NULL,
  wilaya_name TEXT NOT NULL,
  commune TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery_type TEXT NOT NULL DEFAULT 'home', -- 'home' ou 'desk'
  product_id TEXT NOT NULL,
  product_title TEXT NOT NULL,
  product_image TEXT NOT NULL,
  selected_color TEXT,
  selected_size TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  product_total NUMERIC NOT NULL,
  shipping_fee NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  tracking_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour accélérer la recherche et le tri des commandes
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_wilaya ON public.orders (wilaya_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- 2.2 Table de Configuration White-Label
CREATE TABLE IF NOT EXISTS public.store_config (
  id TEXT PRIMARY KEY DEFAULT 'current',
  store_name TEXT,
  store_tagline TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'DA',
  phone TEXT,
  whatsapp_number TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  tiktok_url TEXT,
  free_shipping_threshold NUMERIC DEFAULT 10000,
  free_shipping_enabled BOOLEAN DEFAULT FALSE,
  theme JSONB,
  meta_pixel_id TEXT,
  tiktok_pixel_id TEXT,
  delivery_time_estimate TEXT,
  announcement_text TEXT,
  admin_pin TEXT DEFAULT '1234',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Table des Intégrations Marketing (Pixels)
CREATE TABLE IF NOT EXISTS public.marketing_integrations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  pixel_id TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Table des 58 Wilayas d'Algérie
CREATE TABLE IF NOT EXISTS public.wilayas (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  ar_name TEXT NOT NULL,
  communes JSONB NOT NULL DEFAULT '[]'::jsonb,
  home_delivery_price NUMERIC NOT NULL DEFAULT 600,
  stop_desk_price NUMERIC NOT NULL DEFAULT 350,
  is_deliverable BOOLEAN NOT NULL DEFAULT true
);

-- ==============================================================================
-- 3. NOUVELLES TABLES : PRODUITS ET VARIANTES (CENTRALISATION POSTGRESQL)
-- ==============================================================================

-- 3.1 Table Principale des Produits
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  bullet_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC NOT NULL,
  compare_at_price NUMERIC NOT NULL DEFAULT 0,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_stock INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  badge TEXT,
  created_at TEXT NOT NULL DEFAULT (CURRENT_DATE::text)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- 3.2 Table des Variantes de Produits (Couleurs, Tailles, Stocks Réels)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  size TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  image TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- ==============================================================================
-- 4. FONCTION RPC TRANSACTIONNELLE : DÉCRÉMENTATION ATOMIQUE DES STOCKS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.decrease_product_stock(
  p_product_id TEXT,
  p_variant_id TEXT,
  p_quantity INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_stock INT;
  v_new_variant_stock INT;
  v_new_total_stock INT;
BEGIN
  -- 1. Verrouiller la ligne de la variante pour mise à jour transactionnelle (FOR UPDATE)
  SELECT stock INTO v_current_stock
  FROM public.product_variants
  WHERE id = p_variant_id AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante % introuvable pour le produit %', p_variant_id, p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Vérification stricte du stock disponible
  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Stock insuffisant pour la variante % (Disponible: %, Demandé: %)',
      p_variant_id, v_current_stock, p_quantity
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Décrémentation du stock de la variante
  v_new_variant_stock := v_current_stock - p_quantity;
  UPDATE public.product_variants
  SET stock = v_new_variant_stock
  WHERE id = p_variant_id;

  -- 4. Recalcul et mise à jour du stock total du produit parent
  SELECT COALESCE(SUM(stock), 0) INTO v_new_total_stock
  FROM public.product_variants
  WHERE product_id = p_product_id;

  UPDATE public.products
  SET total_stock = v_new_total_stock
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'productId', p_product_id,
    'variantId', p_variant_id,
    'newVariantStock', v_new_variant_stock,
    'newTotalStock', v_new_total_stock
  );
END;
$$;

-- ==============================================================================
-- 5. BUCKET SUPABASE STORAGE : PRODUCT-IMAGES (WEBP & ASSETS)
-- ==============================================================================

-- 5.1 Création du bucket public product-images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 Mo max
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/svg+xml'];

-- ==============================================================================
-- 6. VERROUILLAGE ROW LEVEL SECURITY (RLS) STRICT
-- ==============================================================================

-- 6.1 Activation RLS sur toutes les tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wilayas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Supprimer d'anciennes politiques permissives s'il y en avait
DROP POLICY IF EXISTS "Public select orders" ON public.orders;
DROP POLICY IF EXISTS "Public update orders" ON public.orders;
DROP POLICY IF EXISTS "Public delete orders" ON public.orders;
DROP POLICY IF EXISTS "Public insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admin select orders" ON public.orders;
DROP POLICY IF EXISTS "Admin update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin delete orders" ON public.orders;

-- 6.2 POLITIQUES SUR ORDERS :
-- Les visiteurs anonymes (et le service_role) peuvent uniquement CRÉER une commande
CREATE POLICY "Public insert orders" ON public.orders
  FOR INSERT
  WITH CHECK (true);

-- SEULS les administrateurs authentifiés peuvent LIRE les commandes
CREATE POLICY "Admin select orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

-- SEULS les administrateurs authentifiés peuvent MODIFIER les commandes (statuts, notes)
CREATE POLICY "Admin update orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SEULS les administrateurs authentifiés peuvent SUPPRIMER des commandes
CREATE POLICY "Admin delete orders" ON public.orders
  FOR DELETE
  TO authenticated
  USING (true);

-- 6.3 POLITIQUES SUR PRODUCTS & PRODUCT_VARIANTS :
-- Lecture publique pour tous les clients
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Admin write products" ON public.products;
CREATE POLICY "Public read products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Admin write products" ON public.products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admin write product_variants" ON public.product_variants;
CREATE POLICY "Public read product_variants" ON public.product_variants
  FOR SELECT USING (true);

CREATE POLICY "Admin write product_variants" ON public.product_variants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6.4 POLITIQUES SUR STORE_CONFIG & WILAYAS :
DROP POLICY IF EXISTS "Public read store_config" ON public.store_config;
DROP POLICY IF EXISTS "Admin write store_config" ON public.store_config;
CREATE POLICY "Public read store_config" ON public.store_config
  FOR SELECT USING (true);

CREATE POLICY "Admin write store_config" ON public.store_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read wilayas" ON public.wilayas;
DROP POLICY IF EXISTS "Admin write wilayas" ON public.wilayas;
CREATE POLICY "Public read wilayas" ON public.wilayas
  FOR SELECT USING (true);

CREATE POLICY "Admin write wilayas" ON public.wilayas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6.5 POLITIQUES SUR MARKETING_INTEGRATIONS :
DROP POLICY IF EXISTS "Public read marketing_integrations" ON public.marketing_integrations;
DROP POLICY IF EXISTS "Admin write marketing_integrations" ON public.marketing_integrations;
CREATE POLICY "Public read marketing_integrations" ON public.marketing_integrations
  FOR SELECT USING (true);

CREATE POLICY "Admin write marketing_integrations" ON public.marketing_integrations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6.6 POLITIQUES SUR STORAGE.OBJECTS (BUCKET PRODUCT-IMAGES) :
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;

CREATE POLICY "Public read product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated upload product images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated update product images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated delete product images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');

-- ==============================================================================
-- 7. ACTIVATION DE SUPABASE REALTIME
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'store_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.store_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'product_variants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
  END IF;
END $$;

-- ==============================================================================
-- 8. INSERTION INITIALE (SEED SQL) : CONFIGURATION & 58 WILAYAS
-- ==============================================================================

-- 8.1 Configuration White-Label par défaut
INSERT INTO public.store_config (
  id, store_name, store_tagline, logo_url, currency, phone, whatsapp_number,
  instagram_url, facebook_url, tiktok_url, free_shipping_threshold, free_shipping_enabled,
  theme, meta_pixel_id, tiktok_pixel_id, delivery_time_estimate, announcement_text, admin_pin
)
VALUES (
  'current',
  'Maison Céleste',
  'Haute Joaillerie & Couture d''Exception • Algérie',
  '/orlea-logo.svg',
  'DA',
  '0775 26 19 92',
  '+213775261992',
  'https://instagram.com/maisonceleste.dz',
  'https://facebook.com/maisonceleste.dz',
  'https://tiktok.com/@maisonceleste.dz',
  10000,
  false,
  '{"id": "rose-poudre", "name": "Rose Poudré (Signature)", "primary": "#D48C98", "primaryHover": "#C37985", "primaryLight": "#FDF4F5", "secondary": "#F9F1F0", "bgBase": "#FFFDFB", "accent": "#E05A6D"}'::jsonb,
  '',
  '',
  '24h à 48h ouvrées',
  '✨ LIVRAISON EXPRESS 58 WILAYAS • PAIEMENT CASH À LA LIVRAISON • PACKAGING DE LUXE OFFERT 🇩🇿 ✨',
  '1234'
)
ON CONFLICT (id) DO UPDATE SET
  store_name = EXCLUDED.store_name,
  store_tagline = EXCLUDED.store_tagline,
  whatsapp_number = EXCLUDED.whatsapp_number;

-- 8.2 Intégrations Marketing
INSERT INTO public.marketing_integrations (id, platform, pixel_id, enabled)
VALUES
  ('meta-pixel', 'meta', '', false),
  ('tiktok-pixel', 'tiktok', '', false)
ON CONFLICT (id) DO NOTHING;

-- 8.3 58 Wilayas d'Algérie
INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (1, '01', 'Adrar', 'أدرار', '["Adrar","Tamest","Charouine","Reggane","In Zghmir","Tit","Tsabit","Aoulef","Timokten","Fenoughil","Zaouiet Kounta","Akabli"]', 1200, 850, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (2, '02', 'Chlef', 'الشلف', '["Chlef","Ténès","Boukadir","Ouled Fares","Oued Fodda","Chettia","Sidi Akkacha","Abou El Hassan","Taougrit","Zeboudja","Beni Haoua","El Karimia"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (3, '03', 'Laghouat', 'الأغواط', '["Laghouat","Aflou","Ksar El Hirane","Aïn Madhi","Hassi R''Mel","Sidi Makhlouf","Brida","El Ghicha","Oued M''Zi","Gueltat Sidi Saad"]', 900, 600, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (4, '04', 'Oum El Bouaghi', 'أم البواقي', '["Oum El Bouaghi","Aïn Beïda","Aïn M''lila","Aïn Fakroun","Sigus","Meskiyana","Fkirina","Souk Naamane","Ksar Sbahi"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (5, '05', 'Batna', 'باتنة', '["Batna","Barika","Aïn Touta","Arris","Merouana","N''Gaous","Tazoult","El Madher","Menaa","Ras El Aïoun","Chemora","Théniet El Abed"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (6, '06', 'Béjaïa', 'بجاية', '["Béjaïa","Akbou","Amizour","Kherrata","Sidi Aïch","El Kseur","Tichy","Aokas","Seddouk","Tazmalt","Adekar","Barbacha"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (7, '07', 'Biskra', 'بسكرة', '["Biskra","Tolga","Sidi Okba","Chetma","El Kantara","Zeribet El Oued","M''Chouneche","Foughala","Ourlal","Lioua"]', 850, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (8, '08', 'Béchar', 'بشار', '["Béchar","Kenadsa","Abadla","Taghit","Béni Ounif","Tabelbala","Erg Ferradj","Mechraa Houari Boumedienne"]', 1100, 750, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (9, '09', 'Blida', 'البليدة', '["Blida","Boufarik","Ouled Yaïch","Beni Mered","Bougara","Mouzaïa","El Affroun","Meftah","Larbaâ","Oued El Alleug","Chiffa","Soumaa"]', 500, 350, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (10, '10', 'Bouira', 'البويرة', '["Bouira","Lakhdaria","Sour El Ghozlane","Aïn Bessem","M''Chedallah","Kadiria","Bir Ghbalou","Bechloul","El Hachimia","Haizer"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (11, '11', 'Tamanrasset', 'تمنراست', '["Tamanrasset","Abalessa","In Amguel","Idles","Tazrouk"]', 1400, 950, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (12, '12', 'Tébessa', 'تبسة', '["Tébessa","Chéria","El Ouenza","Bir El Ater","Morsott","Negrine","El Aouinet","Boukhadra","Bekkaria"]', 800, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (13, '13', 'Tlemcen', 'تلمسان', '["Tlemcen","Mansourah","Maghnia","Remchi","Ghazaouet","Nedroma","Chetouane","Sebdou","Hennaya","Ouled Mimoun","Ben Sekrane"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (14, '14', 'Tiaret', 'تيارت', '["Tiaret","Sougueur","Frenda","Ksar Chellala","Mahdia","Rahouia","Mechraa Safa","Dahmouni","Aïn Deheb"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (15, '15', 'Tizi Ouzou', 'تيزي وزو', '["Tizi Ouzou","Azazga","Draa Ben Khedda","Tigzirt","Boghnni","Larbaâ Nath Irathen","Aïn El Hammam","Ouadhia","Mekla","Azeffoun","Beni Douala"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (16, '16', 'Alger', 'الجزائر', '["Alger Centre","Sidi M''Hamed","El Madania","Belouizdad","Bab El Oued","Casbah","Oued Koriche","Bir Mourad Raïs","El Biar","Bouzareah","Hydra","Ben Aknoun","El Mouradia","Kouba","Bachedjerrah","Bourouba","Hussein Dey","Mohammadia","Bab Ezzouar","Bordj El Kiffan","Bordj El Bahri","Dar El Beïda","El Harrach","Baraki","Ain Naadja","Ain Taya","Zeralda","Staoueli","Ain Benian","Cheraga","Beni Messous","Dely Ibrahim","Draria","Saoula","Douera","Birtouta","Rouiba","Reghaia"]', 400, 250, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (17, '17', 'Djelfa', 'الجلفة', '["Djelfa","Aïn Oussera","Messaad","Hassi Bahbah","Birine","Dar Chioukh","Charef","El Idrissia","Faid El Botma","Had Sahary"]', 800, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (18, '18', 'Jijel', 'جيجل', '["Jijel","Taher","El Milia","El Ancer","Chekfa","Ziama Mansouriah","Sidi Abdelaziz","Texenna","Settara"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (19, '19', 'Sétif', 'سطيف', '["Sétif","El Eulma","Aïn Oulmene","Aïn Arnat","Aïn Azel","Bougaa","Amoucha","Beni Aziz","Salah Bey","Guellal","Babor"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (20, '20', 'Saïda', 'سعيدة', '["Saïda","Aïn El Hadjar","Youb","Sidi Boubekeur","Ouled Brahim","Hassasna","Moulay Larbi"]', 800, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (21, '21', 'Skikda', 'سكيكدة', '["Skikda","Collo","Azzaba","El Harrouch","Tamalous","Ramdane Djamel","Ben Azzouz","Sidi Mezghiche","Ain Charchar"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (22, '22', 'Sidi Bel Abbès', 'سيدي بلعباس', '["Sidi Bel Abbès","Telagh","Sfisef","Ben Badis","Sidi Lahcene","Tenira","Marhoum","Ras El Ma","Tessala"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (23, '23', 'Annaba', 'عنابة', '["Annaba","El Bouni","El Hadjar","Sidi Amar","Berrahal","Ain El Berda","Chetaibi","Seraidi"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (24, '24', 'Guelma', 'قالمة', '["Guelma","Oued Zenati","Bouchegouf","Héliopolis","Guelaat Bou Sbaa","Ain Makhlouf","Belkheir","Hammam Debagh"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (25, '25', 'Constantine', 'قسنطينة', '["Constantine","El Khroub","Hamma Bouziane","Didouche Mourad","Zighoud Youcef","Ain Smara","Ali Mendjeli","Ibn Ziad","Ouled Rahmoune"]', 650, 400, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (26, '26', 'Médéa', 'المدية', '["Médéa","Berrouaghia","Ksar El Boukhari","Beni Slimane","Tablat","Ouzera","Ain Boucif","Chahbounia","Seghouane"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (27, '27', 'Mostaganem', 'مستغانم', '["Mostaganem","Ain Tedeles","Sidi Ali","Hassi Mameche","Mesra","Bouguirat","Achaacha","Khadra","Sayada"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (28, '28', 'M''Sila', 'المسيلة', '["M''Sila","Bou Saâda","Sidi Aïssa","Magra","Berhoum","Ain El Hadjel","Ouled Derradj","Hammam Dhalaa","Chellal"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (29, '29', 'Mascara', 'معسكر', '["Mascara","Sig","Mohammadia","Tighennif","Ghriss","Oued El Abtal","Aouf","Zahana","Bouhanifia"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (30, '30', 'Ouargla', 'ورقلة', '["Ouargla","Hassi Messaoud","Rouissat","Ain El Beida","N''Goussa","Sidi Khouiled","El Borma"]', 950, 650, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (31, '31', 'Oran', 'وهران', '["Oran","Bir El Djir","Es Senia","Arzew","Ain El Turk","Bethioua","Gdyel","Boutlelis","Mers El Kebir","Oued Tlelat","El Kerma","Hassi Bounif"]', 600, 400, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (32, '32', 'El Bayadh', 'البيض', '["El Bayadh","Rogassa","Brezina","Bougtob","El Abiodh Sidi Cheikh","Labiodh Sidi Cheikh","Cheguig","Kef El Ahmar"]', 950, 650, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (33, '33', 'Illizi', 'إيليزي', '["Illizi","In Amenas","Bordj Omar Driss","Debdeb"]', 1400, 950, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (34, '34', 'Bordj Bou Arréridj', 'برج بوعريريج', '["Bordj Bou Arréridj","Ras El Oued","Mansoura","Medjana","El Achir","Bordj Zemoura","Bir Kasdali","Ain Taghrout"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (35, '35', 'Boumerdès', 'بومرداس', '["Boumerdès","Zemmouri","Khemis El Khechna","Boudouaou","Dellys","Thénia","Isser","Baghlia","Si Mustapha","Corso","Tidjelabine"]', 500, 350, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (36, '36', 'El Tarf', 'الطارف', '["El Tarf","Ben M''Hidi","Besbes","El Kala","Drean","Bouhadjar","Ain El Assel","Chebaita Mokhtar"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (37, '37', 'Tindouf', 'تندوف', '["Tindouf","Oum El Assel"]', 1400, 950, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (38, '38', 'Tissemsilt', 'تيسمسيلt', '["Tissemsilt","Khemisti","Theniet El Had","Bordj Bounaama","Lardjem","Layoune","Ammari"]', 750, 500, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (39, '39', 'El Oued', 'الوادي', '["El Oued","Robbah","Guemar","Debila","Kouinine","Bayadha","Reguiba","Hassi Khalifa","Taghzout","Magrane"]', 950, 650, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (40, '40', 'Khenchela', 'خنشلة', '["Khenchela","Kais","Chechar","Bouhmama","El Hamma","Babar","Ouled Rechache","Baghai"]', 800, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (41, '41', 'Souk Ahras', 'سوق أهراس', '["Souk Ahras","Sedrata","M''Daourouch","Taoura","Mechroha","Ouled Driss","Heddada"]', 800, 550, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (42, '42', 'Tipaza', 'تيبازة', '["Tipaza","Cherchell","Kolea","Bou Ismail","Hadjout","Gouraya","Fouka","Douaouda","Ahmer El Ain","Damous","Sidi Amar"]', 500, 350, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (43, '43', 'Mila', 'ميلة', '["Mila","Chelghoum Laid","Ferdjioua","Tadjenanet","Grarem Gouga","Oued Endja","Teleghma","Rouached"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (44, '44', 'Aïn Defla', 'عين الدفلى', '["Aïn Defla","Khemis Miliana","Miliana","El Attaf","Djelida","Al Abadia","Hammam Righa","Boumedfaa","Rouina"]', 650, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (45, '45', 'Naâma', 'النعامة', '["Naâma","Mécheria","Aïn Sefra","Tiout","Sfissifa","Moghrar","Asla","Djenienne Bourezg"]', 1000, 700, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (46, '46', 'Aïn Témouchent', 'عين تموشنت', '["Aïn Témouchent","Béni Saf","Hammam Bou Hadjar","El Malah","Chaabat El Leham","Ain El Arbaa","Oulhaca El Gheraba"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (47, '47', 'Ghardaïa', 'غرداية', '["Ghardaïa","Bounoura","El Guerara","Berriane","Metlili","Dhayet Bendhahoua","Zelfana","Sebseb"]', 900, 600, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (48, '48', 'Relizane', 'غليزان', '["Relizane","Oued Rhiou","Mazouna","Zemmora","Djidioua","Yellel","Sidi M''Hamed Ben Ali","El Matmar","Ammi Moussa"]', 700, 450, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (49, '49', 'Timimoun', 'تيميمون', '["Timimoun","Aougrout","Deldoul","Ksar Kaddour","Tinerkouk","Ouled Said"]', 1250, 850, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (50, '50', 'Bordj Badji Mokhtar', 'برج باجي مختار', '["Bordj Badji Mokhtar","Timiaouine"]', 1500, 1100, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (51, '51', 'Ouled Djellal', 'أولاد جلال', '["Ouled Djellal","Sidi Khaled","Ras El Miaad","Doucen","Ech Chaiba","Besbes"]', 850, 600, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (52, '52', 'Béni Abbès', 'بني عباس', '["Béni Abbès","Kerzaz","El Ouata","Tabelbala","Ouled Khoudir","Ksabi","Tamtert"]', 1250, 850, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (53, '53', 'In Salah', 'عين صالح', '["In Salah","In Ghar","Foggaret Ezzaouia"]', 1350, 900, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (54, '54', 'In Guezzam', 'عين قزام', '["In Guezzam","Tin Zaouatine"]', 1500, 1100, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (55, '55', 'Touggourt', 'تقرت', '["Touggourt","Nezla","Tebesbest","Megarine","Taibet","Temacine","El Hadjira","Blidet Amor"]', 950, 650, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (56, '56', 'Djanet', 'جانت', '["Djanet","Bordj El Haouas"]', 1500, 1100, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (57, '57', 'El M''Ghair', 'المغير', '["El M''Ghair","Djamaa","Oum Touyour","Sidi Amrane","Still","Tendla","Mrara"]', 950, 650, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

INSERT INTO public.wilayas (id, code, name, ar_name, communes, home_delivery_price, stop_desk_price, is_deliverable)
VALUES (58, '58', 'El Meniaa', 'المنيعة', '["El Meniaa","Hassi Gara","Hassi Fehal"]', 1100, 750, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, ar_name = EXCLUDED.ar_name, communes = EXCLUDED.communes, home_delivery_price = EXCLUDED.home_delivery_price, stop_desk_price = EXCLUDED.stop_desk_price;

-- ==============================================================================
-- 9. INSERTION INITIALE (SEED SQL) : CATALOGUE DES PRODUITS & VARIANTES
-- ==============================================================================
INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-001',
  'Collier cœur doré',
  'collier-coeur-dore',
  'Colliers & Pendentifs',
  'Collier raffiné en or 18k orné d''un pendentif cœur délicat sur fine chaîne dorée. Symbole intemporel d''amour et d''élégance.',
  'Sublime collier en or 18 carats avec pendentif cœur sculpté et finition miroir haute brillance. Une pièce emblématique qui apporte une touche de douceur et d''éclat à toutes vos tenues de fête ou du quotidien.

Livré dans son écrin de luxe Maison Céleste avec certificat d''authenticité.',
  '["Pendentif cœur finition or 18 carats anti-ternissement","Chaîne maille forçat diamantée très solide et hypoallergénique","Longueur réglable : 42 cm + 5 cm d''extension de confort","Résistant à l''eau et aux parfums du quotidien","Écrin prestige et pochon en velours offerts"]',
  1700,
  2200,
  '["/images/products/collier-coeur-dore-1.jpg","/images/products/collier-coeur-dore-2.jpg"]',
  '[{"name":"Doré Or 18k","hex":"#D4AF37","imageIndex":0}]',
  '["Standard Ajustable (42-47 cm)"]',
  25,
  5,
  48,
  true,
  true,
  '-23%',
  '2026-03-01'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v1',
  'prod-001',
  'Doré Or 18k',
  '#D4AF37',
  'Standard Ajustable (42-47 cm)',
  25,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-002',
  'Collier pendentif rond',
  'collier-pendentif-rond',
  'Colliers & Pendentifs',
  'Collier médaille ronde ciselée en or jaune 18k avec reflets scintillants. Un médaillon chic et moderne.',
  'La pureté des lignes géométriques alliée à l''élégance de l''or. Ce collier met en valeur un médaillon circulaire poli avec liseré travaillé qui capte chaque rayon de lumière. Parfait seul ou superposé.',
  '["Médaillon rond or 18k ciselé haute précision","Chaîne gourmette fine avec fermoir sécurisé","Acier inoxydable chirurgical étanche 316L","Longueur adaptable selon vos décolletés"]',
  1900,
  2500,
  '["/images/products/collier-pendentif-rond-1.jpg","/images/products/collier-pendentif-rond-2.jpg"]',
  '[{"name":"Doré Or 18k","hex":"#D4AF37","imageIndex":0}]',
  '["Standard Ajustable (45 cm)"]',
  20,
  4.9,
  36,
  true,
  true,
  '-24%',
  '2026-03-02'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v2',
  'prod-002',
  'Doré Or 18k',
  '#D4AF37',
  'Standard Ajustable (45 cm)',
  20,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-003',
  'Bracelet perles blanches',
  'bracelet-perles-blanches',
  'Bracelets & Joncs',
  'Somptueux bracelet de perles blanches naturelles d''eau douce rehaussé d''un fermoir délicat en or. Douceur et pureté absolue.',
  'Une merveille de délicatesse. Ce bracelet est composé de perles blanches d''eau douce sélectionnées pour leur nacre lustrée et leur éclat naturel. Il apporte une grâce incomparable à votre poignet pour les mariages et occasions spéciales.',
  '["Véritables perles blanches baroques lustrées de première qualité","Fermoir mousqueton doré or fin 18k avec chaînette de réglage","Montage sur fil de soie tressé ultra-résistant","Confortable et léger au quotidien"]',
  2500,
  3200,
  '["/images/products/bracelet-perles-blanches-1.jpg","/images/products/bracelet-perles-blanches-2.jpg"]',
  '[{"name":"Perles Blanches & Or","hex":"#FAF9F6","imageIndex":0}]',
  '["Taille Ajustable (16-21 cm)"]',
  18,
  5,
  52,
  true,
  true,
  '-22%',
  '2026-03-03'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v3',
  'prod-003',
  'Perles Blanches & Or',
  '#FAF9F6',
  'Taille Ajustable (16-21 cm)',
  18,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-004',
  'Bracelet chaîne dorée',
  'bracelet-chaine-doree',
  'Bracelets & Joncs',
  'Bracelet fin en maille dorée étincelante plaqué or 18k. Parfait à porter seul ou en accumulation.',
  'L''accessoire intemporel par excellence. Ce bracelet chaîne en maillons forçat diamantés sublime votre poignet avec subtilité et modernité. Résiste à l''eau et conserve sa brillance jour après jour.',
  '["Maille forçat diamantée en acier chirurgical plaqué or 18k","Longueur 17 cm avec rallonge de 4 cm pour tous les poignets","Anti-ternissement et hypoallergénique","Fermoir mousqueton renforcé"]',
  1800,
  2300,
  '["/images/products/bracelet-chaine-doree-1.jpg","/images/products/bracelet-chaine-doree-2.jpg"]',
  '[{"name":"Doré Or 18k","hex":"#D4AF37","imageIndex":0}]',
  '["Longueur Ajustable (17-21 cm)"]',
  22,
  4.8,
  29,
  true,
  true,
  '-22%',
  '2026-03-04'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v4',
  'prod-004',
  'Doré Or 18k',
  '#D4AF37',
  'Longueur Ajustable (17-21 cm)',
  22,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-005',
  'Bague en or avec pierre rouge',
  'bague-en-or-pierre-rouge',
  'Bagues & Alliances',
  'Bague majestueuse en or 18k sertie d''un rubis rouge éclatant entouré d''un halo de micro-zircones taille diamant.',
  'Une création digne de la haute joaillerie. La pierre centrale rouge rubis facettée capte la lumière avec intensité, magnifiée par une couronne scintillante de micro-oxydes de zirconium. La bague parfaite pour marquer les moments inoubliables.',
  '["Pierre centrale ovale rouge rubis intense 8x6 mm","Pavage halo d''oxydes de zirconium AAA+ taille brillant","Monture solide plaquée or 18k garantie anti-oxydation","Anneau ajustable ergonomique pour un confort optimal"]',
  2600,
  3500,
  '["/images/products/bague-or-pierre-rouge-1.jpg","/images/products/bague-or-pierre-rouge-2.jpg"]',
  '[{"name":"Or 18k & Rubis Rouge","hex":"#B22222","imageIndex":0}]',
  '["Taille Ajustable (52 à 58)","Taille 54 Fixe","Taille 56 Fixe"]',
  30,
  5,
  44,
  true,
  true,
  '-26%',
  '2026-03-05'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v5-1',
  'prod-005',
  'Or 18k & Rubis Rouge',
  '#B22222',
  'Taille Ajustable (52 à 58)',
  15,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v5-2',
  'prod-005',
  'Or 18k & Rubis Rouge',
  '#B22222',
  'Taille 54 Fixe',
  8,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v5-3',
  'prod-005',
  'Or 18k & Rubis Rouge',
  '#B22222',
  'Taille 56 Fixe',
  7,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-006',
  'Bague solitaire argentée',
  'bague-solitaire-argentee',
  'Bagues & Alliances',
  'Bague solitaire en argent 925 rhodié avec diamant de synthèse 4 griffes d''un éclat spectaculaire. L''alliance parfaite.',
  'L''élégance pure et éternelle du solitaire. Montée sur un anneau en argent fin rhodié anti-oxydation, la pierre centrale facettée offre les feux et le scintillement d''un vrai diamant. Le choix numéro 1 pour fiançailles et cadeaux précieux.',
  '["Pierre solitaire taille brillant 58 facettes","Monture classique 4 griffes en argent fin 925 rhodié","Éclat diamant étincelant garanti","Livrées dans son écrin de velours Maison Céleste"]',
  2400,
  3100,
  '["/images/products/bague-solitaire-argentee-1.jpg","/images/products/bague-solitaire-argentee-2.jpg"]',
  '[{"name":"Argent 925 Pur","hex":"#C0C0C0","imageIndex":0}]',
  '["Taille Ajustable (52 à 58)","Taille 54 Fixe","Taille 56 Fixe"]',
  34,
  4.9,
  38,
  true,
  true,
  '-23%',
  '2026-03-06'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v6-1',
  'prod-006',
  'Argent 925 Pur',
  '#C0C0C0',
  'Taille Ajustable (52 à 58)',
  16,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v6-2',
  'prod-006',
  'Argent 925 Pur',
  '#C0C0C0',
  'Taille 54 Fixe',
  10,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v6-3',
  'prod-006',
  'Argent 925 Pur',
  '#C0C0C0',
  'Taille 56 Fixe',
  8,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-007',
  'Coffret cadeau bijoux',
  'coffret-cadeau-bijoux',
  'Coffrets & Packs',
  'Coffret cadeau de prestige composé d''une parure collier et boucles d''oreilles dorées, dans un écrin rose poudré avec ruban satiné.',
  'Le cadeau d''exception prêt à offrir. Ce coffret luxueux réunit un collier pendentif fleur et ses boucles d''oreilles assorties en or 18k, lovés dans un coussin en velours blanc doux, habillé d''un ruban satiné haut de gamme. Effet wahou garanti au déballage.',
  '["Parure complète : 1 collier pendentif doré + 1 paire de boucles d''oreilles assorties","Écrin rigide rose poudré avec finitions dorées et ruban noué","Carte personnalisée de vœux offerte","Sac cadeau de présentation boutique inclus"]',
  3900,
  4900,
  '["/images/products/coffret-cadeau-bijoux-1.jpg","/images/products/coffret-cadeau-bijoux-2.jpg"]',
  '[{"name":"Coffret Rose Poudré & Doré","hex":"#FADADD","imageIndex":0}]',
  '["Coffret Parure Complète"]',
  15,
  5,
  65,
  true,
  true,
  '-20%',
  '2026-03-07'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v7',
  'prod-007',
  'Coffret Rose Poudré & Doré',
  '#FADADD',
  'Coffret Parure Complète',
  15,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-008',
  'Coffret parfum de luxe',
  'coffret-parfum-de-luxe',
  'Coffrets & Packs',
  'Eau de parfum envoûtante aux notes florales et ambrées dans son flacon de cristal taillé avec son coffret signature doré.',
  'Une fragrance sophistiquée qui laisse un sillage inoubliable. Alliant la fraîcheur de la bergamote, la noblesse du jasmin impérial et la sensualité du bois d''ambre, ce parfum incarne la féminité moderne et le luxe absolu. Présenté dans un flacon sculptural avec bouchon or ciselé.',
  '["Eau de parfum concentrée 100 ml longue tenue (plus de 24h)","Pyramide olfactive : Jasmin d''Orient, Vanille de Madagascar, Ambre Précieux","Flacon en verre cristallin lourd avec capuchon magnétique doré","Boîte coffret rigide gaufrée or ornée du sceau de la maison"]',
  4500,
  5800,
  '["/images/products/coffret-parfum-1.jpg","/images/products/coffret-parfum-2.jpg"]',
  '[{"name":"Flacon Cristal & Or","hex":"#E5C158","imageIndex":0}]',
  '["Flacon 100 ml"]',
  18,
  4.9,
  41,
  true,
  true,
  '-22%',
  '2026-03-08'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v8',
  'prod-008',
  'Flacon Cristal & Or',
  '#E5C158',
  'Flacon 100 ml',
  18,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-009',
  'Montre élégante pour femme',
  'montre-elegante-femme',
  'Montres & Accessoires',
  'Montre féminine raffinée avec bracelet maillons dorés polis et cadran blanc épuré. Mouvement à quartz de haute précision.',
  'L''alliance parfaite de l''horlogerie et de la joaillerie. Cette montre habille le poignet d''une allure aristocratique avec son bracelet articulé en acier chirurgical doré or jaune et son cadran minimaliste orné d''index dorés. Étanche et résistante aux chocs.',
  '["Mouvement à quartz japonais de haute précision","Verre minéral trempé inrayable","Bracelet en acier inoxydable poli plaqué or 18k ajustable","Fermoir déployant papillon invisible","Garantie horlogère 1 an incluse"]',
  3800,
  4800,
  '["/images/products/montre-elegante-femme-1.jpg","/images/products/montre-elegante-femme-2.jpg"]',
  '[{"name":"Doré Or 18k & Cadran Blanc","hex":"#D4AF37","imageIndex":0}]',
  '["Cadran 32 mm (Maillons ajustables)"]',
  14,
  4.9,
  33,
  true,
  true,
  '-21%',
  '2026-03-09'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v9',
  'prod-009',
  'Doré Or 18k & Cadran Blanc',
  '#D4AF37',
  'Cadran 32 mm (Maillons ajustables)',
  14,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-010',
  'Sac en cuir noir',
  'sac-en-cuir-noir',
  'Montres & Accessoires',
  'Sac à main structuré en cuir noir premium avec fermoir et finitions métalliques dorées. Bandoulière amovible et poignée élégante.',
  'Le sac iconique indispensable à toute garde-robe chic. Confectionné dans un cuir grainé de haute qualité, il présente une silhouette trapèze structurée, une poignée rigide et un fermoir bijou doré. Son intérieur compartimenté accueille aisément tous vos essentiels.',
  '["Cuir synthétique grainé haut de gamme résistant à l''usure","Attaches et fermoirs métalliques massifs plaqués or","Double portée : main avec poignée rigide ou épaule avec bandoulière réglable","Poche intérieure zippée et doublure textile satinée"]',
  4900,
  6500,
  '["/images/products/sac-cuir-noir-1.jpg","/images/products/sac-cuir-noir-2.jpg"]',
  '[{"name":"Noir Ébène & Métal Doré","hex":"#1C1C1C","imageIndex":0}]',
  '["Taille Unique (26 x 19 x 10 cm)"]',
  12,
  5,
  47,
  true,
  true,
  '-25%',
  '2026-03-10'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v10',
  'prod-010',
  'Noir Ébène & Métal Doré',
  '#1C1C1C',
  'Taille Unique (26 x 19 x 10 cm)',
  12,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-011',
  'Caftan rouge brodé doré',
  'caftan-rouge-brode-dore',
  'Caftans & Prêt-à-Porter',
  'Somptueux caftan royal en velours de soie rouge rubis, richement orné de broderies dorées au fil de skalli et sfifa traditionnelle.',
  'Une pièce maîtresse de la haute couture traditionnelle algérienne. Taillé dans un velours de soie lourd couleur rouge rubis impérial, ce caftan est brodé à la main au fil d''or skalli pur. Il est rehaussé de boutons aâkads dorés sur toute la longueur et fourni avec sa ceinture mdamma dorée assortie pour cintrer la silhouette avec majesté.',
  '["Velours de soie premium rouge rubis au tombé fluide et somptueux","Broderies dorées artisanales au fil de skalli résistant","Sfifa et aâkads dorés travaillés à la main","Ceinture mdamma assortie ajustable incluse","Idéal pour mariages, fiançailles et fêtes traditionnelles algériennes"]',
  14500,
  18000,
  '["/images/products/caftan-rouge-1.jpg","/images/products/caftan-rouge-2.jpg"]',
  '[{"name":"Rouge Rubis & Or Skalli","hex":"#8B0000","imageIndex":0}]',
  '["M (38-40)","L (42-44)","XL (46)","Sur Mesure"]',
  23,
  5,
  59,
  true,
  true,
  '-19%',
  '2026-03-11'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v11-1',
  'prod-011',
  'Rouge Rubis & Or Skalli',
  '#8B0000',
  'M (38-40)',
  6,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v11-2',
  'prod-011',
  'Rouge Rubis & Or Skalli',
  '#8B0000',
  'L (42-44)',
  5,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v11-3',
  'prod-011',
  'Rouge Rubis & Or Skalli',
  '#8B0000',
  'XL (46)',
  4,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v11-4',
  'prod-011',
  'Rouge Rubis & Or Skalli',
  '#8B0000',
  'Sur Mesure',
  8,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.products (
  id, title, slug, category, short_description, description, bullet_points,
  price, compare_at_price, images, colors, sizes, total_stock, rating, review_count,
  is_featured, is_active, badge, created_at
) VALUES (
  'prod-012',
  'Robe de soirée noire',
  'robe-soiree-noire',
  'Caftans & Prêt-à-Porter',
  'Robe longue de soirée noire chic et vaporeuse. Coupe flatteuse et dos sublime pour vos mariages et réceptions d''exception.',
  'L''incarnation du glamour moderne. Cette robe longue noire épouse subtilement la taille avant de s''évaser en un drapé gracieux jusqu''au sol. Son tissu crêpe georgette de qualité supérieure offre un tombé fluide et une allure sensationnelle sous les projecteurs.',
  '["Tissu crêpe georgette haut de gamme doublé, non transparent","Coupe fluide et élégante qui allonge la silhouette","Fermeture zippée invisible au dos avec finitions haute couture","Confortable et légère à porter toute la soirée"]',
  8500,
  11000,
  '["/images/products/robe-soiree-noire-1.jpg","/images/products/robe-soiree-noire-2.jpg"]',
  '[{"name":"Noir Profond","hex":"#111111","imageIndex":0}]',
  '["S (36)","M (38)","L (40)","XL (42)"]',
  28,
  4.9,
  37,
  true,
  true,
  '-23%',
  '2026-03-12'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  images = EXCLUDED.images,
  colors = EXCLUDED.colors,
  sizes = EXCLUDED.sizes,
  total_stock = EXCLUDED.total_stock;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v12-1',
  'prod-012',
  'Noir Profond',
  '#111111',
  'S (36)',
  8,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v12-2',
  'prod-012',
  'Noir Profond',
  '#111111',
  'M (38)',
  10,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v12-3',
  'prod-012',
  'Noir Profond',
  '#111111',
  'L (40)',
  6,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

INSERT INTO public.product_variants (
  id, product_id, color_name, color_hex, size, stock, sku, image
) VALUES (
  'v12-4',
  'prod-012',
  'Noir Profond',
  '#111111',
  'XL (42)',
  4,
  NULL,
  NULL
) ON CONFLICT (id) DO UPDATE SET
  stock = EXCLUDED.stock,
  color_name = EXCLUDED.color_name,
  color_hex = EXCLUDED.color_hex,
  size = EXCLUDED.size;

