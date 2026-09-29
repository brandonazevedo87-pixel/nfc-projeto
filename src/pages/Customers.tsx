import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Archive,
  QrCode,
  Phone,
  Mail,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Customer } from '../types';
import { api } from '../services/api';

interface CustomersProps {
  onNavigate: (path: string) => void;
  onOpenCreateCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onOpenCreateQRForCustomer: (customerId: string) => void;
}

export const Customers: React.FC<CustomersProps> = ({
  onNavigate,
  onOpenCreateCustomer,
  onEditCustomer,
  onOpenCreateQRForCustomer,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadCustomers = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await api.getCustomers({
        search: search.trim() || undefined,
        status: statusFilter !== 'todos' ? statusFilter : undefined,
      });
      setCustomers(res.customers);
    } catch (err: any) {
      console.error('Erro ao listar clientes:', err);
      setActionError(err.message || 'Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCustomers();
  };

  const handleToggleStatus = async (customer: Customer) => {
    const nextStatus = customer.status === 'ativo' ? 'desativado' : 'ativo';
    try {
      await api.setCustomerStatus(customer.id, nextStatus);
      loadCustomers();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao atualizar status.');
    }
  };

  const handleArchive = async (customer: Customer) => {
    const nextStatus = customer.status === 'arquivado' ? 'ativo' : 'arquivado';
    try {
      await api.setCustomerStatus(customer.id, nextStatus);
      loadCustomers();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao arquivar cliente.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteCustomer(id);
      setDeleteConfirmId(null);
      loadCustomers();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao excluir cliente.');
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gerenciamento de Clientes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre proprietários de placas e acompanhe seus QR Codes e histórico.
          </p>
        </div>
        <button
          onClick={onOpenCreateCustomer}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
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
            { label: 'Arquivados', value: 'arquivado' },
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

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

      {/* Customers Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Telefone / WhatsApp</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4 text-center">Placas (QR Codes)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Cadastrado em</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Carregando clientes...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const date = new Date(c.created_at);
                  const isDeleting = deleteConfirmId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => onNavigate(`/admin/clientes/${c.id}`)}
                          className="font-semibold text-slate-900 hover:text-emerald-700 text-left transition-colors"
                        >
                          {c.name}
                        </button>
                        {c.notes && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                            {c.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        {c.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {c.email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[180px]">{c.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onNavigate(`/admin/clientes/${c.id}`)}
                          className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                        >
                          <QrCode className="w-3 h-3 text-slate-500" />
                          <span>{c.qr_code_count || 0}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            c.status === 'ativo'
                              ? 'text-emerald-700'
                              : c.status === 'desativado'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.status === 'ativo'
                                ? 'bg-emerald-600'
                                : c.status === 'desativado'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {c.status === 'ativo' ? 'Ativo' : c.status === 'desativado' ? 'Desativado' : 'Arquivado'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {date.toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] text-red-600 font-medium">Excluir?</span>
                            <button
                              onClick={() => handleDelete(c.id)}
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onOpenCreateQRForCustomer(c.id)}
                              title="Adicionar Placa para este cliente"
                              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onNavigate(`/admin/clientes/${c.id}`)}
                              title="Visualizar detalhes e placas"
                              className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                            >
                              Ver Placas
                            </button>
                            <button
                              onClick={() => onEditCustomer(c)}
                              title="Editar cliente"
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(c.id)}
                              title="Excluir cliente"
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
