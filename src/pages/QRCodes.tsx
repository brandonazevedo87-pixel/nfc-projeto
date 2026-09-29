import React, { useState, useEffect } from 'react';
import {
  QrCode,
  Search,
  Plus,
  Copy,
  Check,
  ExternalLink,
  History,
  Edit2,
  Trash2,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { QRCodeItem } from '../types';
import { api } from '../services/api';

interface QRCodesProps {
  onNavigate: (path: string) => void;
  onOpenCreateQR: () => void;
  onOpenQRCodeModal: (qr: QRCodeItem) => void;
  onOpenChangeDestination: (qr: QRCodeItem) => void;
  onOpenHistoryModal: (qrId: string) => void;
  publicBaseUrl: string;
}

export const QRCodes: React.FC<QRCodesProps> = ({
  onNavigate,
  onOpenCreateQR,
  onOpenQRCodeModal,
  onOpenChangeDestination,
  onOpenHistoryModal,
  publicBaseUrl,
}) => {
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQRCodes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQRCodes({
        search: search.trim() || undefined,
        status: statusFilter !== 'todos' ? statusFilter : undefined,
      });
      setQrCodes(res.qrCodes);
    } catch (err: any) {
      console.error('Erro ao listar QR Codes:', err);
      setError(err.message || 'Erro ao carregar lista de QR Codes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQRCodes();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadQRCodes();
  };

  const handleCopyLink = async (code: string) => {
    const fullUrl = `${publicBaseUrl.replace(/\/+$/, '')}/q/${code}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar URL:', err);
    }
  };

  const handleToggleStatus = async (qr: QRCodeItem) => {
    const nextStatus = qr.status === 'ativo' ? 'desativado' : 'ativo';
    try {
      await api.setQRCodeStatus(qr.id, nextStatus);
      loadQRCodes();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status da placa.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteQRCode(id);
      setDeleteConfirmId(null);
      loadQRCodes();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir placa.');
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gerenciamento de Placas & QR Codes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Placas físicas com códigos únicos e links de destino dinamicamente atualizáveis.
          </p>
        </div>
        <button
          onClick={onOpenCreateQR}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Nova Placa</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-xl shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 w-full md:w-auto bg-slate-100 p-1 rounded-lg">
          {[
            { label: 'Todos', value: 'todos' },
            { label: 'Ativos', value: 'ativo' },
            { label: 'Desativados', value: 'desativado' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar código (ex: A7K92X), cliente ou link..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-sans"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Main QR Codes Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Destino Atual</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Criado Em</th>
                <th className="py-3 px-4">Última Alteração</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Carregando placas...</span>
                  </td>
                </tr>
              ) : qrCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhuma placa encontrada. Clique em "Cadastrar Nova Placa" para começar.
                  </td>
                </tr>
              ) : (
                qrCodes.map((qr) => {
                  const createdAt = new Date(qr.created_at);
                  const updatedAt = new Date(qr.updated_at);
                  const isDeleting = deleteConfirmId === qr.id;

                  return (
                    <tr key={qr.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* CÓDIGO */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tracking-wider">
                            {qr.code}
                          </span>
                          <button
                            onClick={() => handleCopyLink(qr.code)}
                            title="Copiar URL Pública"
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          >
                            {copiedCode === qr.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {qr.title && (
                          <p className="text-[11px] text-slate-500 font-medium truncate max-w-[140px] mt-0.5">
                            {qr.title}
                          </p>
                        )}
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate(`/admin/clientes/${qr.customer_id}`)}
                          className="font-medium text-slate-800 hover:text-emerald-700 transition-colors text-left"
                        >
                          {qr.customer_name || '—'}
                        </button>
                      </td>

                      {/* DESTINO */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 max-w-[260px]">
                          <span className="font-mono text-emerald-700 truncate" title={qr.destination_url}>
                            {qr.destination_url}
                          </span>
                          <a
                            href={qr.destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(qr)}
                          title="Clique para alternar o status"
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                            qr.status === 'ativo'
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              qr.status === 'ativo' ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                          />
                          {qr.status === 'ativo' ? 'Ativo' : 'Desativado'}
                        </button>
                      </td>

                      {/* CRIADO EM */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {createdAt.toLocaleDateString('pt-BR')}
                      </td>

                      {/* ÚLTIMA ALTERAÇÃO */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {updatedAt.toLocaleDateString('pt-BR')} {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* AÇÕES */}
                      <td className="py-3 px-4 text-right">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] text-red-600 font-medium">Excluir?</span>
                            <button
                              onClick={() => handleDelete(qr.id)}
                              className="px-2 py-0.5 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700"
                            >
                              Sim
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] hover:bg-slate-200"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onOpenQRCodeModal(qr)}
                              title="Visualizar e Baixar Placa / SVG"
                              className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            >
                              Visualizar
                            </button>
                            <button
                              onClick={() => onOpenChangeDestination(qr)}
                              title="Mudar o link de redirecionamento"
                              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded transition-colors"
                            >
                              Alterar Destino
                            </button>
                            <button
                              onClick={() => onOpenHistoryModal(qr.id)}
                              title="Histórico de mudanças de link"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(qr.id)}
                              title="Excluir placa"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
