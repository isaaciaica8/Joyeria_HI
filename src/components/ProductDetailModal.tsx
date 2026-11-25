import { useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Product, StoreInfo } from '../types';
import { createPublicLead } from '../services/firestoreStore';
import {
  INSTALLMENT_MONTHS,
  buildWhatsAppProductUrl,
  formatCurrencyMXN,
  getFinalPrice,
  getMonthlyPayment,
} from '../utils/formatters';
import { JewelryImage } from './JewelryImage';

interface ProductDetailModalProps {
  product: Product;
  storeInfo: StoreInfo;
  onClose: () => void;
}

export function ProductDetailModal({
  product,
  storeInfo,
  onClose,
}: ProductDetailModalProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [selectedMonths, setSelectedMonths] = useState<number>(12);
  const [showInterestForm, setShowInterestForm] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const photos = product.images.length > 0 ? product.images : [''];
  const finalPrice = getFinalPrice(product.price, product.discountPercent);
  const savings = product.price - finalPrice;
  const monthlyAmount = getMonthlyPayment(finalPrice, selectedMonths);
  const whatsappUrl = buildWhatsAppProductUrl(storeInfo.whatsappNumber, product);

  async function handleInterestSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await createPublicLead({
        name,
        phone,
        email,
        productId: product.id,
        productName: product.name,
        message: message || `Interés en ${product.name} (${selectedMonths} MSI)`,
        source: 'ficha',
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo enviar tu solicitud.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 dark:bg-black/75 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div className="relative w-full max-w-5xl bg-[#FAF9F7] dark:bg-[#141418] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-black/8 dark:border-white/10 bg-white dark:bg-[#18181D] shrink-0">
          <div className="flex items-center gap-2 text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
            <span>{product.category}</span>
            <span aria-hidden="true">·</span>
            <span>{product.material}</span>
            <span aria-hidden="true">·</span>
            <span>{product.karat}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">{product.sku}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ficha de producto"
            className="p-2 rounded-lg text-[#52525B] dark:text-[#A1A1AA] hover:text-[#18181B] dark:hover:text-[#F5F3EE] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Gallery Left */}
            <div className="lg:col-span-6 space-y-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F0ECE4] dark:bg-[#1F1F26] border border-black/8 dark:border-white/10">
                <JewelryImage
                  src={photos[activePhotoIndex]}
                  alt={`${product.name} - vista ${activePhotoIndex + 1}`}
                  fallbackLabel={product.name}
                  className="w-full h-full object-cover"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex((i) => (i - 1 + photos.length) % photos.length)
                      }
                      aria-label="Foto anterior"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 dark:bg-[#18181D]/90 text-[#18181B] dark:text-[#F5F3EE] flex items-center justify-center shadow hover:bg-white dark:hover:bg-[#23232A] transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePhotoIndex((i) => (i + 1) % photos.length)}
                      aria-label="Foto siguiente"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 dark:bg-[#18181D]/90 text-[#18181B] dark:text-[#F5F3EE] flex items-center justify-center shadow hover:bg-white dark:hover:bg-[#23232A] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-2.5">
                  {photos.map((photo, idx) => (
                    <button
                      key={`${photo}-${idx}`}
                      type="button"
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                        idx === activePhotoIndex
                          ? 'border-[#8C6D2E] dark:border-[#DFC58B] ring-2 ring-[#8C6D2E]/30'
                          : 'border-black/10 dark:border-white/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <JewelryImage
                        src={photo}
                        alt={`${product.name} miniatura ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase Module Right */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span
                    className={`text-xs font-medium ${
                      product.available
                        ? 'text-[#166534] dark:text-emerald-400'
                        : 'text-[#991B1B] dark:text-red-400'
                    }`}
                  >
                    {product.available ? 'Disponible en boutique' : 'Pieza agotada temporalmente'}
                  </span>
                  {product.discountPercent > 0 && (
                    <span className="text-xs font-semibold text-[#8C6D2E] dark:text-[#DFC58B]">
                      {product.discountPercent}% de descuento vigente
                    </span>
                  )}
                </div>

                <h2
                  id="product-modal-title"
                  className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#18181B] dark:text-[#F5F3EE] leading-tight [text-wrap:balance]"
                >
                  {product.name}
                </h2>

                <div className="mt-4 flex items-baseline gap-3">
                  <span className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                    {formatCurrencyMXN(finalPrice)} MXN
                  </span>
                  {product.discountPercent > 0 && (
                    <span className="font-mono-tabular text-base text-[#71717A] dark:text-[#71717A] line-through">
                      {formatCurrencyMXN(product.price)}
                    </span>
                  )}
                </div>
                {savings > 0 && (
                  <p className="mt-1 text-xs text-[#8C6D2E] dark:text-[#DFC58B] font-medium">
                    Ahorras {formatCurrencyMXN(savings)} MXN sobre precio de lista
                  </p>
                )}
              </div>

              <p className="text-sm sm:text-base text-[#3F3F46] dark:text-[#D4D4D8] leading-relaxed">
                {product.description}
              </p>

              {/* Specs row */}
              <div className="grid grid-cols-3 gap-4 py-4 border-y border-black/8 dark:border-white/10">
                <div>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">Material</p>
                  <p className="mt-0.5 text-sm font-medium text-[#18181B] dark:text-[#F5F3EE]">
                    {product.material}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">Quilataje / Ley</p>
                  <p className="mt-0.5 text-sm font-medium text-[#18181B] dark:text-[#F5F3EE]">
                    {product.karat}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">Categoría</p>
                  <p className="mt-0.5 text-sm font-medium text-[#18181B] dark:text-[#F5F3EE]">
                    {product.category}
                  </p>
                </div>
              </div>

              {/* Installments calculator */}
              <div className="bg-white dark:bg-[#18181D] rounded-xl border border-black/8 dark:border-white/10 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                    Calculadora de pagos a meses
                  </span>
                  <span className="text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                    Meses sin intereses
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {INSTALLMENT_MONTHS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMonths(m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedMonths === m
                          ? 'bg-[#18181B] dark:bg-[#C5A059] text-white dark:text-[#111113]'
                          : 'bg-[#F4F1EC] dark:bg-[#23232A] text-[#3F3F46] dark:text-[#D4D4D8] hover:bg-[#E7E2D8] dark:hover:bg-[#2D2D36]'
                      }`}
                    >
                      {m} meses
                    </button>
                  ))}
                </div>

                <div className="flex items-baseline justify-between pt-2 border-t border-black/6 dark:border-white/10">
                  <span className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Mensualidad estimada ({selectedMonths} pagos)
                  </span>
                  <span className="font-mono-tabular text-lg font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                    {formatCurrencyMXN(monthlyAmount)} MXN / mes
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setShowInterestForm((prev) => !prev)}
                  className="flex-1 px-5 py-3 rounded-xl bg-[#18181B] dark:bg-[#F5F3EE] text-[#FAF9F7] dark:text-[#18181B] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#E7E2D8] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {showInterestForm ? 'Ocultar formulario' : 'Me interesa'}
                </button>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#15803D] text-white text-sm font-medium hover:bg-[#166534] transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Comprar por WhatsApp</span>
                </a>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#6B6B73] dark:text-[#A1A1AA]">
                <ShieldCheck className="w-4 h-4 text-[#8C6D2E] dark:text-[#DFC58B] shrink-0" />
                <span>Certificado de autenticidad y ajuste sin costo incluido en tu compra.</span>
              </div>

              {/* Inline Interest Lead Form */}
              {showInterestForm && (
                <div className="bg-white dark:bg-[#18181D] rounded-xl border border-black/10 dark:border-white/10 p-5 space-y-4">
                  {submitted ? (
                    <div className="flex items-start gap-3 text-[#166534] dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold">Solicitud registrada correctamente</p>
                        <p className="text-xs text-[#3F3F46] dark:text-[#D4D4D8] mt-1">
                          Un asesor de Joyería HI se pondrá en contacto contigo a la brevedad respecto a{' '}
                          <span className="font-medium">{product.name}</span>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleInterestSubmit} className="space-y-3">
                      <h3 className="text-sm font-semibold text-[#18181B] dark:text-[#F5F3EE]">
                        Solicitar información de esta pieza
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                            Nombre completo *
                          </label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Tu nombre"
                            className="w-full px-3 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                            Teléfono / WhatsApp *
                          </label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+52 55 0000 0000"
                            className="w-full px-3 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Correo electrónico *
                        </label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full px-3 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#52525B] dark:text-[#A1A1AA] mb-1">
                          Notas o talla deseada (opcional)
                        </label>
                        <textarea
                          rows={2}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Ej. Talla 6, quisiera ver opciones a 12 meses..."
                          className="w-full px-3 py-2 rounded-lg border border-black/12 dark:border-white/15 bg-[#FAF9F7] dark:bg-[#0F0F12] text-sm text-[#18181B] dark:text-[#F5F3EE] placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                        />
                      </div>

                      {submitError && (
                        <p className="text-xs text-[#991B1B] dark:text-red-400" role="alert">
                          {submitError}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#8C6D2E] hover:bg-[#765B25] dark:bg-[#C5A059] dark:text-[#111113] dark:hover:bg-[#D4B372] text-white text-sm font-medium disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {submitting ? 'Enviando solicitud...' : 'Enviar interés a Joyería HI'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
