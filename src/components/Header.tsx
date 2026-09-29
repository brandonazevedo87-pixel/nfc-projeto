import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';

interface HeaderProps {
  breadcrumbs: { label: string; path?: string }[];
  onNavigate: (path: string) => void;
  publicBaseUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumbs,
  onNavigate,
  publicBaseUrl,
}) => {
  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-10">
      {/* Breadcrumb Trail */}
      <nav className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-medium text-slate-400">Painel</span>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className="text-slate-300 font-mono">/</span>
            {crumb.path ? (
              <button
                onClick={() => onNavigate(crumb.path!)}
                className="hover:text-slate-900 transition-colors font-medium"
              >
                {crumb.label}
              </button>
            ) : (
              <span className="text-slate-900 font-semibold">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right Action Zone */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Domínio Público:</span>
          <span className="font-mono text-slate-800 font-medium truncate max-w-[200px]">
            {publicBaseUrl ? publicBaseUrl.replace(/^https?:\/\//, '') : 'qr.meudominio.com'}
          </span>
        </div>
      </div>
    </header>
  );
};
