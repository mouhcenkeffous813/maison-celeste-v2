/**
 * Service de stockage d'images Supabase Storage avec conversion WebP côté client.
 * Compresse et optimise automatiquement chaque image avant son envoi vers le CDN Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

const BUCKET_NAME = 'product-images';

/**
 * Compresse et convertit un fichier image en Blob WebP via HTML5 Canvas
 * Largeur max: 1200px, Qualité: 0.82
 */
export async function convertToWebP(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.82
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Erreur de décodage de l'image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calcul du redimensionnement proportionnel
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Impossible d'initialiser le contexte 2D Canvas"));
          return;
        }

        // Amélioration du lissage de l'image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Conversion en format WebP
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              // Fallback vers JPEG si WebP n'est pas supporté par le navigateur
              canvas.toBlob(
                (fallbackBlob) => {
                  if (fallbackBlob) resolve(fallbackBlob);
                  else reject(new Error('Échec de la génération du Blob image'));
                },
                'image/jpeg',
                quality
              );
            }
          },
          'image/webp',
          quality
        );
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error("Contenu d'image vide"));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Convertit un Blob en Data URL Base64 pour le fallback local
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Téléverse une image de produit vers Supabase Storage :
 * 1. Compression et conversion WebP côté client
 * 2. Envoi vers le bucket public 'product-images'
 * 3. Retour de l'URL publique CDN
 * 4. Fallback DataURL Base64 si hors-ligne ou non configuré
 */
export async function uploadProductImage(file: File): Promise<string> {
  // 1. Optimisation WebP côté client
  const webpBlob = await convertToWebP(file, 1200, 1200, 0.82);

  // 2. Si Supabase est configuré, tenter le téléversement dans le bucket Cloud
  if (supabase && isSupabaseConfigured) {
    try {
      // Nettoyage du nom de fichier
      const cleanBaseName = file.name
        .toLowerCase()
        .replace(/\.[^/.]+$/, '') // retirer l'extension originale
        .replace(/[^a-z0-9_-]/g, '-') // ne garder que les caractères sûrs
        .substring(0, 30);

      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const fileName = `${cleanBaseName}-${uniqueSuffix}.webp`;
      const filePath = `products/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, webpBlob, {
          contentType: 'image/webp',
          cacheControl: '31536000', // 1 an de cache CDN
          upsert: true,
        });

      if (error) {
        console.warn('[Storage] Avertissement téléversement Supabase Storage, repli vers DataURL:', error.message);
        // Si erreur RLS ou bucket non encore créé, on bascule en fallback
        return await blobToDataUrl(webpBlob);
      }

      // Récupération de l'URL publique CDN
      const { data: publicData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      if (publicData?.publicUrl) {
        console.log('[Storage] Image WebP téléversée sur Supabase Storage CDN:', publicData.publicUrl);
        return publicData.publicUrl;
      }
    } catch (err) {
      console.warn('[Storage] Exception téléversement Cloud, utilisation du repli local:', err);
    }
  }

  // 3. Fallback immédiat (mode démo ou hors-ligne)
  return await blobToDataUrl(webpBlob);
}
