import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Edit3,
  FileSpreadsheet,
  Gem,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Percent,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  AdminOverviewResponse,
  Lead,
  Product,
  ProductCategory,
} from '../../types';
import {
  applyPromotionInFirestore,
  deleteLeadInFirestore,
  deleteProductInFirestore,
  saveProductInFirestore,
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
import { AdminBannerStudio } from './AdminBannerStudio';
import { AdminProductModal } from './AdminProductModal';

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
  const { products, banners, leads, storeInfo, stats } = overview;

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

  const topConsultedProducts = useMemo(
    () => [...products].sort((a, b) => b.views - a.views).slice(0, 5),
    [products]
  );

  const maxViews = topConsultedProducts[0]?.views || 1;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (productCatFilter !== 'Todas' && p.category !== productCatFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.material} ${p.category}`.toLowerCase();
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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar (260px) */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
            <span className="font-display text-2xl font-semibold text-[#18181B]">
              Joyería HI
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
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
                      ? 'bg-[#18181B] text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono-tabular text-xs ${
                        active ? 'text-[#DFC58B]' : 'text-slate-400'
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

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="px-2 py-1">
            <p className="text-xs text-slate-500">Sesión activa</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{username}</p>
          </div>
          <button
            type="button"
            onClick={onBackToStore}
            className="w-full inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver tienda pública</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir navegación"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">Administración</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {SECTION_LABELS[section]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportCatalogToExcel(products)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => exportCatalogToPDF(products)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181B] text-white text-xs font-medium hover:bg-[#2E2E33] cursor-pointer whitespace-nowrap"
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
                <h1 className="text-2xl font-semibold text-slate-900">
                  Resumen General de Joyería HI
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Indicadores actualizados de catálogo, campañas publicitarias y clientes interesados.
                </p>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">Total de productos</p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900">
                    {stats.totalProducts}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {stats.availableProducts} disponibles ·{' '}
                    {stats.totalProducts - stats.availableProducts} agotados
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">Promociones activas</p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900">
                    {stats.activePromotions}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {stats.activeBanners} banners vigentes hoy
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">
                    Clientes interesados nuevos
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-[#8C6D2E]">
                    {stats.newLeadsCount}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 tabular-nums">
                    {stats.totalLeadsCount} registros acumulados
                  </p>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <p className="text-xs font-medium text-slate-500">
                    Consultas de productos
                  </p>
                  <p className="mt-2 font-mono-tabular text-3xl font-semibold text-slate-900">
                    {stats.totalViews}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Aperturas de fichas en catálogo
                  </p>
                </div>
              </div>

              {/* Most Consulted + Recent Leads */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">
                      Productos más consultados
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('productos')}
                      className="text-xs font-medium text-[#8C6D2E] hover:underline cursor-pointer"
                    >
                      Ver catálogo
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {topConsultedProducts.map((p, idx) => {
                      const pct = Math.round((p.views / maxViews) * 100);
                      return (
                        <div key={p.id} className="p-4 sm:px-5 flex items-center gap-4">
                          <span className="font-mono-tabular text-xs font-semibold text-slate-400 w-5">
                            0{idx + 1}
                          </span>
                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <JewelryImage
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {p.name}
                              </p>
                              <span className="font-mono-tabular text-xs font-semibold text-slate-900 shrink-0">
                                {p.views} consultas
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#8C6D2E]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">
                      Clientes recientes
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSection('clientes')}
                      className="text-xs font-medium text-[#8C6D2E] hover:underline cursor-pointer"
                    >
                      Gestionar todos
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {leads.slice(0, 5).map((lead) => (
                      <div key={lead.id} className="p-4 sm:px-5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {lead.name}
                          </p>
                          <span
                            className={`text-xs font-medium ${
                              lead.status === 'nuevo'
                                ? 'text-[#8C6D2E]'
                                : lead.status === 'contactado'
                                ? 'text-blue-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {lead.status === 'nuevo'
                              ? 'Nuevo'
                              : lead.status === 'contactado'
                              ? 'Contactado'
                              : 'Cerrado'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          Interés: {lead.productName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono-tabular">
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
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Gestión de Productos
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Agrega piezas, sube múltiples fotos por arrastre, marca agotados y exporta tu catálogo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportCatalogToExcel(products)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCatalogToPDF(products)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#8C6D2E]" />
                    <span>PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#2E2E33] cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar producto</span>
                  </button>
                </div>
              </div>

              {/* Filter row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nombre, SKU o material..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                  />
                </div>
                <select
                  value={productCatFilter}
                  onChange={(e) => setProductCatFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm cursor-pointer"
                >
                  <option value="Todas">Todas las categorías</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
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
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredProducts.map((p) => {
                      const finalPrice = getFinalPrice(p.price, p.discountPercent);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                                <JewelryImage
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate max-w-[200px]">
                                  {p.name}
                                </p>
                                <p className="text-xs text-slate-500 font-mono-tabular">
                                  {p.sku} · {p.images.length} foto{p.images.length === 1 ? '' : 's'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {p.category} · {p.material} {p.karat}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-600">
                            {formatCurrencyMXN(p.price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-[#8C6D2E] font-medium">
                            {p.discountPercent > 0 ? `${p.discountPercent}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                            {formatCurrencyMXN(finalPrice)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-600">
                            {p.views}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => void handleToggleAvailability(p)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer transition-colors ${
                                p.available
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
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
                                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteProduct(p.id)}
                                aria-label={`Eliminar ${p.name}`}
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
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
              </div>
            </div>
          )}

          {/* 3. GENERADOR DE PUBLICIDAD */}
          {section === 'publicidad' && <AdminBannerStudio banners={banners} />}

          {/* 4. GESTIÓN DE PROMOCIONES */}
          {section === 'promociones' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  Gestión de Promociones y Descuentos
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Aplica descuentos directos a una pieza individual o a toda una categoría del catálogo.
                </p>
              </div>

              <form
                onSubmit={handleApplyPromotion}
                className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 max-w-3xl"
              >
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setPromoScope('category')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      promoScope === 'category'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Por categoría
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoScope('product')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      promoScope === 'product'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600'
                    }`}
                  >
                    Por producto específico
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {promoScope === 'category' ? 'Categoría destino' : 'Pieza destino'}
                    </label>
                    {promoScope === 'category' ? (
                      <select
                        value={promoTargetCategory}
                        onChange={(e) =>
                          setPromoTargetCategory(e.target.value as ProductCategory)
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#FAF9F7] text-sm cursor-pointer"
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
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#FAF9F7] text-sm cursor-pointer"
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
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Descuento (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      required
                      value={promoPercent}
                      onChange={(e) => setPromoPercent(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#FAF9F7] text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                {promoNotice && (
                  <p className="text-xs font-medium text-emerald-700">{promoNotice}</p>
                )}

                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-slate-500">
                    Ingresa 0% para retirar el descuento vigente.
                  </p>
                  <button
                    type="submit"
                    disabled={promoBusy}
                    className="px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#2E2E33] disabled:opacity-60 cursor-pointer"
                  >
                    {promoBusy ? 'Aplicando...' : 'Aplicar descuento'}
                  </button>
                </div>
              </form>

              {/* Active Discounted Products Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">
                    Piezas con descuento activo ({discountedProducts.length})
                  </h3>
                </div>
                {discountedProducts.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">
                    No hay productos con descuento aplicado actualmente.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                        <th className="py-3 px-4">Pieza</th>
                        <th className="py-3 px-4">Categoría</th>
                        <th className="py-3 px-4 text-right">Precio Lista</th>
                        <th className="py-3 px-4 text-right">Descuento</th>
                        <th className="py-3 px-4 text-right">Precio Final</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {discountedProducts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-medium text-slate-900">{p.name}</td>
                          <td className="py-3 px-4 text-xs text-slate-600">{p.category}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-500">
                            {formatCurrencyMXN(p.price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#8C6D2E]">
                            -{p.discountPercent}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900">
                            {formatCurrencyMXN(getFinalPrice(p.price, p.discountPercent))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleRemoveProductDiscount(p.id)}
                              className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
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
                  <h2 className="text-2xl font-semibold text-slate-900">
                    Clientes Interesados
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Seguimiento de prospectos capturados desde fichas de producto y formulario de contacto.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportLeadsToExcel(filteredLeads)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Exportar Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportLeadsToPDF(filteredLeads)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18181B] text-white text-xs font-medium hover:bg-[#2E2E33] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exportar PDF</span>
                  </button>
                </div>
              </div>

              {/* Filters by date, product, and status */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Fecha desde
                  </label>
                  <input
                    type="date"
                    value={leadDateFrom}
                    onChange={(e) => setLeadDateFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Fecha hasta
                  </label>
                  <input
                    type="date"
                    value={leadDateTo}
                    onChange={(e) => setLeadDateTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Producto de interés
                  </label>
                  <select
                    value={leadProductFilter}
                    onChange={(e) => setLeadProductFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs cursor-pointer"
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
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Estado
                  </label>
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs cursor-pointer"
                  >
                    <option value="Todos">Todos</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="contactado">Contactado</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>
              </div>

              {/* Leads Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                {filteredLeads.length === 0 ? (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No hay clientes interesados que coincidan con los filtros seleccionados.
                  </p>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[820px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50/70">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Contacto</th>
                        <th className="py-3 px-4">Producto de interés</th>
                        <th className="py-3 px-4">Notas</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 text-xs font-mono-tabular text-slate-500 whitespace-nowrap">
                            {formatShortDate(lead.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900">
                            {lead.name}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <p className="font-mono-tabular text-slate-800">{lead.phone}</p>
                            <p className="text-slate-500">{lead.email}</p>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-slate-800">
                            {lead.productName}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 max-w-[240px]">
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
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium cursor-pointer"
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
                                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => void handleDeleteLead(lead.id)}
                                aria-label="Eliminar registro"
                                className="p-2 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
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
