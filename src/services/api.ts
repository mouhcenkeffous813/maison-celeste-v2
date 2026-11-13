import { Product, ProductVariant, Order, OrderStatus, Wilaya, StoreConfig, Review } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockProducts';
import { INITIAL_ORDERS } from '../data/mockOrders';
import { INITIAL_REVIEWS } from '../data/mockReviews';
import { DEFAULT_STORE_CONFIG, applyThemeVariables } from '../config/store.config';
import rawWilayas from '../config/wilayas.json';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export const ITEMS_DELIMITER = '\n\n__MC_ITEMS_DATA__:';

// ===================== MAPPING PRODUITS & VARIANTES =====================
function mapDbToProduct(row: any): Product {
  const variants: ProductVariant[] = Array.isArray(row.product_variants)
    ? row.product_variants.map((v: any) => ({
        id: v.id,
        colorName: v.color_name,
        colorHex: v.color_hex,
        size: v.size,
        stock: Number(v.stock) || 0,
        sku: v.sku || undefined,
        image: v.image || undefined,
      }))
    : [];

  return {
    id: row.id,
    title: row.title,
    slug: row.slug || row.id,
    category: row.category,
    shortDescription: row.short_description || '',
    description: row.description || '',
    bulletPoints: Array.isArray(row.bullet_points) ? row.bullet_points : [],
    price: Number(row.price) || 0,
    compareAtPrice: Number(row.compare_at_price) || 0,
    images: Array.isArray(row.images) ? row.images : [],
    colors: Array.isArray(row.colors) ? row.colors : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    variants,
    totalStock: Number(row.total_stock) || variants.reduce((sum, v) => sum + v.stock, 0),
    rating: Number(row.rating) || 5.0,
    reviewCount: Number(row.review_count) || 0,
    isFeatured: Boolean(row.is_featured),
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : true,
    badge: row.badge || undefined,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapProductToDb(prod: Partial<Product>): any {
  const obj: any = {};
  if (prod.id !== undefined) obj.id = prod.id;
  if (prod.title !== undefined) obj.title = prod.title;
  if (prod.slug !== undefined) obj.slug = prod.slug;
  if (prod.category !== undefined) obj.category = prod.category;
  if (prod.shortDescription !== undefined) obj.short_description = prod.shortDescription;
  if (prod.description !== undefined) obj.description = prod.description;
  if (prod.bulletPoints !== undefined) obj.bullet_points = prod.bulletPoints;
  if (prod.price !== undefined) obj.price = prod.price;
  if (prod.compareAtPrice !== undefined) obj.compare_at_price = prod.compareAtPrice;
  if (prod.images !== undefined) obj.images = prod.images;
  if (prod.colors !== undefined) obj.colors = prod.colors;
  if (prod.sizes !== undefined) obj.sizes = prod.sizes;
  if (prod.totalStock !== undefined) obj.total_stock = prod.totalStock;
  if (prod.rating !== undefined) obj.rating = prod.rating;
  if (prod.reviewCount !== undefined) obj.review_count = prod.reviewCount;
  if (prod.isFeatured !== undefined) obj.is_featured = prod.isFeatured;
  if (prod.isActive !== undefined) obj.is_active = prod.isActive;
  if (prod.badge !== undefined) obj.badge = prod.badge;
  if (prod.createdAt !== undefined) obj.created_at = prod.createdAt;
  return obj;
}

// ===================== MAPPING COMMANDES =====================
function mapDbToOrder(row: any): Order {
  let parsedItems = Array.isArray(row.items) ? row.items : undefined;
  let cleanNotes = row.notes || undefined;

  // Extraction sécurisée des articles multiples depuis les notes
  if (!parsedItems && row.notes && typeof row.notes === 'string' && row.notes.includes(ITEMS_DELIMITER)) {
    try {
      const parts = row.notes.split(ITEMS_DELIMITER);
      cleanNotes = parts[0].trim() || undefined;
      parsedItems = JSON.parse(parts[1]);
    } catch (e) {
      console.warn('Échec parsing items de commande depuis notes', e);
    }
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    wilayaId: Number(row.wilaya_id),
    wilayaName: row.wilaya_name,
    commune: row.commune,
    address: row.address,
    deliveryType: (row.delivery_type as 'home' | 'desk') || 'home',
    productId: row.product_id,
    productTitle: row.product_title,
    productImage: row.product_image,
    selectedColor: row.selected_color || '',
    selectedSize: row.selected_size || '',
    quantity: Number(row.quantity) || 1,
    unitPrice: Number(row.unit_price) || 0,
    productTotal: Number(row.product_total) || 0,
    shippingFee: Number(row.shipping_fee) || 0,
    grandTotal: Number(row.grand_total) || 0,
    items: parsedItems,
    status: (row.status as OrderStatus) || 'pending',
    trackingCode: row.tracking_code || undefined,
    notes: cleanNotes,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function mapOrderToDb(order: Order) {
  let combinedNotes = order.notes || null;
  if (order.items && Array.isArray(order.items) && order.items.length > 0) {
    const rawNotes = order.notes ? order.notes.split(ITEMS_DELIMITER)[0] : '';
    combinedNotes = (rawNotes ? rawNotes + ITEMS_DELIMITER : ITEMS_DELIMITER) + JSON.stringify(order.items);
  }

  return {
    id: order.id,
    order_number: order.orderNumber,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    wilaya_id: order.wilayaId,
    wilaya_name: order.wilayaName,
    commune: order.commune,
    address: order.address,
    delivery_type: order.deliveryType,
    product_id: order.productId,
    product_title: order.productTitle,
    product_image: order.productImage,
    selected_color: order.selectedColor,
    selected_size: order.selectedSize,
    quantity: order.quantity,
    unit_price: order.unitPrice,
    product_total: order.productTotal,
    shipping_fee: order.shippingFee,
    grand_total: order.grandTotal,
    status: order.status,
    tracking_code: order.trackingCode || null,
    notes: combinedNotes,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function mapDbToWilaya(row: any): Wilaya {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: row.name,
    arName: row.ar_name || row.arName,
    communes: Array.isArray(row.communes) ? row.communes : [],
    homeDeliveryPrice: Number(row.home_delivery_price ?? row.homeDeliveryPrice ?? 600),
    stopDeskPrice: Number(row.stop_desk_price ?? row.stopDeskPrice ?? 350),
    isDeliverable: Boolean(row.is_deliverable ?? row.isDeliverable ?? true),
  };
}

function withTimeout<T>(promise: PromiseLike<T>, ms = 4000): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de connexion Supabase (${ms}ms)`)), ms)
    ),
  ]);
}

const STORAGE_KEYS = {
  ORDERS: 'celeste_orders_v10',
  WILAYAS: 'orlea_wilayas_v7',
  CONFIG: 'celeste_config_v10',
  REVIEWS: 'celeste_reviews_v10',
  CATEGORIES: 'celeste_categories_v10',
};

export const INITIAL_CATEGORIES: string[] = [
  'Colliers & Pendentifs',
  'Bracelets & Joncs',
  'Bagues & Alliances',
  'Coffrets & Packs',
  'Montres & Accessoires',
  'Caftans & Prêt-à-Porter',
];

// Helper: load from localStorage with fallback (pour cache de secours hors-ligne)
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[Storage] Failed to read ${key}, using fallback`, e);
    return fallback;
  }
}

// Helper: save to localStorage and dispatch custom event
function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('elissia_store_update', { detail: { key, data } }));
  } catch (e) {
    console.error(`[Storage] Failed to save ${key}`, e);
  }
}

