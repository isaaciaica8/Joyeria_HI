import type { AdBanner, Product } from '../types';

export const PRODUCT_CATEGORIES = [
  'Anillos',
  'Collares',
  'Aretes',
  'Pulseras',
  'Relojes',
] as const;

export const PRODUCT_MATERIALS = [
  'Oro Amarillo',
  'Oro Blanco',
  'Oro Rosa',
  'Plata',
  'Platino',
] as const;

export const INSTALLMENT_MONTHS = [3, 6, 9, 12, 18] as const;

export function formatCurrencyMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function getFinalPrice(price: number, discountPercent: number): number {
  const safeDiscount = Math.min(90, Math.max(0, Number(discountPercent) || 0));
  return Math.round(price * (1 - safeDiscount / 100));
}

export function getMonthlyPayment(finalPrice: number, months: number): number {
  if (!months || months <= 0) return finalPrice;
  return Math.round(finalPrice / months);
}

export function getTodayISODate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type BannerScheduleState = 'Vigente' | 'Programada' | 'Expirada' | 'Pausada';

export function getBannerScheduleState(
  banner: Pick<AdBanner, 'active' | 'startDate' | 'endDate'>,
  todayISO: string = getTodayISODate()
): BannerScheduleState {
  if (!banner.active) return 'Pausada';
  if (banner.startDate && todayISO < banner.startDate) return 'Programada';
  if (banner.endDate && todayISO > banner.endDate) return 'Expirada';
  return 'Vigente';
}

export function isBannerCurrentlyVisible(
  banner: Pick<AdBanner, 'active' | 'startDate' | 'endDate'>,
  todayISO: string = getTodayISODate()
): boolean {
  return getBannerScheduleState(banner, todayISO) === 'Vigente';
}

export function buildWhatsAppProductUrl(
  whatsappNumber: string,
  product: Product
): string {
  const cleanDigits = whatsappNumber.replace(/\D/g, '');
  const finalPrice = getFinalPrice(product.price, product.discountPercent);
  const promoText =
    product.discountPercent > 0
      ? ` (con ${product.discountPercent}% de descuento)`
      : '';
  const text = `Hola Joyería HI, me interesa adquirir la pieza "${product.name}" (${product.material} ${product.karat}, SKU ${product.sku}) con precio de ${formatCurrencyMXN(finalPrice)} MXN${promoText}. ¿Podrían brindarme atención?`;
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppGeneralUrl(
  whatsappNumber: string,
  customMessage?: string
): string {
  const cleanDigits = whatsappNumber.replace(/\D/g, '');
  const text =
    customMessage ||
    'Hola Joyería HI, me gustaría recibir asesoría personalizada sobre sus piezas y promociones vigentes.';
  return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(text)}`;
}

export function formatShortDate(isoString: string): string {
  if (!isoString) return '—';
  const date = new Date(isoString.length === 10 ? `${isoString}T12:00:00` : isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function sanitizeImageUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('/src/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return '';
}
