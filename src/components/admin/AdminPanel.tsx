import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Edit3,
  FileSpreadsheet,
  Gem,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  Percent,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminNotificationStatus,
  AdminOverviewResponse,
  Lead,
  Product,
  ProductCategory,
} from '../../types';
import {
  applyPromotionInFirestore,
  deleteLeadInFirestore,
  deleteProductInFirestore,
  fetchAdminNotificationStatus,
  saveProductInFirestore,
  sendTestAdminNotification,
  toggleProductAvailabilityInFirestore,
  updateLeadStatusInFirestore,
} from '../../services/firestoreStore';
import {
  PRODUCT_CATEGORIES,
  buildWhatsAppGeneralUrl,
  formatCurrencyMXN,
  formatShortDate,
  getFinalPrice,
} from '../../utils/formatters';
import {
  exportCatalogToExcel,
  exportCatalogToPDF,
  exportLeadsToExcel,
  exportLeadsToPDF,
} from '../../utils/exportUtils';
import { JewelryImage } from '../JewelryImage';
import { ThemeToggle } from '../ThemeToggle';
import { AdminBannerStudio } from './AdminBannerStudio';
import { AdminProductModal } from './AdminProductModal';
import { CategoryInterestChart } from './CategoryInterestChart';

interface AdminPanelProps {
  username: string;
  overview: AdminOverviewResponse;
  onBackToStore: () => void;
  onLogout: () => void;
}

type AdminSection =
  | 'dashboard'
  | 'productos'
  | 'publicidad'
  | 'promociones'
  | 'clientes';

const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: 'Panel Principal',
  productos: 'Productos',
  publicidad: 'Publicidad',
  promociones: 'Promociones',
  clientes: 'Clientes Interesados',
};

