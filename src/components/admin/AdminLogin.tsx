import React, { useState } from 'react';
import { Lock, Mail, Key, ArrowRight, ShieldCheck, Sparkles, Store, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AdminLogin: React.FC = () => {
  const { loginAdmin, config, setCurrentView, demoLoginAdmin } = useStore();
  
  // Onglets : 'auth' (Supabase Auth Email/Pass) ou 'pin' (Mode Démo / PIN)
  const [loginMode, setLoginMode] = useState<'auth' | 'pin'>('auth');
  
  // Champs Email & Mot de passe
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Champ PIN
  const [pin, setPin] = useState('');
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Veuillez renseigner votre email et mot de passe administrateur');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const success = await loginAdmin(email, password);
      if (!success) {
        setErrorMsg('Email ou mot de passe incorrect. Vérifiez vos identifiants Supabase Auth.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Veuillez entrer le code PIN');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const success = await loginAdmin(pin);
      if (!success) {
        setErrorMsg('Code PIN incorrect (Code par défaut: 1234)');
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl border border-store-border p-6 sm:p-10 max-w-md w-full shadow-luxury text-center animate-scaleUp">
        
        {/* Brand Header */}
        <div className="w-16 h-16 rounded-2xl bg-store-secondary text-stone-900 mx-auto flex items-center justify-center mb-4 border border-store-primary/30 shadow-xs">
          <Lock className="w-8 h-8 text-store-primary" />
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
          Espace Administrateur
        </h2>
        <p className="text-xs text-stone-500 mt-1 mb-5">
          Gestion de la boutique <strong className="text-stone-800">{config.storeName}</strong>
        </p>

        {/* Toggle Login Mode (Supabase Auth vs PIN Démo) */}
        <div className="flex rounded-2xl bg-stone-100 p-1 mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setLoginMode('auth');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'auth'
                ? 'bg-white text-stone-900 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-store-primary" />
            <span>Supabase Auth</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setLoginMode('pin');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'pin'
                ? 'bg-white text-stone-900 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-stone-500" />
            <span>Code PIN (Démo)</span>
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Formulaire Supabase Auth (Email / Mot de passe) */}
        {loginMode === 'auth' ? (
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Adresse Email Administrateur
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  autoFocus
                  required
                  placeholder="admin@maisonceleste.dz"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl border border-store-border bg-store-base focus:outline-none focus:border-store-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Mot de Passe Cloud
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl border border-store-border bg-store-base focus:outline-none focus:border-store-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Connexion Sécurisée</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* 2. Formulaire Code PIN (Mode Démo) */
          <form onSubmit={handlePinSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Code PIN d'accès Administrateur
              </label>
              <input
                type="password"
                autoFocus
                maxLength={8}
                placeholder="••••"
                value={pin}
                onChange={e => {
                  setPin(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest rounded-2xl border border-store-border bg-store-base focus:outline-none focus:border-store-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Valider le PIN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Footer navigation */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <button
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-1.5 hover:text-stone-900 transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Retour Boutique</span>
          </button>

          <button
            type="button"
            onClick={demoLoginAdmin}
            className="text-[11px] bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-xl text-stone-700 font-semibold transition-colors flex items-center gap-1"
            title="Accès démo immédiat"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Accès Direct Démo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
