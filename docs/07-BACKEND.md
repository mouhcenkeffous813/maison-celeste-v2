# 07 — Architecture Backend & Serverless (Maison Céleste V2)

Ce document décrit en détail l'infrastructure backend et serverless de **Maison Céleste V2**, son implémentation hybride (Supabase BaaS + Edge Functions Deno) et ses mécanismes de sécurité.

---

## 1. Vue d'Ensemble du Backend V2

Contrairement à la version initiale qui s'appuyait sur un stockage local, **Maison Céleste V2** repose sur une architecture backend robuste combinant :
1. **Une Edge Function Serverless Deno :** Logique serveur critique et validation des transactions.
2. **Une Base de Données PostgreSQL 15+ Managée :** Stockage relationnel certifié avec procédures stockées (RPC).
3. **L'API PostgREST :** Couche REST automatique au-dessus de PostgreSQL protégée par Row Level Security (RLS).
4. **Le Service Supabase Auth :** Gestion sécurisée des identités et des sessions administrateur par jetons JWT.
5. **Le Bot Telegram API :** Dispatch immédiat d'alertes push formatées vers le smartphone du commerçant.

---

## 2. L'Edge Function Serverless `create-order` ([`supabase/functions/create-order/index.ts`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/supabase/functions/create-order/index.ts))

Déployée sur le réseau distribué de Supabase (Deno Deploy), cette fonction serverless centralise l'orchestration des commandes :

### 2.1 Missions Clés de l'Edge Function
```typescript
// Extrait de l'Edge Function create-order
Deno.serve(async (req) => {
  // 1. Contrôle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const orderData = await req.json();

    // 2. Validation stricte du téléphone algérien
    const phoneRegex = /^(0)(5|6|7)[0-9]{8}$/;
    const normalizedPhone = orderData.customerPhone.replace(/[\s\-\.]/g, '');
    if (!phoneRegex.test(normalizedPhone)) {
      return new Response(
        JSON.stringify({ error: 'Numéro de téléphone mobile algérien non valide (05, 06 ou 07 requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Recalcul côté serveur des prix réels depuis la table products
    let serverProductTotal = 0;
    // ... calcul autoritaire empêchant toute falsification du DOM client ...

    // 4. Décrémentation atomique des stocks (RPC ACID)
    const { error: stockError } = await supabaseAdmin.rpc('decrease_product_stock', {
      p_product_id: item.productId,
      p_variant_id: variant.id,
      p_quantity: item.quantity,
    });
    if (stockError) throw new Error(`Stock insuffisant: ${stockError.message}`);

    // 5. Insertion certifiée dans public.orders
    const { data: newOrder, error: insertError } = await supabaseAdmin
      .from('orders')
      .insert([finalOrderPayload])
      .select()
      .single();

    // 6. Notification instantanée Telegram
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: telegramFormattedMessage,
        parse_mode: 'Markdown',
      }),
    });

    return new Response(
      JSON.stringify({ success: true, order: newOrder }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 3. Stratégie de Résilience & Fallback dans [`src/services/api.ts`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/services/api.ts)

Pour garantir qu'une commande ne soit jamais bloquée en cas de latence réseau de l'acheteur ou de maintenance de l'Edge Function :
1. **Tentative Primaire :** Appel de `supabase.functions.invoke('create-order', { body: newOrder })`.
2. **Repli Automatique Immédiat :** En cas d'erreur ou d'absence de réponse de l'Edge Function, `api.ts` exécute immédiatement l'insertion directe sécurisée dans Supabase PostgreSQL (`supabase.from('orders').insert([payload])`), suivie de l'appel RPC `decrease_product_stock` et de l'envoi de la notification Telegram de secours via [`telegramService.ts`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/services/telegramService.ts).
3. **Zéro Échec Vente :** Le client final reçoit sa confirmation dans 100 % des cas.

---

## 4. Authentification Administrateur (Supabase Auth / JWT)

Dans la version V2, l'authentification est passée du statut d'authentification logique client à un **véritable système d'authentification crypté** :
* **Service :** Supabase Auth (GoTrue).
* **Mécanisme :** Échange d'identifiants (Email + Mot de passe fort) contre des jetons signés JWT `access_token` (durée de validité 1 heure) et `refresh_token` (renouvelé automatiquement).
* **Isolation :** Le Dashboard est protégé par une garde stricte dans [`AdminLayout.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminLayout.tsx). Si aucun jeton JWT valide n'est présent, seul le composant [`AdminLogin.tsx`](file:///c:/Users/Mohcen/Desktop/maison-celeste-v2/src/components/admin/AdminLogin.tsx) est retourné.
