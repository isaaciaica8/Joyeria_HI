import type {
  AdBanner,
  AdminOverviewResponse,
  AuthStatusResponse,
  Lead,
  Product,
  ProductCategory,
  StorefrontResponse,
} from '../types';

async function requestJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Error en la solicitud.');
  }
  return data as T;
}

export function fetchStorefront(): Promise<StorefrontResponse> {
  return requestJSON<StorefrontResponse>('/api/storefront');
}

export function trackProductView(productId: string): Promise<{ views: number }> {
  return requestJSON<{ views: number }>(`/api/products/${encodeURIComponent(productId)}/view`, {
    method: 'POST',
  });
}

export function submitLead(payload: {
  name: string;
  phone: string;
  email: string;
  productId?: string;
  productName: string;
  message?: string;
  source: 'ficha' | 'contacto';
}): Promise<Lead> {
  return requestJSON<Lead>('/api/leads', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchAuthStatus(token: string | null): Promise<AuthStatusResponse> {
  return requestJSON<AuthStatusResponse>('/api/auth/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function setupAdminAccount(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  return requestJSON<{ token: string; username: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; username: string }> {
  return requestJSON<{ token: string; username: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function fetchAdminOverview(token: string): Promise<AdminOverviewResponse> {
  return requestJSON<AdminOverviewResponse>('/api/admin/overview', {
    headers: authHeader(token),
  });
}

export function uploadAdminImage(token: string, dataUrl: string): Promise<{ url: string }> {
  return requestJSON<{ url: string }>('/api/admin/upload', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ dataUrl }),
  });
}

export function createProduct(token: string, product: Partial<Product>): Promise<Product> {
  return requestJSON<Product>('/api/admin/products', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(product),
  });
}

export function updateProduct(
  token: string,
  id: string,
  product: Partial<Product>
): Promise<Product> {
  return requestJSON<Product>(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(product),
  });
}

export function toggleProductAvailability(
  token: string,
  id: string,
  available: boolean
): Promise<Product> {
  return requestJSON<Product>(`/api/admin/products/${encodeURIComponent(id)}/availability`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ available }),
  });
}

export function deleteProduct(token: string, id: string): Promise<{ ok: boolean }> {
  return requestJSON<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

export function applyPromotion(
  token: string,
  payload: { scope: 'product' | 'category'; targetId: string | ProductCategory; discountPercent: number }
): Promise<{ updatedCount: number; products: Product[] }> {
  return requestJSON<{ updatedCount: number; products: Product[] }>('/api/admin/promotions/apply', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

export function createBanner(token: string, banner: Partial<AdBanner>): Promise<AdBanner> {
  return requestJSON<AdBanner>('/api/admin/banners', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(banner),
  });
}

export function updateBanner(
  token: string,
  id: string,
  banner: Partial<AdBanner>
): Promise<AdBanner> {
  return requestJSON<AdBanner>(`/api/admin/banners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeader(token),
    body: JSON.stringify(banner),
  });
}

export function deleteBanner(token: string, id: string): Promise<{ ok: boolean }> {
  return requestJSON<{ ok: boolean }>(`/api/admin/banners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}

export function updateLeadStatus(
  token: string,
  id: string,
  status: Lead['status']
): Promise<Lead> {
  return requestJSON<Lead>(`/api/admin/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ status }),
  });
}

export function deleteLead(token: string, id: string): Promise<{ ok: boolean }> {
  return requestJSON<{ ok: boolean }>(`/api/admin/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
}
