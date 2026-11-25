/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, BOOTSTRAP_ADMIN_EMAIL, db, signOutAdmin } from './firebase';
import type {
  AdBanner,
  AdminOverviewResponse,
  Lead,
  Product,
  ProductViewEvent,
  StoreInfo,
} from './types';
import {
  seedFirestoreIfEmpty,
  subscribeBanners,
  subscribeLeads,
  subscribeProducts,
  subscribeProductViews,
  subscribeStoreInfo,
} from './services/firestoreStore';
import { DEFAULT_STORE_INFO, SEED_BANNERS, SEED_PRODUCTS } from './services/seedData';
import { getTodayISODate, isBannerCurrentlyVisible } from './utils/formatters';
import { PublicStorefront } from './components/PublicStorefront';
import { AdminAuthScreen } from './components/admin/AdminAuthScreen';
import { AdminPanel } from './components/admin/AdminPanel';

export default function App() {
  const [mode, setMode] = useState<'public' | 'admin'>('public');

  // Firebase Auth state
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  // Real-time Firestore collections
  const [products, setProducts] = useState<Product[]>(SEED_PRODUCTS);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [banners, setBanners] = useState<AdBanner[]>(SEED_BANNERS);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(DEFAULT_STORE_INFO);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [productViewEvents, setProductViewEvents] = useState<ProductViewEvent[]>([]);

  // Track auth state & verify admin role
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.emailVerified) {
        if (user.email === BOOTSTRAP_ADMIN_EMAIL) {
          setIsAuthorizedAdmin(true);
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            setIsAuthorizedAdmin(adminDoc.exists());
          } catch {
            setIsAuthorizedAdmin(false);
          }
        }
      } else {
        setIsAuthorizedAdmin(false);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  // Public real-time listeners (products, banners, boutique settings)
  useEffect(() => {
    const unsubProducts = subscribeProducts((items, isEmpty) => {
      setProducts(isEmpty ? SEED_PRODUCTS : items);
      setProductsLoaded(true);
    });
    const unsubBanners = subscribeBanners((items, isEmpty) => {
      setBanners(isEmpty ? SEED_BANNERS : items);
      setBannersLoaded(true);
    });
    const unsubStore = subscribeStoreInfo((info) => {
      setStoreInfo(info);
    });

    return () => {
      unsubProducts();
      unsubBanners();
      unsubStore();
    };
  }, []);

  // Admin-only listeners & automatic first-run Firestore seeding
  useEffect(() => {
    if (!authReady || !currentUser || !isAuthorizedAdmin) {
      setLeads([]);
      setProductViewEvents([]);
      return;
    }

    void seedFirestoreIfEmpty();
    const unsubLeads = subscribeLeads((items) => {
      setLeads(items);
    });
    const unsubViews = subscribeProductViews((views) => {
      setProductViewEvents(views);
    });

    return () => {
      unsubLeads();
      unsubViews();
    };
  }, [authReady, currentUser, isAuthorizedAdmin]);

  const viewCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    productViewEvents.forEach((v) => {
      counts[v.productId] = (counts[v.productId] || 0) + 1;
    });
    return counts;
  }, [productViewEvents]);

  const productsWithLiveViews = useMemo(() => {
    return products.map((p) => ({
      ...p,
      views: p.views + (viewCounts[p.id] || 0),
    }));
  }, [products, viewCounts]);

  const storefrontData = useMemo(() => {
    const today = getTodayISODate();
    return {
      products: productsWithLiveViews,
      banners: banners.filter((b) => isBannerCurrentlyVisible(b, today)),
      storeInfo,
    };
  }, [productsWithLiveViews, banners, storeInfo]);

  const adminOverview: AdminOverviewResponse = useMemo(() => {
    const today = getTodayISODate();
    const activePromotions = productsWithLiveViews.filter((p) => p.discountPercent > 0).length;
    const activeBanners = banners.filter((b) => isBannerCurrentlyVisible(b, today)).length;
    const newLeadsCount = leads.filter((l) => l.status === 'nuevo').length;
    const totalViews = productsWithLiveViews.reduce((acc, p) => acc + p.views, 0);

    return {
      products: productsWithLiveViews,
      banners,
      leads,
      productViews: productViewEvents,
      storeInfo,
      stats: {
        totalProducts: productsWithLiveViews.length,
        availableProducts: productsWithLiveViews.filter((p) => p.available).length,
        activePromotions,
        activeBanners,
        newLeadsCount,
        totalLeadsCount: leads.length,
        totalViews,
      },
    };
  }, [productsWithLiveViews, banners, leads, productViewEvents, storeInfo]);

  function handleProductViewed(productId: string, views: number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, views } : p))
    );
  }

  async function handleLogout() {
    await signOutAdmin();
  }

  if (mode === 'admin') {
    if (!authReady) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="text-sm text-slate-600">Verificando sesión de Firebase...</div>
        </div>
      );
    }

    if (!currentUser || !isAuthorizedAdmin) {
      return (
        <AdminAuthScreen
          currentUser={currentUser}
          isAuthorizedAdmin={isAuthorizedAdmin}
          onBackToStore={() => setMode('public')}
        />
      );
    }

    return (
      <AdminPanel
        username={currentUser.displayName || currentUser.email || 'Administrador'}
        overview={adminOverview}
        onBackToStore={() => setMode('public')}
        onLogout={() => void handleLogout()}
      />
    );
  }

  if (!productsLoaded && !bannersLoaded) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center p-6">
        <p className="font-display text-3xl font-semibold text-[#18181B]">Joyería HI</p>
        <p className="mt-2 text-sm text-[#6B6B73]">Conectando con catálogo...</p>
      </div>
    );
  }

  return (
    <PublicStorefront
      data={storefrontData}
      onOpenAdmin={() => setMode('admin')}
      onProductViewed={handleProductViewed}
    />
  );
}
