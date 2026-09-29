import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Lock,
  Download,
  Upload,
  ShieldCheck,
  Cloud,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { AppSettings } from '../types';

interface SettingsProps {
  onSettingsUpdated: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsUpdated }) => {
  const [settings, setSettings] = useState<AppSettings>({});
  const [customDomain, setCustomDomain] = useState('');
  const [detectedOrigin, setDetectedOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainSuccess, setDomainSuccess] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Backup restore state
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setDetectedOrigin(res.detectedOrigin);
      setCustomDomain(res.settings.custom_domain || res.detectedOrigin || '');
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDomain(true);
    setDomainSuccess(false);

    try {
      const clean = customDomain.trim().replace(/\/+$/, '');
      await api.updateSettings({ custom_domain: clean });
      setDomainSuccess(true);
      onSettingsUpdated();
      setTimeout(() => setDomainSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar domínio:', err);
    } finally {
      setSavingDomain(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('A nova senha e a confirmação não conferem.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Falha ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleExportBackup = () => {
    window.location.href = '/api/admin/backup/export';
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.data) {
        throw new Error('Arquivo de backup inválido ou incompatível.');
      }
      await api.importBackup(parsed.data);
      setImportSuccess(true);
      onSettingsUpdated();
      setTimeout(() => setImportSuccess(false), 4000);
    } catch (err: any) {
      setImportError(err.message || 'Erro ao importar backup.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configurações da Plataforma</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Ajustes de domínio personalizado, segurança de acesso, backups e publicação na Cloudflare.
        </p>
      </div>

      {/* Section 1: Custom Domain */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-emerald-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Domínio Personalizado para as Placas</h2>
            <p className="text-xs text-slate-500">
              Defina a URL base permanente que será gravada nas placas físicas e etiquetas NFC.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveDomain} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              URL Base do Domínio Público
            </label>
            <div className="flex items-center gap-2 max-w-xl">
              <input
                type="text"
                required
                placeholder="https://qr.meudominio.com.br"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <button
                type="submit"
                disabled={savingDomain}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {savingDomain && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Domínio</span>
              </button>
            </div>
            {domainSuccess && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-2">
                <Check className="w-3.5 h-3.5" />
                <span>Domínio público atualizado com sucesso!</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              Exemplo: se configurar <code className="text-slate-700">https://qr.meudominio.com.br</code>,
              o link da placa <code className="text-slate-700">A7K92X</code> será{' '}
              <code className="text-slate-700 font-mono font-semibold">https://qr.meudominio.com.br/q/A7K92X</code>.
            </p>
          </div>
        </form>
      </div>

      {/* Section 2: Security & Password */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-slate-700" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Segurança & Alteração de Senha</h2>
            <p className="text-xs text-slate-500">
              Altere a senha da sua conta de administrador. As senhas são protegidas com PBKDF2.
            </p>
          </div>
        </div>

        <form onSubmit={handleSavePassword} className="p-6 space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-700">
              <Check className="w-4 h-4 shrink-0" />
              <span>Senha alterada com sucesso!</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Senha Atual
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nova Senha (mínimo 6 caracteres)
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Atualizar Senha</span>
          </button>
        </form>
      </div>

      {/* Section 3: Backup & Restore */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Download className="w-4 h-4 text-blue-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Backup & Restauração de Dados</h2>
            <p className="text-xs text-slate-500">
              Faça cópias de segurança completas do seu banco de dados e restaure quando necessário.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h3 className="text-xs font-semibold text-slate-800">Exportar Backup Completo</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Baixa um arquivo JSON contendo todos os clientes, placas cadastradas, destinos e histórico completo de alterações.
              </p>
              <button
                onClick={handleExportBackup}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Backup JSON</span>
              </button>
            </div>

            {/* Import Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h3 className="text-xs font-semibold text-slate-800">Restaurar Dados</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Carregue um arquivo de backup previamente exportado para recuperar dados de placas e clientes.
              </p>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Selecionar Arquivo de Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  disabled={importing}
                  className="hidden"
                />
              </label>

              {importSuccess && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Dados restaurados com sucesso!</span>
                </p>
              )}

              {importError && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{importError}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Cloudflare D1 Deployment Instructions */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
          <Cloud className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Guia Rápido de Publicação na Cloudflare</h2>
            <p className="text-xs text-slate-400">
              O projeto já inclui <code className="text-emerald-400">wrangler.jsonc</code>, migrations e Worker para o Edge.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300">
          <p>Para publicar esta plataforma na sua conta Cloudflare de forma 100% autônoma:</p>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 font-mono text-[11px] text-slate-200">
            <div><span className="text-slate-500"># 1. Autenticar no Wrangler da Cloudflare:</span></div>
            <div>npx wrangler login</div>
            <div className="pt-2"><span className="text-slate-500"># 2. Criar o banco de dados Cloudflare D1:</span></div>
            <div>npx wrangler d1 create qr-placas-db</div>
            <div className="pt-2"><span className="text-slate-500"># 3. Aplicar as migrations iniciais no Cloudflare D1:</span></div>
            <div>npx wrangler d1 execute qr-placas-db --remote --file=./schema.sql</div>
            <div className="pt-2"><span className="text-slate-500"># 4. Compilar o frontend e fazer deploy no Cloudflare Workers:</span></div>
            <div>npm run build && npx wrangler deploy</div>
          </div>
          <p className="text-slate-400">
            Consulte o arquivo <strong className="text-white">README.md</strong> na raiz do projeto para o manual completo com backup, migração e domínio personalizado.
          </p>
        </div>
      </div>
    </div>
  );
};
