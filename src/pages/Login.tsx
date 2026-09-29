import React, { useState } from 'react';
import { QrCode, Lock, Mail, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api, setStoredAuth } from '../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(email.trim(), password);
      setStoredAuth(res.token, res.user);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefaultCredentials = () => {
    setEmail('admin@qrplacas.com');
    setPassword('admin123456');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      {/* Background Subtle Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Lockup */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
            <QrCode className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">QR Placas</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plataforma de Gerenciamento de QR Codes Dinâmicos & NFC
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white">Acesso Administrativo</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Entre com suas credenciais de administrador para gerenciar placas e clientes.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                E-mail Administrativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@qrplacas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper for Initial Setup */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Primeiro acesso?</span>
              <button
                type="button"
                onClick={handleUseDefaultCredentials}
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors hover:underline"
              >
                Preencher credenciais padrão
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Padrão inicial: <code className="text-slate-400">admin@qrplacas.com</code> / <code className="text-slate-400">admin123456</code>. Você pode alterar a senha em Configurações.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="mt-6 text-center flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500/70" />
          <span>Autenticação PBKDF2 e Sessão Criptografada</span>
        </div>
      </div>
    </div>
  );
};
