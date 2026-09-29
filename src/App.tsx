/**
 * QR Placas - Plataforma de Gerenciamento de QR Codes Dinâmicos
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { CustomerDetail } from './pages/CustomerDetail';
import { QRCodes } from './pages/QRCodes';
import { QRCodeDetail } from './pages/QRCodeDetail';
import { HistoryPage } from './pages/HistoryPage';
import { Settings } from './pages/Settings';
import { PublicRedirect } from './pages/PublicRedirect';

// Modals
import { QRCodeModal } from './components/QRCodeModal';
import { ChangeDestinationModal } from './components/ChangeDestinationModal';
import { CustomerModal } from './components/CustomerModal';
import { CreateQRCodeModal } from './components/CreateQRCodeModal';
import { HistoryModal } from './components/HistoryModal';

import { getStoredToken, api } from './services/api';
import { QRCodeItem, Customer } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/admin/login');
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [publicBaseUrl, setPublicBaseUrl] = useState<string>(window.location.origin);

  // Global Modal States
  const [viewingQR, setViewingQR] = useState<QRCodeItem | null>(null);
  const [changingDestinationQR, setChangingDestinationQR] = useState<QRCodeItem | null>(null);
  const [viewingHistoryQRId, setViewingHistoryQRId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isCreateQRModalOpen, setIsCreateQRModalOpen] = useState(false);
  const [createQRPreselectedCustomer, setCreateQRPreselectedCustomer] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  // Sincronização de rotas com a barra de endereços do navegador (SPA)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Carrega configurações públicas (domínio customizado)
  const loadConfig = async () => {
    try {
      const res = await api.getPublicConfig();
      if (res.baseUrl) {
        setPublicBaseUrl(res.baseUrl);
      }
    } catch {
      // Fallback para origin local
      setPublicBaseUrl(window.location.origin);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [refreshKey]);

  // Se o usuário acessar a raiz /, redireciona
  useEffect(() => {
    if (currentPath === '/' || currentPath === '') {
      if (getStoredToken()) {
        navigate('/admin/dashboard');
      } else {
        navigate('/admin/login');
      }
    }
  }, [currentPath]);

  // ROTA PÚBLICA: /q/:code
  if (currentPath.startsWith('/q/')) {
    const code = currentPath.substring(3);
    return <PublicRedirect code={code} />;
  }

  // ROTA DE LOGIN: /admin/login
  if (currentPath === '/admin/login' || !token) {
    return (
      <Login
        onLoginSuccess={() => {
          setToken(getStoredToken());
          navigate('/admin/dashboard');
        }}
      />
    );
  }

  // Handlers para abrir modais com dados
  const handleOpenQRCodeModal = (qr: QRCodeItem) => {
    setViewingQR(qr);
  };

  const handleOpenChangeDestination = (qr: QRCodeItem) => {
    setChangingDestinationQR(qr);
  };

  const handleOpenHistoryModal = (qrId: string) => {
    setViewingHistoryQRId(qrId);
  };

  const handleOpenCreateCustomer = () => {
    setEditingCustomer(null);
    setIsCustomerModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsCustomerModalOpen(true);
  };

  const handleOpenCreateQR = (customerId?: string) => {
    setCreateQRPreselectedCustomer(customerId);
    setIsCreateQRModalOpen(true);
  };

  const handleDataChanged = () => {
    setRefreshKey((k) => k + 1);
  };

  // Gerador de Breadcrumbs
  const getBreadcrumbs = () => {
    if (currentPath === '/admin/dashboard') {
      return [{ label: 'Visão Geral' }];
    }
    if (currentPath === '/admin/clientes') {
      return [{ label: 'Clientes' }];
    }
    if (currentPath.startsWith('/admin/clientes/')) {
      return [{ label: 'Clientes', path: '/admin/clientes' }, { label: 'Detalhes do Cliente' }];
    }
    if (currentPath === '/admin/qr-codes') {
      return [{ label: 'QR Codes & Placas' }];
    }
    if (currentPath.startsWith('/admin/qr-codes/')) {
      return [{ label: 'QR Codes & Placas', path: '/admin/qr-codes' }, { label: 'Detalhes da Placa' }];
    }
    if (currentPath === '/admin/historico') {
      return [{ label: 'Histórico de Destinos' }];
    }
    if (currentPath === '/admin/configuracoes') {
      return [{ label: 'Configurações' }];
    }
    return [{ label: 'Painel' }];
  };

  // Renderizador de rotas do painel
  const renderContent = () => {
    if (currentPath === '/admin/dashboard') {
      return (
        <Dashboard
          key={refreshKey}
          onNavigate={navigate}
          onOpenCreateQR={() => handleOpenCreateQR()}
          onOpenCreateCustomer={handleOpenCreateCustomer}
          onOpenQRCodeModal={handleOpenQRCodeModal}
          onOpenChangeDestination={handleOpenChangeDestination}
          publicBaseUrl={publicBaseUrl}
        />
      );
    }

    if (currentPath === '/admin/clientes') {
      return (
        <Customers
          key={refreshKey}
          onNavigate={navigate}
          onOpenCreateCustomer={handleOpenCreateCustomer}
          onEditCustomer={handleEditCustomer}
          onOpenCreateQRForCustomer={(id) => handleOpenCreateQR(id)}
        />
      );
    }

    if (currentPath.startsWith('/admin/clientes/')) {
      const customerId = currentPath.replace('/admin/clientes/', '');
      return (
        <CustomerDetail
          key={`${customerId}-${refreshKey}`}
          customerId={customerId}
          onNavigate={navigate}
          onEditCustomer={handleEditCustomer}
          onOpenCreateQRForCustomer={(id) => handleOpenCreateQR(id)}
          onOpenQRCodeModal={handleOpenQRCodeModal}
          onOpenChangeDestination={handleOpenChangeDestination}
          onOpenHistoryModal={handleOpenHistoryModal}
          publicBaseUrl={publicBaseUrl}
        />
      );
    }

    if (currentPath === '/admin/qr-codes') {
      return (
        <QRCodes
          key={refreshKey}
          onNavigate={navigate}
          onOpenCreateQR={() => handleOpenCreateQR()}
          onOpenQRCodeModal={handleOpenQRCodeModal}
          onOpenChangeDestination={handleOpenChangeDestination}
          onOpenHistoryModal={handleOpenHistoryModal}
          publicBaseUrl={publicBaseUrl}
        />
      );
    }

    if (currentPath.startsWith('/admin/qr-codes/')) {
      const qrId = currentPath.replace('/admin/qr-codes/', '').replace('/historico', '');
      return (
        <QRCodeDetail
          key={`${qrId}-${refreshKey}`}
          qrCodeId={qrId}
          onNavigate={navigate}
          onOpenQRCodeModal={handleOpenQRCodeModal}
          onOpenChangeDestination={handleOpenChangeDestination}
          publicBaseUrl={publicBaseUrl}
        />
      );
    }

    if (currentPath === '/admin/historico') {
      return <HistoryPage key={refreshKey} onNavigate={navigate} />;
    }

    if (currentPath === '/admin/configuracoes') {
      return <Settings key={refreshKey} onSettingsUpdated={handleDataChanged} />;
    }

    // Default: Redireciona para o dashboard
    return (
      <Dashboard
        key={refreshKey}
        onNavigate={navigate}
        onOpenCreateQR={() => handleOpenCreateQR()}
        onOpenCreateCustomer={handleOpenCreateCustomer}
        onOpenQRCodeModal={handleOpenQRCodeModal}
        onOpenChangeDestination={handleOpenChangeDestination}
        publicBaseUrl={publicBaseUrl}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={navigate}
        onOpenCreateQR={() => handleOpenCreateQR()}
        onOpenCreateCustomer={handleOpenCreateCustomer}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header
          breadcrumbs={getBreadcrumbs()}
          onNavigate={navigate}
          publicBaseUrl={publicBaseUrl}
        />
        <main className="flex-1 pb-16">{renderContent()}</main>
      </div>

      {/* Global Modals */}
      <QRCodeModal
        qrCode={viewingQR}
        publicBaseUrl={publicBaseUrl}
        onClose={() => setViewingQR(null)}
      />

      <ChangeDestinationModal
        qrCode={changingDestinationQR}
        onClose={() => setChangingDestinationQR(null)}
        onSuccess={handleDataChanged}
      />

      <HistoryModal
        qrCodeId={viewingHistoryQRId}
        onClose={() => setViewingHistoryQRId(null)}
      />

      <CustomerModal
        isOpen={isCustomerModalOpen}
        customer={editingCustomer}
        onClose={() => {
          setIsCustomerModalOpen(false);
          setEditingCustomer(null);
        }}
        onSuccess={handleDataChanged}
      />

      <CreateQRCodeModal
        isOpen={isCreateQRModalOpen}
        preselectedCustomerId={createQRPreselectedCustomer}
        onClose={() => {
          setIsCreateQRModalOpen(false);
          setCreateQRPreselectedCustomer(undefined);
        }}
        onSuccess={(newId) => {
          handleDataChanged();
          navigate(`/admin/qr-codes/${newId}`);
        }}
      />
    </div>
  );
}
