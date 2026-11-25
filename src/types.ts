export type ProductCategory =
  | 'Anillos'
  | 'Collares'
  | 'Aretes'
  | 'Pulseras'
  | 'Relojes';

export type ProductMaterial =
  | 'Oro Amarillo'
  | 'Oro Blanco'
  | 'Oro Rosa'
  | 'Plata'
  | 'Platino';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  material: ProductMaterial;
  karat: string;
  price: number;
  discountPercent: number;
  images: string[];
  description: string;
  available: boolean;
  featured: boolean;
  views: number;
  createdAt: string;
}

export type BannerTemplate =
  | 'editorial-gold'
  | 'obsidian-noir'
  | 'alabaster-minimal';

export type BannerPlacement =
  | 'hero-carousel'
  | 'promo-strip'
  | 'catalog-banner';

export interface AdBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  imageUrl: string;
  template: BannerTemplate;
  placement: BannerPlacement;
  startDate: string;
  endDate: string;
  active: boolean;
  linkedCategory?: ProductCategory | '';
  createdAt: string;
}

export type LeadStatus = 'nuevo' | 'contactado' | 'cerrado';
export type LeadSource = 'ficha' | 'contacto';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  productId?: string;
  productName: string;
  message?: string;
  source: LeadSource;
  status: LeadStatus;
  createdAt: string;
}

export interface StoreInfo {
  name: string;
  whatsappNumber: string;
  phoneDisplay: string;
  email: string;
  address: string;
  city: string;
  hours: string;
  instagramHandle: string;
  facebookHandle: string;
}

export interface StorefrontResponse {
  products: Product[];
  banners: AdBanner[];
  storeInfo: StoreInfo;
}

export interface AdminOverviewResponse {
  products: Product[];
  banners: AdBanner[];
  leads: Lead[];
  storeInfo: StoreInfo;
  stats: {
    totalProducts: number;
    availableProducts: number;
    activePromotions: number;
    activeBanners: number;
    newLeadsCount: number;
    totalLeadsCount: number;
    totalViews: number;
  };
}

export interface AuthStatusResponse {
  initialized: boolean;
  envConfigured: boolean;
  authenticated: boolean;
  username?: string;
}
