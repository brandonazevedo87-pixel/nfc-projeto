import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  History,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { QRCodeItem, QRCodeHistory } from '../types';
import { api } from '../services/api';

interface QRCodeDetailProps {
  qrCodeId: string;
  onNavigate: (path: string) => void;
  onOpenQRCodeModal: (qr: QRCodeItem) => void;
  onOpenChangeDestination: (qr: QRCodeItem) => void;
  publicBaseUrl: string;
}

export const QRCodeDetail: React.FC<QRCodeDetailProps> = ({
  qrCodeId,
  onNavigate,
  onOpenQRCodeModal,
  onOpenChangeDestination,
  publicBaseUrl,
}) => {
  const [qrCode, setQrCode] = useState<QRCodeItem | null>(null);
  const [history, setHistory] = useState<QRCodeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getQRCode(qrCodeId);
      setQrCode(res.qrCode);
      setHistory(res.history);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar detalhes da placa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [qrCodeId]);

  const publicUrl = qrCode ? `${publicBaseUrl.replace(/\/+$/, '')}/q/${qrCode.code}` : '';

  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar URL:', err);
    }
  };

  const handleToggleStatus = async () => {
    if (!qrCode) return;
    const nextStatus = qrCode.status === 'ativo' ? 'desativado' : 'ativo';
    try {
      await api.setQRCodeStatus(qrCode.id, nextStatus);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="text-xs font-medium">Carregando detalhes da placa...</span>
        </div>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Placa Não Encontrada</h2>
        <p className="text-xs text-slate-500">Esta placa não foi encontrada ou foi removida.</p>
        <button
          onClick={() => onNavigate('/admin/qr-codes')}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
        >
          Voltar para Placas
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('/admin/qr-codes')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar para todas as placas</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Plate Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm tracking-wider shrink-0">
              {qrCode.code.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold font-mono text-slate-900 tracking-wider">
                  {qrCode.code}
                </h1>
                <button
                  onClick={handleToggleStatus}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${
                    qrCode.status === 'ativo'
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  {qrCode.status === 'ativo' ? 'Ativo' : 'Desativado'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                {qrCode.title || 'Placa Física QR Code'} · Proprietário:{' '}
                <button
                  onClick={() => onNavigate(`/admin/clientes/${qrCode.customer_id}`)}
                  className="text-slate-800 font-semibold hover:underline"
                >
                  {qrCode.customer_name || 'Cliente'}
                </button>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={() => onOpenQRCodeModal(qrCode)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Ver Placa & Baixar</span>
            </button>
            <button
              onClick={() => onOpenChangeDestination(qrCode)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Alterar Destino</span>
            </button>
          </div>
        </div>

        {/* Current Destination & Technical Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              URL Pública Permanente da Placa
            </span>
            <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded font-mono text-xs text-slate-800 select-all">
              <span className="truncate">{publicUrl}</span>
              <button
                onClick={handleCopyLink}
                className="p-1 text-slate-500 hover:text-slate-900 transition-colors shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Este é o endereço gravado fisicamente na placa ou etiqueta NFC.
            </p>
          </div>

          <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-lg space-y-2">
            <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
              Destino Atual de Redirecionamento
            </span>
            <div className="flex items-center justify-between gap-2 p-2 bg-white border border-emerald-200 rounded font-mono text-xs text-emerald-800 select-all">
              <span className="truncate">{qrCode.destination_url}</span>
              <a
                href={qrCode.destination_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 text-slate-400 hover:text-emerald-700 transition-colors shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-[11px] text-emerald-700/80">
              Ao escanear a placa, o visitante é imediatamente redirecionado para este endereço.
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-400">Total de Scans</div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {qrCode.scan_count}
            </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-400">Último Scan</div>
            <div className="text-xs font-mono text-slate-700 mt-1">
              {qrCode.last_scanned_at
                ? new Date(qrCode.last_scanned_at).toLocaleDateString('pt-BR')
                : 'Nenhum ainda'}
            </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-400">Data de Fabricação/Criação</div>
            <div className="text-xs font-mono text-slate-700 mt-1">
              {new Date(qrCode.created_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-[11px] text-slate-400">Última Atualização</div>
            <div className="text-xs font-mono text-slate-700 mt-1">
              {new Date(qrCode.updated_at).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">
              Histórico Completo de Alterações de Link ({history.length})
            </h2>
          </div>
        </div>

        <div className="p-6">
          {history.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Nenhuma alteração registrada para esta placa.
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h) => {
                const date = new Date(h.changed_at);
                const isCreation = h.old_destination_url.includes('CRIAÇÃO');

                return (
                  <div
                    key={h.id}
                    className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold">{date.toLocaleDateString('pt-BR')}</span>
                        <span>às {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Responsável: {h.changed_by}</span>
                      </div>
                    </div>

                    <div className="font-mono text-[11px] space-y-1">
                      {!isCreation ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-slate-400 line-through truncate max-w-sm">
                            {h.old_destination_url}
                          </span>
                          <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0 hidden sm:block" />
                          <span className="text-emerald-700 font-semibold truncate">
                            {h.new_destination_url}
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-medium">
                          Criação inicial da placa: {h.new_destination_url}
                        </span>
                      )}
                    </div>

                    {h.reason && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                        <span className="text-slate-400 font-medium">Motivo: </span>
                        <span>{h.reason}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
