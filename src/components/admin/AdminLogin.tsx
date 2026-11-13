import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Store, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const AdminLogin: React.FC = () => {
  const { loginAdmin, config, setCurrentView } = useStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Connexion Administrateur Sécurisée (Supabase Auth)
  const handleLoginSubmit = async (e: React.FormEvent) => {
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
        setErrorMsg('Email ou mot de passe administrateur incorrect.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl border border-store-border p-6 sm:p-10 max-w-md w-full shadow-luxury text-center animate-scaleUp">
        
        {/* Brand Header */}
        <div className="w-16 h-16 rounded-2xl bg-stone-900 text-white mx-auto flex items-center justify-center mb-4 shadow-sm border border-stone-800">
          <Lock className="w-8 h-8 text-store-primary" />
        </div>

        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
          Espace Administrateur
        </h2>
        <p className="text-xs text-stone-500 mt-1 mb-6">
          Accès strictement réservé à la direction de <strong className="text-stone-800">{config.storeName}</strong>
        </p>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 text-left animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulaire Supabase Auth Strict (Connexion uniquement) */}
        <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
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
              Mot de Passe
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

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <button
            onClick={() => setCurrentView('home')}
            className="flex items-center gap-1.5 hover:text-stone-900 transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Retour à la Boutique</span>
          </button>

          <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Supabase Auth Protégé</span>
          </span>
        </div>
      </div>
    </div>
  );
};
