import React, { useState, useEffect } from 'react';
import {
  Users,
  QrCode,
  CheckCircle2,
  PauseCircle,
  Eye,
  ArrowRight,
  TrendingUp,
  History,
  Copy,
  Check,
  ExternalLink,
  Plus,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { DashboardMetrics, QRCodeItem, QRCodeHistory, Customer } from '../types';
import { api } from '../services/api';

interface DashboardProps {
  onNavigate: (path: string) => void;
  onOpenCreateQR: () => void;
  onOpenCreateCustomer: () => void;
  onOpenQRCodeModal: (qr: QRCodeItem) => void;
  onOpenChangeDestination: (qr: QRCodeItem) => void;
  publicBaseUrl: string;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenCreateQR,
  onOpenCreateCustomer,
  onOpenQRCodeModal,
  onOpenChangeDestination,
  publicBaseUrl,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalCustomers: 0,
    totalQRCodes: 0,
    activeQRCodes: 0,
    inactiveQRCodes: 0,
    totalScans: 0,
  });
  const [recentChanges, setRecentChanges] = useState<QRCodeHistory[]>([]);
  const [recentQRCodes, setRecentQRCodes] = useState<QRCodeItem[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setMetrics(res.metrics);
      setRecentChanges(res.recentChanges);
      setRecentQRCodes(res.recentQRCodes);
      setRecentCustomers(res.recentCustomers);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Carregando indicadores...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Welcome & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel de Controle</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento de placas físicas com QR Codes dinâmicos e NFC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Atualizar dados"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCreateCustomer}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Novo Cliente</span>
          </button>
          <button
            onClick={onOpenCreateQR}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Placa</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total Clientes</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalCustomers}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Empresas e pessoas</div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total Placas</span>
            <QrCode className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalQRCodes}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">QR Codes gerados</div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Placas Ativas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {metrics.activeQRCodes}
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-1">Redirecionando normalmente</div>
        </div>

        <div className="p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Desativadas</span>
            <PauseCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums">
            {metrics.inactiveQRCodes}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pausadas ou em espera</div>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 bg-white border border-slate-200/80 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total Escaneamentos</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {metrics.totalScans}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Acessos registrados</div>
        </div>
      </div>

      {/* Main Grid: Recent Destination Changes + Recent Plates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Destination Changes (Commercial Proof of Flexibility) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Alterações Recentes de Destino</h2>
            </div>
            <button
              onClick={() => onNavigate('/admin/historico')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
            >
              <span>Ver histórico completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5">
            {recentChanges.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                Nenhuma alteração de destino realizada ainda.
              </div>
            ) : (
              <div className="space-y-3.5">
                {recentChanges.map((change) => {
                  const date = new Date(change.changed_at);
                  const isCreation = change.old_destination_url.includes('CRIAÇÃO');

                  return (
                    <div
                      key={change.id}
                      className="p-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-lg text-xs transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px]">
                            {change.qr_code}
                          </span>
                          <span className="font-medium text-slate-700 truncate max-w-[200px]">
                            {change.customer_name || 'Cliente'}
                          </span>
                          {change.qr_title && (
                            <span className="text-slate-400 hidden sm:inline">· {change.qr_title}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono shrink-0">
                          {date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      {/* URL Transition */}
                      <div className="flex items-center gap-2 font-mono text-[11px] overflow-hidden">
                        {!isCreation ? (
                          <>
                            <span className="text-slate-400 line-through truncate max-w-[40%]">
                              {change.old_destination_url}
                            </span>
                            <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="text-emerald-700 font-semibold truncate flex-1">
                              {change.new_destination_url}
                            </span>
                          </>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            Cadastro inicial direcionando para {change.new_destination_url}
                          </span>
                        )}
                      </div>

                      {change.reason && (
                        <div className="mt-1.5 text-[11px] text-slate-500 italic">
                          "{change.reason}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Latest Customers */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Últimos Clientes</h2>
            </div>
            <button
              onClick={() => onNavigate('/admin/clientes')}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1 divide-y divide-slate-100">
            {recentCustomers.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              recentCustomers.map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => onNavigate(`/admin/clientes/${cust.id}`)}
                  className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">{cust.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{cust.phone || cust.email || 'Sem contato'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {cust.qr_code_count || 0} placa(s)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Table: Latest Registered Plates */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Últimas Placas Cadastradas</h2>
          </div>
          <button
            onClick={() => onNavigate('/admin/qr-codes')}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
          >
            <span>Gerenciar todas as placas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Código Físico</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Destino Atual</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Escaneamentos</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentQRCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhuma placa cadastrada. Clique em "Cadastrar Placa" para começar.
                  </td>
                </tr>
              ) : (
                recentQRCodes.map((qr) => (
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
                      {qr.title && <p className="text-[11px] text-slate-400 mt-0.5">{qr.title}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{qr.customer_name || '—'}</span>
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
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          qr.status === 'ativo' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            qr.status === 'ativo' ? 'bg-emerald-600' : 'bg-amber-500'
                          }`}
                        />
                        {qr.status === 'ativo' ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 font-medium">
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
                          className="px-2.5 py-1 text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded transition-colors"
                        >
                          Trocar Link
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
