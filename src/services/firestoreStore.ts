import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdBanner,
  Lead,
  Product,
  ProductCategory,
  ProductViewEvent,
  StoreInfo,
} from '../types';
import { DEFAULT_STORE_INFO, SEED_BANNERS, SEED_PRODUCTS } from './seedData';

function toISOStringSafe(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

function clampString(val: unknown, maxLen: number): string {
  return String(val || '').trim().slice(0, maxLen);
}

function sanitizeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
}

export function subscribeProducts(
  onData: (products: Product[], isEmptyCollection: boolean) => void
): Unsubscribe {
  const path = 'products';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData([], true);
        return;
      }
      const items: Product[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sku: String(data.sku || ''),
          name: String(data.name || ''),
          category: data.category,
          material: data.material,
          karat: String(data.karat || ''),
          price: Number(data.price || 0),
          discountPercent: Number(data.discountPercent || 0),
          images: Array.isArray(data.images) ? data.images.map(String) : [],
          description: String(data.description || ''),
          available: Boolean(data.available),
          featured: Boolean(data.featured),
          views: Number(data.views || 0),
          createdAt: toISOStringSafe(data.createdAt),
        };
      });
      onData(items, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeBanners(
  onData: (banners: AdBanner[], isEmptyCollection: boolean) => void
): Unsubscribe {
  const path = 'banners';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onData([], true);
        return;
      }
      const items: AdBanner[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title || ''),
          subtitle: String(data.subtitle || ''),
          ctaText: String(data.ctaText || ''),
          imageUrl: String(data.imageUrl || ''),
          template: data.template,
          placement: data.placement,
          startDate: String(data.startDate || ''),
          endDate: String(data.endDate || ''),
          active: Boolean(data.active),
          linkedCategory: (data.linkedCategory || '') as ProductCategory | '',
          createdAt: toISOStringSafe(data.createdAt),
        };
      });
      onData(items, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeStoreInfo(onData: (info: StoreInfo) => void): Unsubscribe {
  const path = 'settings/storeInfo';
  return onSnapshot(
    doc(db, 'settings', 'storeInfo'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(DEFAULT_STORE_INFO);
        return;
      }
      const d = snapshot.data();
      onData({
        name: String(d.name || DEFAULT_STORE_INFO.name),
        whatsappNumber: String(d.whatsappNumber || DEFAULT_STORE_INFO.whatsappNumber),
        phoneDisplay: String(d.phoneDisplay || DEFAULT_STORE_INFO.phoneDisplay),
        email: String(d.email || DEFAULT_STORE_INFO.email),
        address: String(d.address || DEFAULT_STORE_INFO.address),
        city: String(d.city || DEFAULT_STORE_INFO.city),
        hours: String(d.hours || DEFAULT_STORE_INFO.hours),
        instagramHandle: String(d.instagramHandle || DEFAULT_STORE_INFO.instagramHandle),
        facebookHandle: String(d.facebookHandle || DEFAULT_STORE_INFO.facebookHandle),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeLeads(onData: (leads: Lead[]) => void): Unsubscribe {
  const path = 'leads';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Lead[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || ''),
          phone: String(data.phone || ''),
          email: String(data.email || ''),
          productId: data.productId ? String(data.productId) : undefined,
          productName: String(data.productName || ''),
          message: String(data.message || ''),
          source: data.source === 'ficha' ? 'ficha' : 'contacto',
          status:
            data.status === 'contactado' || data.status === 'cerrado'
              ? data.status
              : 'nuevo',
          createdAt: toISOStringSafe(data.createdAt),
        };
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeProductViews(
  onData: (views: ProductViewEvent[]) => void
): Unsubscribe {
  const path = 'productViews';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: ProductViewEvent[] = [];
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const productId = String(data.productId || '');
        if (!productId) return;
        items.push({
          id: d.id,
          productId,
          createdAt: toISOStringSafe(data.createdAt),
        });
      });
      items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeProductViewCounts(
  onData: (countsByProductId: Record<string, number>) => void
): Unsubscribe {
  return subscribeProductViews((views) => {
    const counts: Record<string, number> = {};
    views.forEach((v) => {
      counts[v.productId] = (counts[v.productId] || 0) + 1;
    });
    onData(counts);
  });
}

export async function seedFirestoreIfEmpty(): Promise<void> {
  try {
    const existingProducts = await getDocs(collection(db, 'products'));
    const existingBanners = await getDocs(collection(db, 'banners'));
    const existingStore = await getDoc(doc(db, 'settings', 'storeInfo'));

    const batch = writeBatch(db);
    let hasWrites = false;

    if (existingProducts.empty) {
      SEED_PRODUCTS.forEach((p) => {
        batch.set(doc(db, 'products', sanitizeDocId(p.id)), {
          sku: p.sku,
          name: p.name,
          category: p.category,
          material: p.material,
          karat: p.karat,
          price: p.price,
          discountPercent: p.discountPercent,
          images: p.images.slice(0, 10),
          description: p.description,
          available: p.available,
          featured: p.featured,
          views: p.views,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      hasWrites = true;
    }

    if (existingBanners.empty) {
      SEED_BANNERS.forEach((b) => {
        batch.set(doc(db, 'banners', sanitizeDocId(b.id)), {
          title: b.title,
          subtitle: b.subtitle,
          ctaText: b.ctaText,
          imageUrl: b.imageUrl,
          template: b.template,
          placement: b.placement,
          startDate: b.startDate,
          endDate: b.endDate,
          active: b.active,
          linkedCategory: b.linkedCategory || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      hasWrites = true;
    }

    if (!existingStore.exists()) {
      batch.set(doc(db, 'settings', 'storeInfo'), DEFAULT_STORE_INFO);
      hasWrites = true;
    }

    if (hasWrites) {
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products/banners/settings');
  }
}

export async function createPublicLead(payload: {
  name: string;
  phone: string;
  email: string;
  productId?: string;
  productName: string;
  message?: string;
  source: 'ficha' | 'contacto';
}): Promise<void> {
  const id = sanitizeDocId(`lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const path = `leads/${id}`;
  const cleanName = clampString(payload.name, 120);
  const cleanPhone = clampString(payload.phone, 32);
  const cleanEmail = clampString(payload.email, 160);

  if (cleanName.length < 2 || cleanPhone.length < 6 || !cleanEmail.includes('@')) {
    throw new Error(
      'Por favor ingresa nombre completo, teléfono/WhatsApp válido y correo electrónico.'
    );
  }

  const docData: Record<string, unknown> = {
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    productName: clampString(payload.productName || 'Consulta general', 160),
    message: clampString(payload.message || '', 800),
    source: payload.source === 'ficha' ? 'ficha' : 'contacto',
    status: 'nuevo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.productId) {
    docData.productId = sanitizeDocId(payload.productId);
  }

  try {
    await setDoc(doc(db, 'leads', id), docData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordProductView(productId: string): Promise<void> {
  const safeProductId = sanitizeDocId(productId);
  const viewId = sanitizeDocId(`view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const path = `productViews/${viewId}`;
  try {
    const productSnap = await getDoc(doc(db, 'products', safeProductId));
    if (!productSnap.exists()) return;
    await setDoc(doc(db, 'productViews', viewId), {
      productId: safeProductId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Do not interrupt user modal if view tracking fails, but still surface permission diagnostics
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function uploadAdminImageWithFirebaseAuth(dataUrl: string): Promise<{ url: string }> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    throw new Error('Debes iniciar sesión como administrador para subir imágenes.');
  }
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ dataUrl }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Error al subir la imagen.');
  }
  return data as { url: string };
}

export async function saveProductInFirestore(
  existingId: string | null,
  payload: Partial<Product>
): Promise<void> {
  const category = payload.category || 'Anillos';
  const skuRaw =
    clampString(payload.sku, 32) ||
    `HI-${category.slice(0, 2).toUpperCase()}-${String(Math.floor(100 + Math.random() * 899))}`;
  const sku = skuRaw.replace(/[^A-Za-z0-9-]/g, '') || 'HI-001';
  const name = clampString(payload.name, 120);
  const karat = clampString(payload.karat || '18k', 16);
  const price = Math.min(50000000, Math.max(1, Math.round(Number(payload.price) || 0)));
  const discountPercent = Math.min(
    90,
    Math.max(0, Math.round(Number(payload.discountPercent) || 0))
  );
  const rawImages = Array.isArray(payload.images)
    ? payload.images.map((u) => clampString(u, 500)).filter(Boolean).slice(0, 10)
    : [];
  const images =
    rawImages.length > 0
      ? rawImages
      : ['/src/assets/images/product_ring_solitaire_1795641786984.jpg'];
  const description = clampString(
    payload.description ||
      'Pieza exclusiva de Joyería HI elaborada con metales preciosos certificados.',
    1500
  );

  if (existingId) {
    const id = sanitizeDocId(existingId);
    const path = `products/${id}`;
    try {
      await updateDoc(doc(db, 'products', id), {
        sku,
        name,
        category,
        material: payload.material || 'Oro Amarillo',
        karat,
        price,
        discountPercent,
        images,
        description,
        available: payload.available !== false,
        featured: Boolean(payload.featured),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const newId = sanitizeDocId(`prod-${Date.now()}`);
  const path = `products/${newId}`;
  try {
    await setDoc(doc(db, 'products', newId), {
      sku,
      name,
      category,
      material: payload.material || 'Oro Amarillo',
      karat,
      price,
      discountPercent,
      images,
      description,
      available: payload.available !== false,
      featured: Boolean(payload.featured),
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleProductAvailabilityInFirestore(
  id: string,
  available: boolean
): Promise<void> {
  const safeId = sanitizeDocId(id);
  const path = `products/${safeId}`;
  try {
    await updateDoc(doc(db, 'products', safeId), {
      available: Boolean(available),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProductInFirestore(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  const path = `products/${safeId}`;
  try {
    await deleteDoc(doc(db, 'products', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function applyPromotionInFirestore(
  scope: 'product' | 'category',
  targetId: string,
  discountPercent: number,
  currentProducts: Product[]
): Promise<number> {
  const pct = Math.min(90, Math.max(0, Math.round(Number(discountPercent) || 0)));
  if (scope === 'product') {
    const safeId = sanitizeDocId(targetId);
    const path = `products/${safeId}`;
    try {
      await updateDoc(doc(db, 'products', safeId), {
        discountPercent: pct,
        updatedAt: serverTimestamp(),
      });
      return 1;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  const matching = currentProducts.filter((p) => p.category === targetId);
  if (matching.length === 0) return 0;

  try {
    const batch = writeBatch(db);
    matching.forEach((p) => {
      batch.update(doc(db, 'products', sanitizeDocId(p.id)), {
        discountPercent: pct,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return matching.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'products');
  }
}

export async function saveBannerInFirestore(
  existingId: string | null,
  payload: Partial<AdBanner>
): Promise<void> {
  const title = clampString(payload.title, 140);
  const subtitle = clampString(payload.subtitle, 350);
  const ctaText = clampString(payload.ctaText || 'Ver colección', 50);
  const imageUrl = clampString(
    payload.imageUrl || '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
    500
  );
  const startDate = clampString(payload.startDate, 10);
  const endDate = clampString(payload.endDate, 10);
  const linkedCategory = clampString(payload.linkedCategory || '', 32);

  if (existingId) {
    const safeId = sanitizeDocId(existingId);
    const path = `banners/${safeId}`;
    try {
      await updateDoc(doc(db, 'banners', safeId), {
        title,
        subtitle,
        ctaText,
        imageUrl,
        template: payload.template || 'editorial-gold',
        placement: payload.placement || 'hero-carousel',
        startDate,
        endDate,
        active: payload.active !== false,
        linkedCategory,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  const newId = sanitizeDocId(`ban-${Date.now()}`);
  const path = `banners/${newId}`;
  try {
    await setDoc(doc(db, 'banners', newId), {
      title,
      subtitle,
      ctaText,
      imageUrl,
      template: payload.template || 'editorial-gold',
      placement: payload.placement || 'hero-carousel',
      startDate,
      endDate,
      active: payload.active !== false,
      linkedCategory,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteBannerInFirestore(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  const path = `banners/${safeId}`;
  try {
    await deleteDoc(doc(db, 'banners', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateLeadStatusInFirestore(
  id: string,
  status: Lead['status']
): Promise<void> {
  const safeId = sanitizeDocId(id);
  const path = `leads/${safeId}`;
  try {
    await updateDoc(doc(db, 'leads', safeId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteLeadInFirestore(id: string): Promise<void> {
  const safeId = sanitizeDocId(id);
  const path = `leads/${safeId}`;
  try {
    await deleteDoc(doc(db, 'leads', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
