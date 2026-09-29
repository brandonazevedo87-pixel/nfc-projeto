import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  QrCode,
  Phone,
  Mail,
  Calendar,
  Edit2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  History,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Customer, QRCodeItem } from '../types';
import { api } from '../services/api';

interface CustomerDetailProps {
  customerId: string;
  onNavigate: (path: string) => void;
  onEditCustomer: (customer: Customer) => void;
  onOpenCreateQRForCustomer: (customerId: string) => void;
  onOpenQRCodeModal: (qr: QRCodeItem) => void;
  onOpenChangeDestination: (qr: QRCodeItem) => void;
  onOpenHistoryModal: (qrId: string) => void;
  publicBaseUrl: string;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({
  customerId,
  onNavigate,
  onEditCustomer,
  onOpenCreateQRForCustomer,
  onOpenQRCodeModal,
  onOpenChangeDestination,
  onOpenHistoryModal,
  publicBaseUrl,
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [qrCodes, setQrCodes] = useState<QRCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCustomer(customerId);
      setCustomer(res.customer);
      setQrCodes(res.qrCodes);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

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
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status da placa.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Carregando perfil do cliente...</span>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Cliente Não Encontrado</h2>
        <p className="text-xs text-slate-500">O cliente solicitado não existe ou foi excluído.</p>
        <button
          onClick={() => onNavigate('/admin/clientes')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          Voltar para Clientes
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('/admin/clientes')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para lista de clientes</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg shrink-0">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900">{customer.name}</h1>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                  customer.status === 'ativo'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {customer.status === 'ativo' ? 'Ativo' : 'Desativado'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
              {customer.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono text-slate-700">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-700">{customer.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Cadastrado em {new Date(customer.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            {customer.notes && (
              <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {customer.notes}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => onEditCustomer(customer)}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Editar Dados</span>
          </button>
          <button
            onClick={() => onOpenCreateQRForCustomer(customer.id)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Placa para este Cliente</span>
          </button>
        </div>
      </div>

      {/* Customer's Plates Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Placas & QR Codes Dinâmicos ({qrCodes.length})
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código Permanente</th>
                <th className="py-3 px-4">Identificação</th>
                <th className="py-3 px-4">Destino Atual</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Escaneamentos</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {qrCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    Este cliente ainda não possui nenhuma placa cadastrada. Clique no botão acima para adicionar a primeira placa.
                  </td>
                </tr>
              ) : (
                qrCodes.map((qr) => (
                  <tr key={qr.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
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
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {qr.title || 'Placa Sem Título'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 max-w-[280px]">
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
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(qr)}
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
                    <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold text-slate-700">
                      {qr.scan_count}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenQRCodeModal(qr)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                        >
                          Ver Placa
                        </button>
                        <button
                          onClick={() => onOpenChangeDestination(qr)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded transition-colors"
                        >
                          Alterar Destino
                        </button>
                        <button
                          onClick={() => onOpenHistoryModal(qr.id)}
                          title="Ver histórico desta placa"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
