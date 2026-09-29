import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, QrCode, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

interface PublicRedirectProps {
  code: string;
}

export const PublicRedirect: React.FC<PublicRedirectProps> = ({ code }) => {
  const [status, setStatus] = useState<'checking' | 'active' | 'inactive' | 'not_found'>('checking');
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [plateTitle, setPlateTitle] = useState<string | null>(null);

  useEffect(() => {
    // A rota principal do servidor (/q/:code) redireciona com HTTP 302 direto no backend.
    // Se o cliente carregar esta view via SPA, fazemos o redirecionamento imediato aqui.
    const checkAndRedirect = async () => {
      try {
        const res = await api.checkPublicCode(code);
        if (!res.exists) {
          setStatus('not_found');
          return;
        }

        if (res.status !== 'ativo') {
          setStatus('inactive');
          setPlateTitle(res.title);
          return;
        }

        // Faz requisição nativa para o servidor efetuar o 302
        window.location.replace(`/q/${code}`);
      } catch (err) {
        setStatus('not_found');
      }
    };

    checkAndRedirect();
  }, [code]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-xs text-slate-400 font-mono">Redirecionando placa {code.toUpperCase()}...</p>
        </div>
      </div>
    );
  }

  if (status === 'inactive') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 text-center text-white space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
            STATUS: PAUSADO
          </span>
          <h1 className="text-lg font-bold">Placa Temporariamente Indisponível</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            O proprietário desta placa pausou temporariamente o redirecionamento deste QR Code. Por favor, tente novamente mais tarde.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Código da Placa:</span>
            <span className="text-white font-bold">{code.toUpperCase()}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-8 text-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <span className="text-[11px] font-mono font-semibold px-2.5 py-1 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">
          STATUS: 404
        </span>
        <h1 className="text-lg font-bold">QR Code Não Encontrado</h1>
        <p className="text-xs text-slate-400 leading-relaxed">
          O código escaneado não foi localizado na base de placas cadastradas. Verifique se o código gravado na placa está correto.
        </p>
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 flex items-center justify-between">
          <span>Código Lido:</span>
          <span className="text-amber-400 font-bold">{code.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};
