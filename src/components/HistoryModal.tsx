import React, { useState, useEffect } from 'react';
import { X, History, ArrowRight, User, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { QRCodeItem, QRCodeHistory } from '../types';
import { api } from '../services/api';

interface HistoryModalProps {
  qrCodeId: string | null;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ qrCodeId, onClose }) => {
  const [qrCode, setQrCode] = useState<QRCodeItem | null>(null);
  const [history, setHistory] = useState<QRCodeHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (qrCodeId) {
      loadHistory();
    }
  }, [qrCodeId]);

  const loadHistory = async () => {
    if (!qrCodeId) return;
    setLoading(true);
    try {
      const res = await api.getQRCodeHistory(qrCodeId);
      setQrCode(res.qrCode);
      setHistory(res.history);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!qrCodeId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Histórico de Alterações</h2>
                {qrCode && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded">
                    {qrCode.code}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Auditoria de todos os links que já foram configurados para esta placa física
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Carregando histórico...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              Nenhuma alteração registrada ainda para este QR Code.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {history.map((item, idx) => {
                const dateObj = new Date(item.changed_at);
                const formattedDate = dateObj.toLocaleDateString('pt-BR');
                const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const isCreation = item.old_destination_url.includes('CRIAÇÃO');

                return (
                  <div key={item.id} className="relative group">
                    {/* Circle marker on timeline */}
                    <div
                      className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        idx === 0
                          ? 'bg-emerald-600 border-white ring-2 ring-emerald-200'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-white' : 'bg-slate-400'}`} />
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 hover:border-slate-300 transition-colors">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">{formattedDate}</span>
                          <span>às {formattedTime}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{item.changed_by}</span>
                        </div>
                      </div>

                      {/* URL transition */}
                      <div className="space-y-1.5 text-xs">
                        {!isCreation ? (
                          <>
                            <div className="flex items-center gap-2 text-slate-400 line-through truncate font-mono text-[11px]">
                              <span className="text-[10px] text-slate-400 uppercase font-sans">Anterior:</span>
                              <span className="truncate">{item.old_destination_url}</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-700 font-semibold truncate font-mono text-[11px]">
                              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <a
                                href={item.new_destination_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline truncate"
                              >
                                {item.new_destination_url}
                              </a>
                            </div>
                          </>
                        ) : (
                          <div className="text-emerald-700 font-medium font-mono text-[11px] truncate">
                            Criado com destino: {item.new_destination_url}
                          </div>
                        )}
                      </div>

                      {/* Reason */}
                      {item.reason && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
