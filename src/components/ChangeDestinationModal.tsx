import React, { useState } from 'react';
import { X, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { QRCodeItem } from '../types';
import { api } from '../services/api';

interface ChangeDestinationModalProps {
  qrCode: QRCodeItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangeDestinationModal: React.FC<ChangeDestinationModalProps> = ({
  qrCode,
  onClose,
  onSuccess,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!qrCode) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = newUrl.trim();
    if (!trimmed) {
      setError('Por favor, informe a nova URL de destino.');
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      setError('URL inválida. A URL deve iniciar obrigatoriamente com https:// ou http://');
      return;
    }

    if (trimmed === qrCode.destination_url) {
      setError('A nova URL é idêntica ao destino atual.');
      return;
    }

    setLoading(true);
    try {
      await api.changeDestination(qrCode.id, trimmed, reason.trim() || undefined);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao atualizar o destino.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Alterar Destino da Placa</h2>
            <p className="text-xs text-slate-500">
              Atualize para onde os visitantes serão redirecionados ao escanear a placa física.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guarantee Banner */}
        <div className="bg-amber-50/70 border-b border-amber-100 px-6 py-3 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold">Placa física protegida:</span> O código impresso (
            <code className="font-mono font-bold text-amber-950 px-1 py-0.5 bg-amber-100/60 rounded">
              {qrCode.code}
            </code>
            ) e o link público nunca mudam. Apenas o destino final no banco é atualizado.
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Destination Display */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Destino Atual na Placa</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 truncate select-all">
              {qrCode.destination_url}
            </div>
          </div>

          <div className="flex justify-center text-slate-400 py-0.5">
            <ArrowRight className="w-4 h-4 transform rotate-90 sm:rotate-0" />
          </div>

          {/* New Destination Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Novo Link de Destino <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://wa.me/5521999999999 ou https://site.com.br"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Exemplos: WhatsApp comercial, Instagram, Cardápio digital, Site oficial, Chave Pix.
            </p>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Motivo da Troca (Opcional - registrado no histórico)
            </label>
            <input
              type="text"
              placeholder="Ex: Campanha de Black Friday, Troca de WhatsApp, Novo Cardápio"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Salvar Novo Destino</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
