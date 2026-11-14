# 11 — Guide d'Installation Locale (Maison Céleste V2)

Ce guide pas à pas permet de cloner, installer, configurer et exécuter l'application **Maison Céleste V2** sur votre machine locale (Windows, macOS ou Linux).

---

## 1. Prérequis Système

* **Node.js :** Version 18.0.0 ou supérieure (recommandé : LTS 20+).
* **Gestionnaire de paquets :** `npm` (inclus avec Node.js).
* **Git :** Installé et configuré sur votre machine.

---

## 2. Cloner le Dépôt & Installer les Dépendances

Ouvrez un terminal (PowerShell, Command Prompt ou Bash) :

```bash
# 1. Cloner le projet depuis GitHub
git clone https://github.com/mouhcenkeffous813/maison-celeste-v2.git

# 2. Accéder au dossier du projet
cd maison-celeste-v2

# 3. Installer l'ensemble des dépendances
npm install
```

---

## 3. Configuration des Variables d'Environnement (`.env`)

Créez ou vérifiez le fichier `.env` à la racine du projet :

```ini
# ==============================================================================
# CONFIGURATION CLOUD SUPABASE (MAISON CÉLESTE V2)
# ==============================================================================
VITE_SUPABASE_URL=https://omzqajugkhkjxlkfmxpo.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_Pi9BqXixbbwCCJDbYZr9bw_HfbiKPSp

# Variables de compatibilité
NEXT_PUBLIC_SUPABASE_URL=https://omzqajugkhkjxlkfmxpo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Pi9BqXixbbwCCJDbYZr9bw_HfbiKPSp

# Coordonnées WhatsApp
VITE_WHATSAPP_PHONE="21377526192"

# Bot Telegram Notifications de Nouvelles Commandes
VITE_TELEGRAM_BOT_TOKEN="9023085999:AAGBO6w0C0jb7w4oiy2j6wqwk782J34mACs"
VITE_TELEGRAM_CHAT_ID="682438619"
```

---

## 4. Démarrage du Serveur de Développement

```bash
npm run dev
```

Vite démarrera le serveur local en quelques millisecondes :
```text
  VITE v5.4.21  ready in 280 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Ouvrez votre navigateur sur :
* **Boutique publique :** `http://localhost:5173/`
* **Accès Administrateur :** `http://localhost:5173/#admin`

---

## 5. Commandes NPM Utiles

| Commande | Action |
| :--- | :--- |
| `npm run dev` | Lance le serveur local avec rechargement à chaud (HMR) |
| `npm run build` | Compile TypeScript et génère le bundle optimisé dans `/dist` |
| `npm run preview` | Prévisualise en local le bundle de production généré |
| `npm run lint` | Analyse le code source pour détecter d'éventuels avertissements |