export function AdminPanel({
  username,
  overview,
  onBackToStore,
  onLogout,
}: AdminPanelProps) {
  const { products, banners, leads, productViews, storeInfo, stats } = overview;

  const [section, setSection] = useState<AdminSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Products state
  const [productSearch, setProductSearch] = useState('');
  const [productCatFilter, setProductCatFilter] = useState('Todas');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);

  // Promotions state
  const [promoScope, setPromoScope] = useState<'category' | 'product'>('category');
  const [promoTargetCategory, setPromoTargetCategory] =
    useState<ProductCategory>('Anillos');
  const [promoTargetProductId, setPromoTargetProductId] = useState<string>(
    products[0]?.id || ''
  );
  const [promoPercent, setPromoPercent] = useState('15');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoNotice, setPromoNotice] = useState('');

  // Leads state
  const [leadProductFilter, setLeadProductFilter] = useState('Todos');
  const [leadStatusFilter, setLeadStatusFilter] = useState('Todos');
  const [leadDateFrom, setLeadDateFrom] = useState('');
  const [leadDateTo, setLeadDateTo] = useState('');

  // Email notifications status state
  const [notifStatus, setNotifStatus] = useState<AdminNotificationStatus | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifTestBusy, setNotifTestBusy] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (section !== 'clientes') return;
    let cancelled = false;
    setNotifLoading(true);
    fetchAdminNotificationStatus()
      .then((status) => {
        if (!cancelled) setNotifStatus(status);
      })
      .catch(() => {
        if (!cancelled) setNotifStatus(null);
      })
      .finally(() => {
        if (!cancelled) setNotifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, leads.length]);

  const topConsultedProducts = useMemo(
    () => [...products].sort((a, b) => b.views - a.views).slice(0, 5),
    [products]
  );

  const maxViews = topConsultedProducts[0]?.views || 1;

  const filteredProducts = useMemo(() => {
    const normalizeText = (text: string) =>
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const q = normalizeText(productSearch.trim());
    return products.filter((p) => {
      if (productCatFilter !== 'Todas' && p.category !== productCatFilter) return false;
      if (q) {
        const hay = normalizeText(
          `${p.name} ${p.category} ${p.sku} ${p.material} ${p.karat}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, productSearch, productCatFilter]);

  const discountedProducts = useMemo(
    () => products.filter((p) => p.discountPercent > 0),
    [products]
  );

  const uniqueLeadProducts = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.productName) set.add(l.productName);
    });
    return Array.from(set);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (leadProductFilter !== 'Todos' && lead.productName !== leadProductFilter) {
        return false;
      }
      if (leadStatusFilter !== 'Todos' && lead.status !== leadStatusFilter) {
        return false;
      }
      const createdDay = lead.createdAt.slice(0, 10);
      if (leadDateFrom && createdDay < leadDateFrom) return false;
      if (leadDateTo && createdDay > leadDateTo) return false;
      return true;
    });
  }, [leads, leadProductFilter, leadStatusFilter, leadDateFrom, leadDateTo]);

  async function handleSaveProduct(payload: Partial<Product>) {
    await saveProductInFirestore(editingProduct ? editingProduct.id : null, payload);
  }

  async function handleToggleAvailability(p: Product) {
    await toggleProductAvailabilityInFirestore(p.id, !p.available);
  }

  async function handleDeleteProduct(id: string) {
    await deleteProductInFirestore(id);
  }

  async function handleApplyPromotion(e: React.FormEvent) {
    e.preventDefault();
    setPromoNotice('');
    setPromoBusy(true);
    try {
      const targetId =
        promoScope === 'category' ? promoTargetCategory : promoTargetProductId;
      const pct = Math.min(90, Math.max(0, Number(promoPercent) || 0));
      const updatedCount = await applyPromotionInFirestore(
        promoScope,
        targetId,
        pct,
        products
      );
      setPromoNotice(
        `Descuento del ${pct}% aplicado a ${updatedCount} ${
          updatedCount === 1 ? 'pieza' : 'piezas'
        }.`
      );
    } finally {
      setPromoBusy(false);
    }
  }

  async function handleRemoveProductDiscount(productId: string) {
    await applyPromotionInFirestore('product', productId, 0, products);
  }

  async function handleLeadStatusChange(id: string, status: Lead['status']) {
    await updateLeadStatusInFirestore(id, status);
  }

  async function handleDeleteLead(id: string) {
    await deleteLeadInFirestore(id);
  }

  async function handleTestNotification() {
    setNotifFeedback(null);
    setNotifTestBusy(true);
    try {
      const result = await sendTestAdminNotification();
      setNotifFeedback({
        ok: result.sent,
        text: result.detail,
      });
      const refreshed = await fetchAdminNotificationStatus();
      setNotifStatus(refreshed);
    } catch (err) {
      setNotifFeedback({
        ok: false,
        text:
          err instanceof Error ? err.message : 'No se pudo enviar el correo de prueba.',
      });
    } finally {
      setNotifTestBusy(false);
    }
  }

  const navItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'productos', label: 'Productos', icon: Gem, count: products.length },
    { id: 'publicidad', label: 'Publicidad', icon: Megaphone, count: banners.length },
    {
      id: 'promociones',
      label: 'Promociones',
      icon: Percent,
      count: discountedProducts.length,
    },
    {
      id: 'clientes',
      label: 'Clientes Interesados',
      icon: Users,
      count: stats.newLeadsCount,
    },
  ];

  function selectSection(next: AdminSection) {
    setSection(next);
    setSidebarOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-slate-100 flex transition-colors duration-200">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (260px) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <span className="font-display text-2xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
              Joyería HI
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#18181B] dark:bg-slate-800 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono-tabular text-xs ${
                        active
                          ? 'text-[#DFC58B]'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Sesión activa</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {username}
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToStore}
            className="w-full inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver tienda pública</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">Administración</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {SECTION_LABELS[section]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="admin" />
            <button
              type="button"
              onClick={() => exportCatalogToExcel(products)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportCatalogToPDF(products)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181B] dark:bg-[#DFC58B] text-white dark:text-[#18181B] text-xs font-medium hover:bg-[#2E2E33] dark:hover:bg-[#C5A059] cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Catálogo PDF</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* 1. DASHBOARD */}
          {section === 'dashboard' && (
            <div className="space-y-8">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Resumen General de Joyería HI
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Indicadores actualizados de catálogo, campañas publicitarias y clientes interesados.
                </p>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total de productos
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900 dark:text-slate-100">
                    {stats.totalProducts}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {stats.availableProducts} disponibles ·{' '}
                    {stats.totalProducts - stats.availableProducts} agotados
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Promociones activas
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900 dark:text-slate-100">
                    {stats.activePromotions}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {stats.activeBanners} banners vigentes hoy
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Clientes interesados nuevos
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-[#8C6D2E] dark:text-[#DFC58B]">
                    {stats.newLeadsCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {stats.totalLeadsCount} registros acumulados
                  </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Consultas de productos
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900 dark:text-slate-100">
                    {stats.totalViews}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Aperturas de fichas en catálogo
                  </p>
                </div>
              </div>

              {/* Category Interest Volume Over Time */}
              <CategoryInterestChart
                products={products}
                leads={leads}
                productViews={productViews}
              />

              {/* Most Consulted + Recent Leads */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Productos más consultados
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('productos')}
                      className="text-xs font-medium text-[#8C6D2E] dark:text-[#DFC58B] hover:underline cursor-pointer"
                    >
                      Ver catálogo
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topConsultedProducts.map((p, idx) => {
                      const pct = Math.round((p.views / maxViews) * 100);
                      return (
                        <div key={p.id} className="p-4 sm:px-5 flex items-center gap-4">
                          <span className="font-mono-tabular text-xs font-semibold text-slate-400 dark:text-slate-500 w-5">
                            0{idx + 1}
                          </span>
                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                            <JewelryImage
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {p.name}
                              </p>
                              <span className="font-mono-tabular text-xs font-semibold text-slate-900 dark:text-slate-200 shrink-0">
                                {p.views} consultas
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#8C6D2E] dark:bg-[#DFC58B]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Clientes recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('clientes')}
                      className="text-xs font-medium text-[#8C6D2E] dark:text-[#DFC58B] hover:underline cursor-pointer"
                    >
                      Gestionar todos
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="p-4 sm:px-5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {lead.name}
                          </p>
                          <span
                            className={`text-xs font-medium ${
                              lead.status === 'nuevo'
                                ? 'text-[#8C6D2E] dark:text-[#DFC58B]'
                                : lead.status === 'contactado'
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {lead.status === 'nuevo'
                              ? 'Nuevo'
                              : lead.status === 'contactado'
                              ? 'Contactado'
                              : 'Cerrado'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                          Interés: {lead.productName}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-tabular">
                          {formatShortDate(lead.createdAt)} · {lead.phone}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. GESTIÓN DE PRODUCTOS */}
          {section === 'productos' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Gestión de Productos
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Agrega piezas, sube múltiples fotos por arrastre, marca agotados y exporta tu catálogo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportCatalogToExcel(products)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCatalogToPDF(products)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B]" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#18181B] dark:bg-[#DFC58B] text-white dark:text-[#18181B] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#C5A059] cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar producto</span>
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Row */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      aria-label="Buscar productos por nombre o categoría"
                      placeholder="Buscar pieza por nombre, categoría, SKU o material..."
                      className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 dark:focus:ring-[#DFC58B]/40"
                    />
                    {productSearch && (
                      <button
                        type="button"
                        onClick={() => setProductSearch('')}
                        aria-label="Limpiar búsqueda"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="Filtrar por categoría"
                    value={productCatFilter}
                    onChange={(e) => setProductCatFilter(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 dark:focus:ring-[#DFC58B]/40"
                  >
                    <option value="Todas">Todas las categorías</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                  <span className="tabular-nums">
                    Mostrando {filteredProducts.length} de {products.length}{' '}
                    {products.length === 1 ? 'pieza' : 'piezas'}
                  </span>
                  {(productSearch.trim() !== '' || productCatFilter !== 'Todas') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setProductCatFilter('Todas');
                      }}
                      className="font-medium text-[#8C6D2E] dark:text-[#DFC58B] hover:underline cursor-pointer"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                {filteredProducts.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      No se encontraron piezas que coincidan con tu búsqueda
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Intenta buscar con otro nombre, categoría o limpia los filtros activos.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearch('');
                        setProductCatFilter('Todas');
                      }}
                      className="mt-2 inline-flex items-center px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Mostrar todas las piezas
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50">
                        <th className="py-3 px-4">Pieza</th>
                        <th className="py-3 px-4">Categoría / Material</th>
                        <th className="py-3 px-4 text-right">Precio Lista</th>
                        <th className="py-3 px-4 text-right">Dto.</th>
                        <th className="py-3 px-4 text-right">Precio Final</th>
                        <th className="py-3 px-4 text-right">Consultas</th>
                        <th className="py-3 px-4">Disponibilidad</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {filteredProducts.map((p) => {
                        const finalPrice = getFinalPrice(p.price, p.discountPercent);
                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                                  <JewelryImage
                                    src={p.images[0]}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                                    {p.name}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                                    {p.sku} · {p.images.length} foto{p.images.length === 1 ? '' : 's'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                              {p.category} · {p.material} {p.karat}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 dark:text-slate-400">
                              {formatCurrencyMXN(p.price)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-[#8C6D2E] dark:text-[#DFC58B] font-medium">
                              {p.discountPercent > 0 ? `${p.discountPercent}%` : '—'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                              {formatCurrencyMXN(finalPrice)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 dark:text-slate-400">
                              {p.views}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => void handleToggleAvailability(p)}
                                className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                                  p.available
                                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/70'
                                    : 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/70'
                                }`}
                              >
                                {p.available ? 'Disponible' : 'Agotado'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(p);
                                    setProductModalOpen(true);
                                  }}
                                  aria-label={`Editar ${p.name}`}
                                  className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteProduct(p.id)}
                                  aria-label={`Eliminar ${p.name}`}
                                  className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 3. GENERADOR DE PUBLICIDAD */}
          {section === 'publicidad' && <AdminBannerStudio banners={banners} />}

          {/* 4. GESTIÓN DE PROMOCIONES */}
          {section === 'promociones' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Gestión de Promociones y Descuentos
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Aplica descuentos directos a una pieza individual o a toda una categoría del catálogo.
                </p>
              </div>

              <form
                onSubmit={handleApplyPromotion}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-3xl"
              >
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setPromoScope('category')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      promoScope === 'category'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Por categoría
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoScope('product')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      promoScope === 'product'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Por producto específico
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {promoScope === 'category' ? 'Categoría destino' : 'Pieza destino'}
                    </label>
                    {promoScope === 'category' ? (
                      <select
                        value={promoTargetCategory}
                        onChange={(e) =>
                          setPromoTargetCategory(e.target.value as ProductCategory)
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
                      >
                        {PRODUCT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c} ({products.filter((p) => p.category === c).length} piezas)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <select
                        value={promoTargetProductId}
                        onChange={(e) => setPromoTargetProductId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm cursor-pointer"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatCurrencyMXN(p.price)})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Descuento (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      required
                      value={promoPercent}
                      onChange={(e) => setPromoPercent(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                {promoNotice && (
                  <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {promoNotice}
                  </p>
                )}

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ingresa 0% para retirar el descuento vigente.
                  </p>
                  <button
                    type="submit"
                    disabled={promoBusy}
                    className="px-5 py-2.5 rounded-xl bg-[#18181B] dark:bg-[#DFC58B] text-white dark:text-[#18181B] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#C5A059] disabled:opacity-60 cursor-pointer"
                  >
                    {promoBusy ? 'Aplicando...' : 'Aplicar descuento'}
                  </button>
                </div>
              </form>

              {/* Active Discounted Products Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Piezas con descuento activo ({discountedProducts.length})
                  </h3>
                </div>
                {discountedProducts.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
                    No hay productos con descuento aplicado actualmente.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50">
                        <th className="py-3 px-4">Pieza</th>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4 text-right">Precio Lista</th>
                        <th className="py-3 px-4 text-right">Descuento</th>
                        <th className="py-3 px-4 text-right">Precio Final</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {discountedProducts.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {p.category}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-500 dark:text-slate-400">
                            {formatCurrencyMXN(p.price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#8C6D2E] dark:text-[#DFC58B]">
                            -{p.discountPercent}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrencyMXN(getFinalPrice(p.price, p.discountPercent))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleRemoveProductDiscount(p.id)}
                              className="text-xs font-medium text-red-700 dark:text-red-400 hover:underline cursor-pointer"
                            >
                              Quitar descuento
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 5. CLIENTES INTERESADOS */}
          {section === 'clientes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    Clientes Interesados
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Seguimiento de prospectos capturados desde fichas de producto y formulario de contacto.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportLeadsToExcel(filteredLeads)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLeadsToPDF(filteredLeads)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181B] dark:bg-[#DFC58B] text-white dark:text-[#18181B] text-xs font-medium hover:bg-[#2E2E33] dark:hover:bg-[#C5A059] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>

              {/* Automatic Email Notification Status */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#FAF9F7] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Notificaciones automáticas por correo
                        </h3>
                        {notifStatus && (
                          <span
                            className={`text-[11px] font-semibold ${
                              notifStatus.configured
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {notifStatus.configured
                              ? `Activas (${notifStatus.provider.toUpperCase()})`
                              : 'Pendiente de configurar'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {notifLoading && !notifStatus
                          ? 'Verificando configuración de envío...'
                          : notifStatus?.configured
                          ? `Cada nuevo cliente que consulte una pieza enviará un aviso automático a ${notifStatus.recipientEmail}.`
                          : `Configura RESEND_API_KEY o credenciales SMTP en los secretos del entorno para enviar avisos automáticos a ${
                              notifStatus?.recipientEmail || 'isaaciaica8@gmail.com'
                            }.`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTestNotification()}
                    disabled={notifTestBusy}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 text-[#8C6D2E] dark:text-[#DFC58B]" />
                    <span>{notifTestBusy ? 'Enviando...' : 'Enviar correo de prueba'}</span>
                  </button>
                </div>

                {notifFeedback && (
                  <p
                    className={`text-xs font-medium ${
                      notifFeedback.ok
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {notifFeedback.text}
                  </p>
                )}

                {notifStatus && notifStatus.recentLogs.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Últimos avisos procesados
                    </p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifStatus.recentLogs.slice(0, 3).map((entry) => (
                        <div
                          key={entry.id}
                          className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-slate-700 dark:text-slate-300 truncate">
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              {entry.clientName}
                            </span>{' '}
                            · {entry.productName}
                          </span>
                          <span className="inline-flex items-center gap-2 shrink-0">
                            <span className="font-mono-tabular text-[11px] text-slate-400 dark:text-slate-500">
                              {formatShortDate(entry.createdAt)}
                            </span>
                            <span
                              className={`font-medium ${
                                entry.status === 'enviado'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : entry.status === 'pendiente_configuracion'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-red-700 dark:text-red-400'
                              }`}
                            >
                              {entry.status === 'enviado'
                                ? 'Enviado'
                                : entry.status === 'pendiente_configuracion'
                                ? 'Sin configurar'
                                : 'Error'}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filters by date, product, and status */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Fecha desde
                  </label>
                  <input
                    type="date"
                    value={leadDateFrom}
                    onChange={(e) => setLeadDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono-tabular [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Fecha hasta
                  </label>
                  <input
                    type="date"
                    value={leadDateTo}
                    onChange={(e) => setLeadDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono-tabular [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Producto de interés
                  </label>
                  <select
                    value={leadProductFilter}
                    onChange={(e) => setLeadProductFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs cursor-pointer"
                  >
                    <option value="Todos">Todos los productos</option>
                    {uniqueLeadProducts.map((prod) => (
                      <option key={prod} value={prod}>
                        {prod}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Estado
                  </label>
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs cursor-pointer"
                  >
                    <option value="Todos">Todos</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="contactado">Contactado</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
              </div>

              {/* Leads Table */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                {filteredLeads.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No hay clientes interesados que coincidan con los filtros seleccionados.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Contacto</th>
                        <th className="py-3 px-4">Producto de interés</th>
                        <th className="py-3 px-4">Notas</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {filteredLeads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 text-xs font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatShortDate(lead.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                            {lead.name}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <p className="font-mono-tabular text-slate-800 dark:text-slate-200">
                              {lead.phone}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400">
                              {lead.email}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                            {lead.productName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-[240px]">
                            <p className="line-clamp-2">{lead.message || '—'}</p>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={lead.status}
                              onChange={(e) =>
                                void handleLeadStatusChange(
                                  lead.id,
                                  e.target.value as Lead['status']
                                )
                              }
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-medium cursor-pointer"
                            >
                              <option value="nuevo">Nuevo</option>
                              <option value="contactado">Contactado</option>
                              <option value="cerrado">Cerrado</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              <a
                                href={buildWhatsAppGeneralUrl(
                                  lead.phone || storeInfo.whatsappNumber,
                                  `Hola ${lead.name}, te contactamos de Joyería HI respecto a tu consulta sobre "${lead.productName}".`
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Responder por WhatsApp"
                                className="p-2 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => void handleDeleteLead(lead.id)}
                                aria-label="Eliminar registro"
                                className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Add/Edit Product Modal */}
      {productModalOpen && (
        <AdminProductModal
          initialProduct={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => {
            setProductModalOpen(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}