/**
 * Service API V2
 * Communication directe avec Supabase PostgreSQL (Products, Orders, StoreConfig, Wilayas)
 * et exécution Edge Functions pour les commandes.
 */
export const api = {
  // ===================== PRODUCTS (CENTRALISÉS POSTGRESQL) =====================
  async getProducts(): Promise<Product[]> {
    if (supabase && isSupabaseConfigured) {
      try {
        const queryPromise = supabase
          .from('products')
          .select('*, product_variants(*)')
          .order('created_at', { ascending: false });

        const { data, error } = await withTimeout<any>(queryPromise, 4500);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map(mapDbToProduct);
        }
        if (error) {
          console.warn('[Supabase] Erreur récupération produits:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase] Exception ou timeout produits distants:', err);
      }
    }

    // Fallback propre en lecture sur mockProducts uniquement si Supabase non configuré ou vide
    return INITIAL_PRODUCTS;
  },

  async getProductById(id: string): Promise<Product | null> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, product_variants(*)')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return mapDbToProduct(data);
        }
      } catch (e) {
        console.warn('[Supabase] Erreur getProductById:', e);
      }
    }
    const products = await this.getProducts();
    return products.find(p => p.id === id) || null;
  },

  async createProduct(data: Omit<Product, 'id' | 'createdAt'>): Promise<Product> {
    const newId = `prod-${Date.now().toString(36)}`;
    const createdAt = new Date().toISOString().split('T')[0];
    const newProduct: Product = {
      ...data,
      id: newId,
      createdAt,
      slug: data.slug || `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    };

    if (supabase && isSupabaseConfigured) {
      try {
        // 1. Insérer le produit parent
        const parentPayload = mapProductToDb(newProduct);
        const { error: prodErr } = await supabase.from('products').insert([parentPayload]);
        if (prodErr) throw prodErr;

        // 2. Insérer les variantes associées
        if (newProduct.variants && newProduct.variants.length > 0) {
          const variantsPayload = newProduct.variants.map((v, i) => ({
            id: v.id || `v_${newId}_${i}`,
            product_id: newId,
            color_name: v.colorName,
            color_hex: v.colorHex,
            size: v.size,
            stock: v.stock,
            sku: v.sku || null,
            image: v.image || null,
          }));
          const { error: varErr } = await supabase.from('product_variants').insert(variantsPayload);
          if (varErr) console.warn('[Supabase] Erreur insertion variantes:', varErr.message);
        }

        console.log('[Supabase] Nouveau produit enregistré dans PostgreSQL:', newProduct.title);
        return newProduct;
      } catch (err: any) {
        console.error('[Supabase] Erreur critique création produit:', err);
        throw new Error(`Échec de création du produit dans Supabase: ${err.message}`);
      }
    }

    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    if (supabase && isSupabaseConfigured) {
      try {
        const dbPayload = mapProductToDb(updates);
        if (Object.keys(dbPayload).length > 0) {
          const { error } = await supabase.from('products').update(dbPayload).eq('id', id);
          if (error) throw error;
        }

        // Synchronisation des variantes si modifiées
        if (updates.variants && Array.isArray(updates.variants)) {
          await supabase.from('product_variants').delete().eq('product_id', id);
          const variantsPayload = updates.variants.map((v, i) => ({
            id: v.id || `v_${id}_${i}`,
            product_id: id,
            color_name: v.colorName,
            color_hex: v.colorHex,
            size: v.size,
            stock: v.stock,
            sku: v.sku || null,
            image: v.image || null,
          }));
          await supabase.from('product_variants').insert(variantsPayload);
        }

        console.log('[Supabase] Produit mis à jour dans PostgreSQL:', id);
      } catch (err: any) {
        console.error('[Supabase] Erreur mise à jour produit distant:', err);
      }
    }

    const fresh = await this.getProductById(id);
    if (fresh) return fresh;
    return { id, ...updates } as Product;
  },

  async deleteProduct(id: string): Promise<boolean> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        console.log('[Supabase] Produit supprimé de PostgreSQL:', id);
        return true;
      } catch (err) {
        console.error('[Supabase] Erreur suppression produit:', err);
        return false;
      }
    }
    return true;
  },

  // ===================== CATEGORIES (DYNAMIQUES DEPUIS PRODUITS) =====================
  async getCategories(): Promise<string[]> {
    const prods = await this.getProducts();
    const uniqueCats = Array.from(
      new Set([...INITIAL_CATEGORIES, ...prods.map(p => p.category).filter(Boolean)])
    );
    return uniqueCats;
  },

  async addCategory(name: string): Promise<string[]> {
    const cats = await this.getCategories();
    const clean = name.trim();
    if (!clean || cats.includes(clean)) return cats;
    return [...cats, clean];
  },

  async deleteCategory(name: string): Promise<string[]> {
    const cats = await this.getCategories();
    const filtered = cats.filter(c => c !== name);
    const fallbackCategory = filtered[0] || 'Général';

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('products')
          .update({ category: fallbackCategory })
          .eq('category', name);
      } catch (err) {
        console.warn('Erreur réattribution catégorie:', err);
      }
    }
    return filtered;
  },

  // ===================== ORDERS (EDGE FUNCTION & COD ALGERIE) =====================
  async getOrders(): Promise<Order[]> {
    if (supabase && isSupabaseConfigured) {
      try {
        const queryPromise = supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        const { data, error } = await withTimeout<any>(queryPromise, 4000);

        if (!error && Array.isArray(data)) {
          const cloudOrders = data.map(mapDbToOrder);
          try {
            localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(cloudOrders));
          } catch (e) {}
          return cloudOrders;
        }
      } catch (err) {
        console.warn('[Supabase] Délai dépassé commandes distantes, repli cache:', err);
      }
    }

    // Repli sur le stockage local
    return loadFromStorage<Order[]>(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
  },

  async getOrderById(id: string): Promise<Order | null> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!error && data) return mapDbToOrder(data);
      } catch (e) {}
    }
    const orders = await this.getOrders();
    return orders.find(o => o.id === id) || null;
  },

  async getOrdersByPhone(phone: string): Promise<Order[]> {
    const cleanQuery = phone.replace(/\s+/g, '');
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .ilike('customer_phone', `%${cleanQuery}%`)
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) return data.map(mapDbToOrder);
      } catch (e) {}
    }
    const orders = await this.getOrders();
    return orders.filter(o => o.customerPhone.replace(/\s+/g, '').includes(cleanQuery));
  },

  /**
   * Création de commande avec architecture hybride :
   * 1. Tentative d'appel de l'Edge Function Serverless 'create-order' (recalcul prix & Telegram)
   * 2. Fallback automatique sur insertion directe Supabase + RPC decrease_product_stock
   */
  async createOrder(
    data: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>
  ): Promise<Order> {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orderNumber = `CMD-DZ-${randomSuffix}`;

    const newOrder: Order = {
      ...data,
      id: uniqueId,
      orderNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. TENTATIVE VIA EDGE FUNCTION 'create-order'
    if (supabase && isSupabaseConfigured) {
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('create-order', {
          body: newOrder,
        });

        if (!edgeErr && edgeData && edgeData.success && edgeData.order) {
          console.log('[Edge Function] Commande validée et traitée côté serveur:', edgeData.order.orderNumber);
          const confirmed = edgeData.order;
          const currentOrders = await this.getOrders();
          saveToStorage(STORAGE_KEYS.ORDERS, [confirmed, ...currentOrders.filter(o => o.id !== confirmed.id)]);
          return confirmed;
        }
      } catch (edgeInvokeErr) {
        console.warn('[Edge Function] Fonction non disponible ou erreur, bascule vers insertion directe:', edgeInvokeErr);
      }

      // 2. FALLBACK INSERTION DIRECTE DANS SUPABASE POSTGRESQL
      try {
        const payload = mapOrderToDb(newOrder);
        const { error } = await supabase
          .from('orders')
          .insert([payload]);

        if (error) {
          console.error('[Supabase] Erreur critique insertion commande distante:', error);
          throw new Error(`Échec de validation de la commande dans la base centrale: ${error.message}`);
        }

        const confirmedOrder = newOrder;

        // Décrémentation atomique du stock via RPC Supabase
        const itemsToDeduct = (data.items && data.items.length > 0)
          ? data.items
          : [{
              productId: data.productId,
              selectedColor: data.selectedColor,
              selectedSize: data.selectedSize,
              quantity: data.quantity,
            }];

        for (const item of itemsToDeduct) {
          try {
            const product = await this.getProductById(item.productId);
            const variant = product?.variants.find(
              v => v.colorName === item.selectedColor && v.size === item.selectedSize
            );
            if (variant) {
              await supabase.rpc('decrease_product_stock', {
                p_product_id: item.productId,
                p_variant_id: variant.id,
                p_quantity: item.quantity,
              });
            }
          } catch (rpcErr) {
            console.warn('[Supabase RPC] Décrémentation de stock RPC ignorée:', rpcErr);
          }
        }

        const currentOrders = await this.getOrders();
        saveToStorage(STORAGE_KEYS.ORDERS, [confirmedOrder, ...currentOrders.filter(o => o.id !== confirmedOrder.id)]);
        return confirmedOrder;
      } catch (directInsertErr: any) {
        console.error('[Supabase] Erreur insertion directe commande:', directInsertErr);
        throw directInsertErr;
      }
    }

    // 3. Fallback hors-ligne
    const orders = await this.getOrders();
    const updated = [newOrder, ...orders.filter(o => o.id !== uniqueId)];
    saveToStorage(STORAGE_KEYS.ORDERS, updated);
    return newOrder;
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, notes?: string): Promise<Order> {
    const orders = await this.getOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index === -1) throw new Error(`Order ${orderId} not found`);

    const updatedOrder: Order = {
      ...orders[index],
      status,
      ...(notes !== undefined ? { notes } : {}),
      updatedAt: new Date().toISOString(),
    };

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('orders')
          .update({
            status,
            ...(notes !== undefined ? { notes } : {}),
            updated_at: updatedOrder.updatedAt,
          })
          .eq('id', orderId);
      } catch (e) {
        console.warn('[Supabase] Erreur mise à jour statut commande:', e);
      }
    }

    orders[index] = updatedOrder;
    saveToStorage(STORAGE_KEYS.ORDERS, [...orders]);
    return updatedOrder;
  },

  async deleteOrder(orderId: string): Promise<boolean> {
    const orders = await this.getOrders();
    const filtered = orders.filter(o => o.id !== orderId);
    saveToStorage(STORAGE_KEYS.ORDERS, filtered);

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.from('orders').delete().eq('id', orderId);
      } catch (e) {
        console.warn('[Supabase] Erreur suppression commande:', e);
      }
    }
    return true;
  },

  // ===================== WILAYAS (58) =====================
  async getWilayas(): Promise<Wilaya[]> {
    if (supabase && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('wilayas')
          .select('*')
          .order('id', { ascending: true });

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map(mapDbToWilaya);
        }
      } catch (e) {
        console.warn('[Supabase] Erreur récupération Wilayas distantes:', e);
      }
    }
    return loadFromStorage<Wilaya[]>(STORAGE_KEYS.WILAYAS, rawWilayas as Wilaya[]);
  },

  async updateWilaya(id: number, updates: Partial<Wilaya>): Promise<Wilaya> {
    const wilayas = await this.getWilayas();
    const index = wilayas.findIndex(w => w.id === id);
    if (index === -1) throw new Error(`Wilaya ${id} not found`);

    const updatedWilaya = { ...wilayas[index], ...updates };

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase
          .from('wilayas')
          .update({
            home_delivery_price: updatedWilaya.homeDeliveryPrice,
            stop_desk_price: updatedWilaya.stopDeskPrice,
            is_deliverable: updatedWilaya.isDeliverable,
          })
          .eq('id', id);
      } catch (e) {
        console.warn('[Supabase] Erreur mise à jour Wilaya distante:', e);
      }
    }

    wilayas[index] = updatedWilaya;
    saveToStorage(STORAGE_KEYS.WILAYAS, [...wilayas]);
    return updatedWilaya;
  },

  async bulkUpdateWilayas(updatedWilayas: Wilaya[]): Promise<void> {
    saveToStorage(STORAGE_KEYS.WILAYAS, updatedWilayas);
    if (supabase && isSupabaseConfigured) {
      try {
        for (const w of updatedWilayas) {
          await supabase
            .from('wilayas')
            .update({
              home_delivery_price: w.homeDeliveryPrice,
              stop_desk_price: w.stopDeskPrice,
              is_deliverable: w.isDeliverable,
            })
            .eq('id', w.id);
        }
      } catch (e) {
        console.warn('Erreur mise à jour en masse Wilayas:', e);
      }
    }
  },

  // ===================== STORE CONFIG (WHITE-LABEL) =====================
  async getStoreConfig(): Promise<StoreConfig> {
    let config = loadFromStorage<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_STORE_CONFIG);

    if (supabase && isSupabaseConfigured) {
      try {
        const queryPromise = supabase
          .from('store_config')
          .select('*')
          .eq('id', 'current')
          .maybeSingle();

        const { data, error } = await withTimeout<any>(queryPromise, 4000);

        if (!error && data) {
          const validatedTheme =
            data.theme && typeof data.theme === 'object' && (data.theme as any).primary
              ? data.theme
              : config.theme;

          const isFreeShippingOn = data.free_shipping_enabled !== undefined
            ? Boolean(data.free_shipping_enabled)
            : (data.theme && typeof data.theme === 'object' && (data.theme as any).free_shipping_enabled !== undefined
                ? Boolean((data.theme as any).free_shipping_enabled)
                : config.freeShippingEnabled);

          config = {
            storeName: data.store_name ?? config.storeName,
            storeTagline: data.store_tagline ?? config.storeTagline,
            logoUrl: data.logo_url ?? config.logoUrl,
            currency: data.currency ?? config.currency,
            phone: data.phone ?? config.phone,
            whatsappNumber: data.whatsapp_number ?? config.whatsappNumber,
            instagramUrl: data.instagram_url ?? config.instagramUrl,
            facebookUrl: data.facebook_url ?? config.facebookUrl,
            tiktokUrl: data.tiktok_url ?? config.tiktokUrl,
            freeShippingThreshold: Number(data.free_shipping_threshold ?? config.freeShippingThreshold),
            freeShippingEnabled: isFreeShippingOn,
            theme: validatedTheme,
            metaPixelId: data.meta_pixel_id ?? config.metaPixelId,
            tiktokPixelId: data.tiktok_pixel_id ?? config.tiktokPixelId,
            deliveryTimeEstimate: data.delivery_time_estimate ?? config.deliveryTimeEstimate,
            announcementText: data.announcement_text ?? config.announcementText,
            adminPin: data.admin_pin ?? config.adminPin,
          };
          try {
            localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('[Supabase] Config cloud ignorée ou délai dépassé:', err);
      }
    }

    applyThemeVariables(config.theme);
    return config;
  },

  async updateStoreConfig(updates: Partial<StoreConfig>): Promise<StoreConfig> {
    const current = loadFromStorage<StoreConfig>(STORAGE_KEYS.CONFIG, DEFAULT_STORE_CONFIG);
    const updated: StoreConfig = { ...current, ...updates };
    saveToStorage(STORAGE_KEYS.CONFIG, updated);
    if (updated.theme) {
      applyThemeVariables(updated.theme);
    }

    if (supabase && isSupabaseConfigured) {
      try {
        const themeToPersist = {
          ...(updated.theme || current.theme),
          free_shipping_enabled: updated.freeShippingEnabled ?? false,
        };

        const cloudPayload: Record<string, any> = {
          id: 'current',
          store_name: updated.storeName,
          store_tagline: updated.storeTagline,
          logo_url: updated.logoUrl,
          currency: updated.currency,
          phone: updated.phone,
          whatsapp_number: updated.whatsappNumber,
          instagram_url: updated.instagramUrl,
          facebook_url: updated.facebookUrl,
          tiktok_url: updated.tiktokUrl,
          free_shipping_threshold: updated.freeShippingThreshold,
          free_shipping_enabled: updated.freeShippingEnabled ?? false,
          theme: themeToPersist,
          meta_pixel_id: updated.metaPixelId,
          tiktok_pixel_id: updated.tiktokPixelId,
          delivery_time_estimate: updated.deliveryTimeEstimate,
          announcement_text: updated.announcementText,
          admin_pin: updated.adminPin,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('store_config')
          .upsert(cloudPayload, { onConflict: 'id' });

        console.log('[Supabase] store_config synchronisé dans PostgreSQL !');
      } catch (err) {
        console.warn('Supabase store_config sync non disponible:', err);
      }
    }

    return updated;
  },

  // ===================== REVIEWS =====================
  async getReviews(productId?: string): Promise<Review[]> {
    const reviews = loadFromStorage<Review[]>(STORAGE_KEYS.REVIEWS, INITIAL_REVIEWS);
    if (productId) {
      return reviews.filter(r => r.productId === productId);
    }
    return reviews;
  },

  async addReview(data: Omit<Review, 'id' | 'date'>): Promise<Review> {
    const reviews = await this.getReviews();
    const dateStr = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date());

    const newReview: Review = {
      ...data,
      id: `rev-${Date.now()}`,
      date: dateStr,
    };
    const updated = [newReview, ...reviews];
    saveToStorage(STORAGE_KEYS.REVIEWS, updated);

    try {
      const prodReviews = updated.filter(r => r.productId === data.productId);
      const avgRating = Number(
        (prodReviews.reduce((sum, r) => sum + r.rating, 0) / prodReviews.length).toFixed(1)
      );
      await this.updateProduct(data.productId, {
        rating: avgRating,
        reviewCount: prodReviews.length,
      });
    } catch (e) {
      console.warn('Failed to update product rating', e);
    }

    return newReview;
  },

  resetAllDemoData(): void {
    localStorage.removeItem(STORAGE_KEYS.ORDERS);
    localStorage.removeItem(STORAGE_KEYS.WILAYAS);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
    localStorage.removeItem(STORAGE_KEYS.REVIEWS);
    window.location.reload();
  },
};
