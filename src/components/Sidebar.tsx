import React from 'react';
import {
  LayoutDashboard,
  Users,
  QrCode,
  History,
  Settings,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { clearStoredAuth, getStoredUser } from '../services/api';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenCreateQR: () => void;
  onOpenCreateCustomer: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  onOpenCreateQR,
  onOpenCreateCustomer,
}) => {
  const user = getStoredUser();

  const handleLogout = () => {
    clearStoredAuth();
    onNavigate('/admin/login');
  };

  const navItems = [
    {
      label: 'Visão Geral',
      path: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Clientes',
      path: '/admin/clientes',
      icon: Users,
    },
    {
      label: 'QR Codes & Placas',
      path: '/admin/qr-codes',
      icon: QrCode,
    },
    {
      label: 'Histórico de Destinos',
      path: '/admin/historico',
      icon: History,
    },
    {
      label: 'Configurações',
      path: '/admin/configuracoes',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen sticky top-0 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-white tracking-tight text-sm block">QR Placas</span>
            <span className="text-[11px] text-slate-500 font-mono block">Dynamic NFC & QR</span>
          </div>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="p-4 border-b border-slate-800/60">
        <button
          onClick={onOpenCreateQR}
          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Nova Placa</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path !== '/admin/dashboard' && currentPath.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                isActive
                  ? 'bg-slate-800 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Production Notice */}
      <div className="p-4 mx-3 mb-3 rounded-lg bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Produção Cloudflare D1</span>
        </div>
        <p className="text-slate-400 leading-relaxed">
          Placas físicas com códigos permanentes e redirecionamento edge.
        </p>
      </div>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300 shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name || 'Administrador'}</p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email || 'admin@qrplacas.com'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Encerrar Sessão"
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
