import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  ArrowRight,
  Calendar,
  User,
  ExternalLink,
  QrCode,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { QRCodeHistory } from '../types';
import { api } from '../services/api';

interface HistoryPageProps {
  onNavigate: (path: string) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onNavigate }) => {
  const [history, setHistory] = useState<QRCodeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      setHistory(res.recentChanges);
    } catch (err) {
      console.error('Erro ao carregar histórico global:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredHistory = history.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (item.qr_code && item.qr_code.toLowerCase().includes(term)) ||
      (item.customer_name && item.customer_name.toLowerCase().includes(term)) ||
      (item.new_destination_url && item.new_destination_url.toLowerCase().includes(term)) ||
      (item.old_destination_url && item.old_destination_url.toLowerCase().includes(term)) ||
      (item.reason && item.reason.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Histórico de Alterações de Destino</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro cronológico auditável de todas as modificações realizadas nas placas físicas.
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto"
          title="Recarregar histórico"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-xl shadow-2xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar por código (ex: A7K92X), cliente ou link..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-sans"
          />
        </div>
        <span className="text-xs text-slate-500">
          Mostrando <strong className="text-slate-900">{filteredHistory.length}</strong> evento(s)
        </span>
      </div>

      {/* History Timeline */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden p-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs">Carregando histórico...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">
            Nenhuma alteração encontrada com os filtros informados.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {filteredHistory.map((item, idx) => {
              const dateObj = new Date(item.changed_at);
              const isCreation = item.old_destination_url.includes('CRIAÇÃO');

              return (
                <div key={item.id} className="relative group">
                  {/* Timeline circle */}
                  <div
                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      idx === 0
                        ? 'bg-emerald-600 border-white ring-2 ring-emerald-200'
                        : 'bg-white border-slate-300'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-white' : 'bg-slate-400'}`} />
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 hover:border-slate-300 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {item.qr_code && (
                          <button
                            onClick={() => onNavigate(`/admin/qr-codes/${item.qr_code_id}`)}
                            className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs hover:border-slate-400 transition-colors"
                          >
                            {item.qr_code}
                          </button>
                        )}
                        <span className="font-semibold text-slate-800 text-xs">
                          {item.customer_name || 'Cliente'}
                        </span>
                        {item.qr_title && (
                          <span className="text-slate-400 text-xs hidden sm:inline">· {item.qr_title}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateObj.toLocaleDateString('pt-BR')} {dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.changed_by}</span>
                        </div>
                      </div>
                    </div>

                    {/* URL Change Description */}
                    <div className="font-mono text-xs space-y-1">
                      {!isCreation ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-slate-400 line-through truncate max-w-sm">
                            {item.old_destination_url}
                          </span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0 hidden sm:block" />
                          <a
                            href={item.new_destination_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 font-semibold hover:underline truncate"
                          >
                            {item.new_destination_url}
                          </a>
                        </div>
                      ) : (
                        <div className="text-emerald-700 font-medium">
                          Configuração inicial da placa: {item.new_destination_url}
                        </div>
                      )}
                    </div>

                    {item.reason && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                        <span className="text-slate-400 font-medium">Motivo: </span>
                        <span>{item.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
