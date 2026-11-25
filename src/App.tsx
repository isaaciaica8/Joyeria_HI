/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AdminOverviewResponse,
  AuthStatusResponse,
  StorefrontResponse,
} from './types';
import {
  fetchAdminOverview,
  fetchAuthStatus,
  fetchStorefront,
} from './services/api';
import { PublicStorefront } from './components/PublicStorefront';
import { AdminAuthScreen } from './components/admin/AdminAuthScreen';
import { AdminPanel } from './components/admin/AdminPanel';

export default function App() {
  const [mode, setMode] = useState<'public' | 'admin'>('public');

  // Public storefront state
  const [storefront, setStorefront] = useState<StorefrontResponse | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);
  const [storeError, setStoreError] = useState('');

  // Admin auth & overview state (token kept strictly in React memory)
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewResponse | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const loadStorefront = useCallback(async () => {
    try {
      setStoreError('');
      const data = await fetchStorefront();
      setStorefront(data);
    } catch (err) {
      setStoreError(
        err instanceof Error ? err.message : 'No se pudo cargar el catálogo de Joyería HI.'
      );
    } finally {
      setLoadingStore(false);
    }
  }, []);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  const loadAdminSession = useCallback(async (tokenToUse: string | null) => {
    setLoadingAdmin(true);
    try {
      const status = await fetchAuthStatus(tokenToUse);
      setAuthStatus(status);
      if (tokenToUse && status.authenticated) {
        const overview = await fetchAdminOverview(tokenToUse);
        setAdminOverview(overview);
        if (status.username) setAdminUsername(status.username);
      } else {
        setAdminToken(null);
        setAdminOverview(null);
      }
    } catch {
      setAdminToken(null);
      setAdminOverview(null);
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  function handleOpenAdmin() {
    setMode('admin');
    void loadAdminSession(adminToken);
  }

  async function handleAuthenticated(token: string, username: string) {
    setAdminToken(token);
    setAdminUsername(username);
    await loadAdminSession(token);
  }

  async function handleRefreshAdmin() {
    if (!adminToken) return;
    const overview = await fetchAdminOverview(adminToken);
    setAdminOverview(overview);
    await loadStorefront();
  }

  function handleBackToStore() {
    setMode('public');
    void loadStorefront();
  }

  function handleLogout() {
    setAdminToken(null);
    setAdminUsername('');
    setAdminOverview(null);
    void loadAdminSession(null);
  }

  function handleProductViewed(productId: string, views: number) {
    setStorefront((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        products: prev.products.map((p) =>
          p.id === productId ? { ...p, views } : p
        ),
      };
    });
  }

  if (mode === 'admin') {
    if (loadingAdmin && !adminOverview && !authStatus) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="text-sm text-slate-600">Cargando panel administrativo...</div>
        </div>
      );
    }

    if (!adminToken || !adminOverview) {
      return (
        <AdminAuthScreen
          authStatus={
            authStatus || {
              initialized: false,
              envConfigured: false,
              authenticated: false,
            }
          }
          onAuthenticated={handleAuthenticated}
          onBackToStore={handleBackToStore}
        />
      );
    }

    return (
      <AdminPanel
        token={adminToken}
        username={adminUsername}
        overview={adminOverview}
        onRefresh={handleRefreshAdmin}
        onBackToStore={handleBackToStore}
        onLogout={handleLogout}
      />
    );
  }

  if (loadingStore) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6">
        <p className="font-display text-3xl font-semibold text-[#18181B]">Joyería HI</p>
        <p className="mt-2 text-sm text-[#6B6B73]">Preparando colección...</p>
      </div>
    );
  }

  if (storeError || !storefront) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6 text-center">
        <p className="font-display text-3xl font-semibold text-[#18181B]">Joyería HI</p>
        <p className="mt-2 text-sm text-[#991B1B]">
          {storeError || 'Ocurrió un error al cargar el catálogo.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadingStore(true);
            void loadStorefront();
          }}
          className="mt-4 px-5 py-2.5 rounded-lg bg-[#18181B] text-white text-sm font-medium cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <PublicStorefront
      data={storefront}
      onOpenAdmin={handleOpenAdmin}
      onProductViewed={handleProductViewed}
    />
  );
}
