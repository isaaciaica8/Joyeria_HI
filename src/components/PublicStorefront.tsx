import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileSpreadsheet,
  Instagram,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Search,
  Share2,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import type { Product, ProductCategory, StorefrontResponse } from '../types';
import { createPublicLead, recordProductView } from '../services/firestoreStore';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_MATERIALS,
  buildWhatsAppGeneralUrl,
  formatCurrencyMXN,
  getFinalPrice,
  getMonthlyPayment,
} from '../utils/formatters';
import { exportCatalogToExcel, exportCatalogToPDF } from '../utils/exportUtils';
import { BannerPreview } from './BannerPreview';
import { JewelryImage } from './JewelryImage';
import { ProductDetailModal } from './ProductDetailModal';
import { ThemeToggle } from './ThemeToggle';

interface PublicStorefrontProps {
  data: StorefrontResponse;
  onOpenAdmin: () => void;
  onProductViewed: (productId: string, views: number) => void;
}

type PriceRangeKey = 'all' | 'under-25k' | '25k-50k' | 'over-50k';

export function PublicStorefront({
  data,
  onOpenAdmin,
  onProductViewed,
}: PublicStorefrontProps) {
  const { products, banners, storeInfo } = data;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stripDismissed, setStripDismissed] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Catalog filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Todos');
  const [priceRange, setPriceRange] = useState<PriceRangeKey>('all');
  const [onlyPromos, setOnlyPromos] = useState(false);

  // Product detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Contact form
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactProduct, setContactProduct] = useState('Asesoría general');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactSuccess, setContactSuccess] = useState(false);

  const heroBanners = useMemo(
    () => banners.filter((b) => b.placement === 'hero-carousel'),
    [banners]
  );
  const promoStripBanner = useMemo(
    () => banners.find((b) => b.placement === 'promo-strip'),
    [banners]
  );
  const catalogBanner = useMemo(
    () => banners.find((b) => b.placement === 'catalog-banner'),
    [banners]
  );

  useEffect(() => {
    if (heroBanners.length <= 1) return;
    const timer = window.setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % heroBanners.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [heroBanners.length]);

  const safeCarouselIndex =
    heroBanners.length > 0 ? carouselIndex % heroBanners.length : 0;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'Todas' && p.category !== selectedCategory) return false;
      if (selectedMaterial !== 'Todos' && p.material !== selectedMaterial) return false;
      if (onlyPromos && p.discountPercent <= 0) return false;

      const finalPrice = getFinalPrice(p.price, p.discountPercent);
      if (priceRange === 'under-25k' && finalPrice > 25000) return false;
      if (priceRange === '25k-50k' && (finalPrice < 25000 || finalPrice > 50000)) return false;
      if (priceRange === 'over-50k' && finalPrice <= 50000) return false;

      if (q) {
        const haystack = `${p.name} ${p.category} ${p.material} ${p.karat} ${p.description} ${p.sku}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [products, searchQuery, selectedCategory, selectedMaterial, priceRange, onlyPromos]);

  const promoProducts = useMemo(
    () => products.filter((p) => p.discountPercent > 0),
    [products]
  );

  function scrollToSection(id: string) {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleBannerAction(category?: ProductCategory | '') {
    if (category) {
      setSelectedCategory(category);
    }
    scrollToSection('catalogo');
  }

  async function handleOpenProduct(product: Product) {
    setSelectedProduct(product);
    try {
      await recordProductView(product.id);
      onProductViewed(product.id, product.views + 1);
    } catch {
      // View tracking is non-blocking
    }
  }

  function resetFilters() {
    setSearchQuery('');
    setSelectedCategory('Todas');
    setSelectedMaterial('Todos');
    setPriceRange('all');
    setOnlyPromos(false);
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactError('');
    setContactLoading(true);
    try {
      await createPublicLead({
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
        productName: contactProduct,
        message: contactMessage,
        source: 'contacto',
      });
      setContactSuccess(true);
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactMessage('');
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : 'No se pudo enviar tu mensaje.'
      );
    } finally {
      setContactLoading(false);
    }
  }

  const activeFiltersCount =
    (selectedCategory !== 'Todas' ? 1 : 0) +
    (selectedMaterial !== 'Todos' ? 1 : 0) +
    (priceRange !== 'all' ? 1 : 0) +
    (onlyPromos ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F7] dark:bg-[#0F0F12] text-[#18181B] dark:text-[#F5F3EE] transition-colors duration-200">
      {/* Slim Promo Strip (<= 40px) */}
      {promoStripBanner && !stripDismissed && (
        <div className="bg-[#18181B] dark:bg-[#1C1915] text-[#FAF9F7] h-9 px-4 flex items-center justify-between text-xs border-b border-transparent dark:border-white/10">
          <div className="w-6 shrink-0" />
          <button
            type="button"
            onClick={() => scrollToSection('promociones')}
            className="truncate font-medium tracking-wide hover:text-[#DFC58B] transition-colors cursor-pointer"
          >
            {promoStripBanner.title}
          </button>
          <button
            type="button"
            onClick={() => setStripDismissed(true)}
            aria-label="Cerrar aviso promocional"
            className="p-1 text-[#A1A1AA] hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-[#FAF9F7]/95 dark:bg-[#0F0F12]/95 backdrop-blur-md border-b border-black/8 dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('inicio');
            }}
            className="font-display text-2xl font-semibold tracking-tight text-[#18181B] dark:text-[#F5F3EE] whitespace-nowrap shrink-0"
          >
            Joyería HI
          </a>

          {/* Zone 2: 4 Clean Text Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#52525B] dark:text-[#A1A1AA]">
            <a
              href="#inicio"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('inicio');
              }}
              className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
            >
              Inicio
            </a>
            <a
              href="#catalogo"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('catalogo');
              }}
              className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
            >
              Catálogo
            </a>
            <a
              href="#promociones"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('promociones');
              }}
              className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
            >
              Promociones
            </a>
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contacto');
              }}
              className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors whitespace-nowrap shrink-0"
            >
              Contacto
            </a>
          </nav>

          {/* Zone 3: Theme Toggle + Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle variant="store" />
            <button
              type="button"
              onClick={onOpenAdmin}
              className="px-4 py-2 rounded-lg border border-black/15 dark:border-white/15 bg-white dark:bg-[#18181D] text-xs sm:text-sm font-medium text-[#18181B] dark:text-[#F5F3EE] hover:bg-[#18181B] hover:text-white dark:hover:bg-[#F5F3EE] dark:hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Administrador
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menú de navegación"
              className="md:hidden p-2 rounded-lg text-[#18181B] dark:text-[#F5F3EE] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/8 dark:border-white/10 bg-white dark:bg-[#18181D] px-4 py-3 space-y-1">
            {[
              { id: 'inicio', label: 'Inicio' },
              { id: 'catalogo', label: 'Catálogo' },
              { id: 'promociones', label: 'Promociones y novedades' },
              { id: 'contacto', label: 'Contacto' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#18181B] dark:text-[#F5F3EE] hover:bg-[#FAF9F7] dark:hover:bg-[#23232A] cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 1. INICIO — Hero Carousel */}
        <section id="inicio" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12">
          {heroBanners.length > 0 ? (
            <div className="relative">
              <BannerPreview
                banner={heroBanners[safeCarouselIndex]}
                onAction={handleBannerAction}
              />

              {heroBanners.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setCarouselIndex(
                        (prev) => (prev - 1 + heroBanners.length) % heroBanners.length
                      )
                    }
                    aria-label="Banner anterior"
                    className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 text-[#18181B] items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCarouselIndex((prev) => (prev + 1) % heroBanners.length)
                    }
                    aria-label="Siguiente banner"
                    className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 text-[#18181B] items-center justify-center shadow-md hover:bg-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="flex items-center justify-center gap-2 mt-4">
                    {heroBanners.map((b, idx) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setCarouselIndex(idx)}
                        aria-label={`Ir a campaña ${idx + 1}: ${b.title}`}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          idx === safeCarouselIndex
                            ? 'w-7 bg-[#18181B] dark:bg-[#DFC58B]'
                            : 'w-2 bg-black/20 dark:bg-white/25 hover:bg-black/40 dark:hover:bg-white/45'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <BannerPreview
              banner={{
                title: 'Alta Joyería en Oro y Diamantes',
                subtitle:
                  'Piezas atemporales certificadas con facilidades de pago a meses sin intereses.',
                ctaText: 'Explorar catálogo',
                imageUrl: '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
                template: 'editorial-gold',
                linkedCategory: '',
              }}
              onAction={handleBannerAction}
            />
          )}

          {/* Boutique Value Strip */}
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-black/8 dark:border-white/10 py-5">
            <div>
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                Metales Certificados
              </p>
              <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA] mt-0.5">
                Oro 14k, 18k, Platino 950 y Plata .925
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                Meses Sin Intereses
              </p>
              <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA] mt-0.5">
                Planes de 3, 6, 9, 12 y 18 mensualidades
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                Asesoría Directa
              </p>
              <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA] mt-0.5">
                Atención inmediata por WhatsApp o en tienda
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                Garantía de Taller
              </p>
              <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA] mt-0.5">
                Limpieza y ajuste sin costo en tu pieza
              </p>
            </div>
          </div>
        </section>

        {/* 2. CATÁLOGO */}
        <section id="catalogo" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-black/8 dark:border-white/10">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[#8C6D2E] dark:text-[#DFC58B]">
                Colección Permanente
              </p>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                Catálogo Joyería HI
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportCatalogToExcel(filteredProducts)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-white dark:bg-[#18181D] text-xs font-medium text-[#18181B] dark:text-[#F5F3EE] hover:bg-[#F4F1EC] dark:hover:bg-[#23232A] transition-colors whitespace-nowrap cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D] dark:text-emerald-400" />
                <span>Catálogo Excel</span>
              </button>
              <button
                type="button"
                onClick={() => exportCatalogToPDF(filteredProducts)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-white dark:bg-[#18181D] text-xs font-medium text-[#18181B] dark:text-[#F5F3EE] hover:bg-[#F4F1EC] dark:hover:bg-[#23232A] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#8C6D2E] dark:text-[#DFC58B]" />
                <span>Catálogo PDF</span>
              </button>
            </div>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="mt-6 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#71717A] dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, material, piedra o palabra clave..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-white dark:bg-[#18181D] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                />
              </div>

              {/* Material, Price, Promo Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs text-[#52525B] dark:text-[#A1A1AA] mr-1">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filtros:</span>
                </div>

                <select
                  aria-label="Filtrar por material"
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-white dark:bg-[#18181D] text-xs sm:text-sm text-[#18181B] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 cursor-pointer"
                >
                  <option value="Todos">Todos los materiales</option>
                  {PRODUCT_MATERIALS.map((mat) => (
                    <option key={mat} value={mat}>
                      {mat}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por rango de precio"
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value as PriceRangeKey)}
                  className="px-3 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-white dark:bg-[#18181D] text-xs sm:text-sm text-[#18181B] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 cursor-pointer"
                >
                  <option value="all">Cualquier precio</option>
                  <option value="under-25k">Hasta $25,000</option>
                  <option value="25k-50k">$25,000 – $50,000</option>
                  <option value="over-50k">Más de $50,000</option>
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyPromos((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    onlyPromos
                      ? 'bg-[#8C6D2E] border-[#8C6D2E] text-white dark:bg-[#C5A059] dark:border-[#C5A059] dark:text-[#111113]'
                      : 'bg-white dark:bg-[#18181D] border-black/12 dark:border-white/15 text-[#3F3F46] dark:text-[#D4D4D8] hover:bg-[#F4F1EC] dark:hover:bg-[#23232A]'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Promociones</span>
                </button>
              </div>
            </div>

            {/* Category Segmented Controls */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-1 p-1 bg-[#EFECE5] dark:bg-[#18181D] rounded-xl overflow-x-auto max-w-full border border-transparent dark:border-white/10">
                {['Todas', ...PRODUCT_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-white dark:bg-[#27272F] text-[#18181B] dark:text-[#F5F3EE] shadow-sm'
                        : 'text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F5F3EE]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                <span className="tabular-nums">
                  {filteredProducts.length}{' '}
                  {filteredProducts.length === 1 ? 'pieza encontrada' : 'piezas encontradas'}
                </span>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[#8C6D2E] dark:text-[#DFC58B] font-medium hover:underline cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {filteredProducts.length === 0 ? (
            <div className="mt-10 bg-white dark:bg-[#18181D] rounded-2xl border border-black/8 dark:border-white/10 p-12 text-center">
              <p className="font-display text-2xl text-[#18181B] dark:text-[#F5F3EE]">
                No encontramos piezas con estos filtros
              </p>
              <p className="text-sm text-[#6B6B73] dark:text-[#A1A1AA] mt-2">
                Ajusta el rango de precio, material o palabra clave para ver más joyas disponibles.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 px-5 py-2.5 rounded-lg bg-[#18181B] dark:bg-[#C5A059] text-white dark:text-[#111113] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#D4B372] transition-colors cursor-pointer"
              >
                Mostrar todo el catálogo
              </button>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredProducts.map((product) => {
                const finalPrice = getFinalPrice(product.price, product.discountPercent);
                const monthly12 = getMonthlyPayment(finalPrice, 12);

                return (
                  <article
                    key={product.id}
                    onClick={() => handleOpenProduct(product)}
                    className="group bg-white dark:bg-[#18181D] rounded-2xl border border-black/8 dark:border-white/10 overflow-hidden flex flex-col cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:hover:border-white/20"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F4F1EC] dark:bg-[#23232A]">
                      <JewelryImage
                        src={product.images[0]}
                        alt={product.name}
                        fallbackLabel={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                          <span className="truncate">
                            {product.category} · {product.material} {product.karat}
                          </span>
                          {!product.available ? (
                            <span className="text-[#991B1B] dark:text-red-400 font-medium shrink-0">
                              Agotado
                            </span>
                          ) : product.discountPercent > 0 ? (
                            <span className="text-[#8C6D2E] dark:text-[#DFC58B] font-semibold shrink-0">
                              -{product.discountPercent}%
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-1.5 font-display text-xl font-semibold text-[#18181B] dark:text-[#F5F3EE] leading-snug group-hover:text-[#8C6D2E] dark:group-hover:text-[#DFC58B] transition-colors">
                          {product.name}
                        </h3>
                      </div>

                      <div className="pt-3 border-t border-black/6 dark:border-white/10 flex items-end justify-between gap-3">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono-tabular text-lg font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                              {formatCurrencyMXN(finalPrice)}
                            </span>
                            {product.discountPercent > 0 && (
                              <span className="font-mono-tabular text-xs text-[#71717A] line-through">
                                {formatCurrencyMXN(product.price)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA] mt-0.5 tabular-nums">
                            Desde {formatCurrencyMXN(monthly12)}/mes (12 MSI)
                          </p>
                        </div>

                        <span className="text-xs font-medium text-[#18181B] dark:text-[#DFC58B] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                          Ver ficha →
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. PROMOCIONES Y NOVEDADES */}
        <section
          id="promociones"
          className="bg-[#F3EFE8] dark:bg-[#15151A] border-y border-black/8 dark:border-white/10 py-14 sm:py-16 transition-colors"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#8C6D2E] dark:text-[#DFC58B]">
                  Beneficios Vigentes
                </p>
                <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                  Promociones y novedades
                </h2>
              </div>
              <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] max-w-md">
                Aprovecha precios preferenciales de temporada y financiamiento directo sin intereses en piezas seleccionadas.
              </p>
            </div>

            {catalogBanner && (
              <BannerPreview
                banner={catalogBanner}
                onAction={handleBannerAction}
                compact
              />
            )}

            {promoProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {promoProducts.slice(0, 3).map((product) => {
                  const finalPrice = getFinalPrice(product.price, product.discountPercent);
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleOpenProduct(product)}
                      className="bg-white dark:bg-[#18181D] rounded-2xl border border-black/8 dark:border-white/10 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md dark:hover:border-white/20 transition-all"
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-[#F4F1EC] dark:bg-[#23232A] shrink-0">
                        <JewelryImage
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#8C6D2E] dark:text-[#DFC58B]">
                          {product.discountPercent}% de descuento
                        </p>
                        <h3 className="font-display text-lg font-semibold text-[#18181B] dark:text-[#F5F3EE] truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                          {product.material} {product.karat}
                        </p>
                        <div className="mt-1.5 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                            {formatCurrencyMXN(finalPrice)}
                          </span>
                          <span className="font-mono-tabular text-xs text-[#71717A] line-through">
                            {formatCurrencyMXN(product.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-[#18181D] rounded-xl border border-black/8 dark:border-white/10 p-6 text-sm text-[#52525B] dark:text-[#A1A1AA]">
                Próximamente publicaremos nuevas promociones de temporada. Contáctanos para precios especiales en pedidos personalizados.
              </div>
            )}
          </div>
        </section>

        {/* 4. CONTACTO Y UBICACIÓN */}
        <section id="contacto" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Form Left */}
            <div className="lg:col-span-6 bg-white dark:bg-[#18181D] rounded-2xl border border-black/8 dark:border-white/10 p-6 sm:p-8 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#8C6D2E] dark:text-[#DFC58B]">
                  Atención Personalizada
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                  Agenda una cita o consulta
                </h2>
                <p className="mt-2 text-sm text-[#52525B] dark:text-[#A1A1AA]">
                  Déjanos tus datos y un especialista de Joyería HI te atenderá personalmente.
                </p>

                {contactSuccess ? (
                  <div className="mt-6 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#BBF7D0] dark:border-emerald-800/60 p-5 flex items-start gap-3 text-[#166534] dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold">¡Mensaje enviado con éxito!</p>
                      <p className="text-xs mt-1 text-[#15803D] dark:text-emerald-400">
                        Nuestro equipo recibió tu solicitud y se comunicará contigo pronto.
                      </p>
                      <button
                        type="button"
                        onClick={() => setContactSuccess(false)}
                        className="mt-3 text-xs font-semibold underline cursor-pointer"
                      >
                        Enviar otra consulta
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Nombre completo *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Tu nombre"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Teléfono / WhatsApp *
                        </label>
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+52 55 0000 0000"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Correo electrónico *
                        </label>
                        <input
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Pieza o servicio de interés
                        </label>
                        <select
                          value={contactProduct}
                          onChange={(e) => setContactProduct(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 cursor-pointer"
                        >
                          <option value="Asesoría general">Asesoría general</option>
                          <option value="Diseño a medida / Anillo de compromiso">
                            Diseño a medida / Compromiso
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                        Mensaje
                      </label>
                      <textarea
                        rows={3}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        placeholder="Cuéntanos qué pieza buscas o el horario ideal para visitarnos..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                      />
                    </div>

                    {contactError && (
                      <p className="text-xs text-[#991B1B] dark:text-red-400" role="alert">
                        {contactError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={contactLoading}
                      className="w-full py-3 px-5 rounded-xl bg-[#18181B] dark:bg-[#C5A059] text-[#FAF9F7] dark:text-[#111113] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#D4B372] disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {contactLoading ? 'Enviando...' : 'Enviar solicitud de contacto'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Store Info & Map Right */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="bg-white dark:bg-[#18181D] rounded-2xl border border-black/8 dark:border-white/10 p-6 sm:p-8 space-y-5">
                <h3 className="font-display text-2xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                  Boutique Joyería HI
                </h3>

                <div className="space-y-4 text-sm text-[#3F3F46] dark:text-[#D4D4D8]">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B] shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-[#18181B] dark:text-[#F5F3EE]">
                        {storeInfo.address}
                      </p>
                      <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                        {storeInfo.city}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B] shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-[#18181B] dark:text-[#F5F3EE]">
                        Horarios de atención
                      </p>
                      <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                        {storeInfo.hours}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B] shrink-0" />
                    <a
                      href={`tel:${storeInfo.phoneDisplay.replace(/\D/g, '')}`}
                      className="font-mono-tabular hover:text-[#8C6D2E] dark:hover:text-[#DFC58B] transition-colors"
                    >
                      {storeInfo.phoneDisplay}
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B] shrink-0" />
                    <a
                      href={`mailto:${storeInfo.email}`}
                      className="hover:text-[#8C6D2E] dark:hover:text-[#DFC58B] transition-colors"
                    >
                      {storeInfo.email}
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-black/8 dark:border-white/10 flex flex-wrap items-center gap-4 text-xs font-medium text-[#18181B] dark:text-[#F5F3EE]">
                  <a
                    href={buildWhatsAppGeneralUrl(storeInfo.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-[#15803D] dark:hover:text-emerald-400 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-[#15803D] dark:text-emerald-400" />
                    <span>WhatsApp Directo</span>
                  </a>
                  <span aria-hidden="true" className="text-black/20 dark:text-white/20">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#52525B] dark:text-[#A1A1AA]">
                    <Instagram className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B]" />
                    <span>{storeInfo.instagramHandle}</span>
                  </span>
                  <span aria-hidden="true" className="text-black/20 dark:text-white/20">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#52525B] dark:text-[#A1A1AA]">
                    <Share2 className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B]" />
                    <span>{storeInfo.facebookHandle}</span>
                  </span>
                </div>
              </div>

              {/* Architectural Boutique Location Map Card */}
              <div className="flex-1 min-h-[220px] relative rounded-2xl border border-black/8 dark:border-white/10 overflow-hidden bg-[#ECE7DD] dark:bg-[#1C1C22] p-6 flex flex-col justify-between">
                {/* Clean SVG Street Grid Illustration */}
                <svg
                  viewBox="0 0 600 260"
                  className="absolute inset-0 w-full h-full object-cover opacity-55 dark:opacity-30 pointer-events-none"
                  aria-hidden="true"
                >
                  <rect width="600" height="260" fill="#ECE7DD" className="dark:fill-[#1C1C22]" />
                  <path
                    d="M0 70 H600 M0 130 H600 M0 195 H600 M110 0 V260 M240 0 V260 M390 0 V260 M510 0 V260"
                    stroke="#D6CFC2"
                    className="dark:stroke-[#2E2E38]"
                    strokeWidth="2"
                  />
                  <path d="M0 130 H600" stroke="#FAF9F7" className="dark:stroke-[#3A3A46]" strokeWidth="10" />
                  <path d="M300 0 V260" stroke="#FAF9F7" className="dark:stroke-[#3A3A46]" strokeWidth="8" />
                  <circle cx="300" cy="130" r="22" fill="#8C6D2E" fillOpacity="0.25" />
                  <circle cx="300" cy="130" r="7" fill="#18181B" className="dark:fill-[#DFC58B]" />
                </svg>

                <div className="relative z-10 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#18181B] dark:text-[#F5F3EE] bg-white/90 dark:bg-[#18181D]/90 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/15">
                    Polanco · Ciudad de México
                  </span>
                  <span className="font-mono-tabular text-xs text-[#52525B] dark:text-[#A1A1AA] bg-white/90 dark:bg-[#18181D]/90 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/15">
                    19.4319° N, 99.1965° W
                  </span>
                </div>

                <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 bg-white/95 dark:bg-[#18181D]/95 backdrop-blur-sm rounded-xl p-4 border border-black/10 dark:border-white/15">
                  <div>
                    <p className="text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                      Ubicación de tienda física
                    </p>
                    <p className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                      {storeInfo.address}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${storeInfo.address}, ${storeInfo.city}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-[#18181B] dark:bg-[#C5A059] text-white dark:text-[#111113] text-xs font-medium hover:bg-[#2E2E33] dark:hover:bg-[#D4B372] transition-colors whitespace-nowrap"
                  >
                    Abrir en Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/8 dark:border-white/10 bg-white dark:bg-[#141418] py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-semibold text-[#18181B] dark:text-[#F5F3EE]">
              Joyería HI
            </span>
            <span aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()} Todos los derechos reservados.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#catalogo" className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors">
              Catálogo
            </a>
            <a href="#promociones" className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors">
              Promociones
            </a>
            <a href="#contacto" className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors">
              Contacto
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="hover:text-[#18181B] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer"
            >
              Portal Administrativo
            </button>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button (compact, visible across all public sections) */}
      <a
        href={buildWhatsAppGeneralUrl(storeInfo.whatsappNumber)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatear por WhatsApp con Joyería HI"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#15803D] text-white text-sm font-medium shadow-lg hover:bg-[#166534] transition-transform duration-150 hover:scale-[1.03]"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline whitespace-nowrap">WhatsApp</span>
      </a>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          storeInfo={storeInfo}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
