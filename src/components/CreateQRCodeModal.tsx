import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Sparkles, QrCode } from 'lucide-react';
import { Customer } from '../types';
import { api } from '../services/api';

interface CreateQRCodeModalProps {
  isOpen: boolean;
  preselectedCustomerId?: string;
  onClose: () => void;
  onSuccess: (newId: string) => void;
}

export const CreateQRCodeModal: React.FC<CreateQRCodeModalProps> = ({
  isOpen,
  preselectedCustomerId,
  onClose,
  onSuccess,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [title, setTitle] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [status, setStatus] = useState<'ativo' | 'desativado'>('ativo');
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      if (preselectedCustomerId) {
        setCustomerId(preselectedCustomerId);
      }
      setTitle('');
      setDestinationUrl('');
      setStatus('ativo');
      setError(null);
    }
  }, [isOpen, preselectedCustomerId]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await api.getCustomers({ status: 'ativo' });
      setCustomers(res.customers);
      if (!customerId && res.customers.length > 0 && !preselectedCustomerId) {
        setCustomerId(res.customers[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoadingCustomers(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Por favor, selecione o cliente proprietário da placa.');
      return;
    }

    const trimmedUrl = destinationUrl.trim();
    if (!trimmedUrl) {
      setError('Informe a URL inicial de destino.');
      return;
    }

    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error();
      }
    } catch {
      setError('URL de destino inválida. Deve iniciar com https:// ou http://');
      return;
    }

    setLoading(true);
    try {
      const res = await api.createQRCode({
        customer_id: customerId,
        title: title.trim() || undefined,
        destination_url: trimmedUrl,
        status,
      });
      onSuccess(res.qrCode.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao gerar QR Code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cadastrar Nova Placa Física</h2>
              <p className="text-xs text-slate-500">Gere um QR Code dinâmico com código permanente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Commercial Explanation */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200/60 text-xs text-slate-600 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p>
            O sistema gerará um código único e imprevisível (ex: <code className="font-mono font-bold text-slate-900">A7K92X</code>).
            Você poderá alterar o link de destino a qualquer momento no futuro sem precisar trocar a placa.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cliente Proprietário <span className="text-red-500">*</span>
            </label>
            {loadingCustomers ? (
              <div className="text-xs text-slate-400 flex items-center gap-1.5 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Carregando clientes...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Nenhum cliente ativo encontrado. Cadastre um cliente primeiro antes de gerar a placa.
              </div>
            ) : (
              <select
                required
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
              >
                <option value="">Selecione um cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Plate Title / Location Tag */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Título / Identificação da Placa
            </label>
            <input
              type="text"
              placeholder="Ex: Placa Balcão Entrada, Display Mesa 02"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Initial Destination URL */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Destino Inicial (Link) <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              placeholder="https://instagram.com/cliente ou https://wa.me/55..."
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
            />
          </div>

          {/* Initial Status */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Status Inicial da Placa
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
            >
              <option value="ativo">Ativo (Pronto para escanear imediatamente)</option>
              <option value="desativado">Desativado (Pausado até entrega)</option>
            </select>
          </div>

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
              disabled={loading || customers.length === 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Criar Placa & Gerar Código</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
