import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  Copy,
  Check,
  Radio,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { QRCodeItem } from '../types';

interface QRCodeModalProps {
  qrCode: QRCodeItem | null;
  publicBaseUrl: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  qrCode,
  publicBaseUrl,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [plateStyle, setPlateStyle] = useState<'black' | 'silver' | 'white' | 'gold'>('black');
  const [showNfcBadge, setShowNfcBadge] = useState(true);
  const [svgContent, setSvgContent] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!qrCode) return null;

  const publicUrl = `${publicBaseUrl.replace(/\/+$/, '')}/q/${qrCode.code}`;

  useEffect(() => {
    // Renderiza o QR Code em alta resolução (1200x1200) no canvas
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        publicUrl,
        {
          width: 600,
          margin: 2,
          color: {
            dark: plateStyle === 'black' || plateStyle === 'gold' ? '#000000' : '#0F172A',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H', // Nível H permite inclusão de logo/resistência a riscos na placa física
        },
        (error) => {
          if (error) console.error('Erro ao renderizar canvas QR:', error);
        }
      );
    }

    // Gera SVG vetorial puro para corte a laser / gráfica
    QRCode.toString(
      publicUrl,
      {
        type: 'svg',
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      },
      (err, string) => {
        if (!err && string) {
          setSvgContent(string);
        }
      }
    );
  }, [publicUrl, plateStyle]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleDownloadPNG = () => {
    // Cria canvas temporário de 2000x2000px para qualidade máxima de impressão UV
    const tempCanvas = document.createElement('canvas');
    QRCode.toCanvas(
      tempCanvas,
      publicUrl,
      {
        width: 2000,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      },
      (err) => {
        if (!err) {
          const link = document.createElement('a');
          link.download = `QR_Placa_${qrCode.code}_UltraHD.png`;
          link.href = tempCanvas.toDataURL('image/png');
          link.click();
        }
      }
    );
  };

  const handleDownloadSVG = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `QR_Placa_${qrCode.code}_Vetorial.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const styleConfigs = {
    black: {
      bg: 'bg-zinc-950 border-zinc-800 text-white',
      accent: 'text-amber-400',
      badge: 'bg-zinc-900 border-zinc-800 text-zinc-300',
      title: 'Acrílico Black Piano',
    },
    silver: {
      bg: 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400 text-slate-900',
      accent: 'text-slate-800',
      badge: 'bg-slate-100 border-slate-300 text-slate-800',
      title: 'Aço Inox Escovado',
    },
    white: {
      bg: 'bg-white border-slate-300 text-slate-900 shadow-sm',
      accent: 'text-emerald-700',
      badge: 'bg-slate-100 border-slate-200 text-slate-700',
      title: 'Branco Minimalista Fosco',
    },
    gold: {
      bg: 'bg-gradient-to-b from-amber-100 via-amber-200 to-amber-300 border-amber-400 text-amber-950',
      accent: 'text-amber-900',
      badge: 'bg-amber-50/90 border-amber-300 text-amber-950',
      title: 'Dourado Escovado Luxo',
    },
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Placa Físico & QR Code</h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                {qrCode.code}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualização para fabricação da placa física e gravação a laser / impressão UV.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Physical Plate Mockup */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              Mockup da Placa Pronta
            </span>

            {/* Realistic Plate Preview Box */}
            <div
              className={`w-64 p-5 rounded-2xl border-2 flex flex-col items-center text-center shadow-lg transition-all duration-200 relative ${
                styleConfigs[plateStyle].bg
              }`}
            >
              {/* NFC Badge Tag */}
              {showNfcBadge && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border mb-3 ${
                    styleConfigs[plateStyle].badge
                  }`}
                >
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>NFC & QR DINÂMICO</span>
                </div>
              )}

              {/* Title / Client Label */}
              <div className="text-xs font-bold truncate max-w-[200px] mb-3">
                {qrCode.title || 'Aproxime ou Escaneie'}
              </div>

              {/* High-res White Backing QR Box */}
              <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-200/50 mb-3">
                <canvas ref={canvasRef} className="w-40 h-40 rounded" />
              </div>

              {/* Call to action & Permanent code */}
              <p className="text-[10px] font-medium opacity-80 mb-1">
                Aponte a câmera ou aproxime o celular
              </p>
              <div className="font-mono text-xs font-extrabold tracking-widest opacity-90">
                CÓDIGO: {qrCode.code}
              </div>
            </div>

            {/* Material Style Selector */}
            <div className="flex items-center gap-1.5 mt-4">
              {(['black', 'silver', 'white', 'gold'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => setPlateStyle(style)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all ${
                    plateStyle === style
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {style === 'black' ? 'Black' : style === 'silver' ? 'Inox' : style === 'white' ? 'Branco' : 'Dourado'}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Technical Specs & Export Tools */}
          <div className="flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                URL Pública Permanente
              </h3>

              {/* Copy URL Box */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-mono text-slate-800 break-all select-all font-semibold">
                  {publicUrl}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Gravado permanentemente na placa</span>
                  <button
                    onClick={handleCopyUrl}
                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Specs & Plate Manufacturing Details */}
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Código da Placa:</span>
                  <span className="font-mono font-bold text-slate-900">{qrCode.code}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Cliente Proprietário:</span>
                  <span className="font-medium text-slate-900">{qrCode.customer_name || 'Não informado'}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Redirecionamento Atual:</span>
                  <a
                    href={qrCode.destination_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline flex items-center gap-1 max-w-[150px] truncate"
                  >
                    <span className="truncate">{qrCode.destination_url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Total de Escaneamentos:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{qrCode.scan_count}</span>
                </div>
              </div>
            </div>

            {/* Export Actions for Physical Printing */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700 block">
                Arquivos para Produção Gráfica
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadPNG}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG 2000px (HD)</span>
                </button>
                <button
                  onClick={handleDownloadSVG}
                  className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SVG Vetorial (Laser)</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                O arquivo SVG é 100% vetorial, ideal para plotter de corte, laser CO2 e impressão UV em acrílico.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
