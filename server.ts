import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type {
  AdBanner,
  AdminOverviewResponse,
  Lead,
  Product,
  ProductCategory,
  ProductMaterial,
  StoreInfo,
} from './src/types.ts';

interface AdminCredentialRecord {
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}

interface StoreDatabase {
  products: Product[];
  banners: AdBanner[];
  leads: Lead[];
  storeInfo: StoreInfo;
  adminAuth: AdminCredentialRecord | null;
}

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const STORE_FILE = path.resolve(DATA_DIR, 'store.json');

const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString('hex');
function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SESSION_SECRET;
}

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isBannerVisibleToday(banner: AdBanner, todayISO: string): boolean {
  if (!banner.active) return false;
  if (banner.startDate && todayISO < banner.startDate) return false;
  if (banner.endDate && todayISO > banner.endDate) return false;
  return true;
}

function createInitialData(): StoreDatabase {
  const products: Product[] = [
    {
      id: 'prod-anillo-lumiere',
      sku: 'HI-AN-018',
      name: 'Anillo Solitario Lumière',
      category: 'Anillos',
      material: 'Oro Amarillo',
      karat: '18k',
      price: 42500,
      discountPercent: 15,
      images: [
        '/src/assets/images/product_ring_solitaire_1795641786984.jpg',
        '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
      ],
      description:
        'Solitario clásico en oro amarillo sólido de 18 quilates con diamante natural corte brillante de 0.75 ct, claridad VS1 y certificación internacional.',
      available: true,
      featured: true,
      views: 148,
      createdAt: '2026-10-12T10:30:00.000Z',
    },
    {
      id: 'prod-collar-eterna',
      sku: 'HI-CO-014',
      name: 'Collar Gota Diamante Éterna',
      category: 'Collares',
      material: 'Oro Amarillo',
      karat: '14k',
      price: 18900,
      discountPercent: 10,
      images: [
        '/src/assets/images/product_necklace_pendant_1795641787907.jpg',
        '/src/assets/images/banner_gold_necklaces_1795641787215.jpg',
      ],
      description:
        'Cadena fina eslabón rolo en oro amarillo de 14k con dije biselado y diamante central de 0.28 ct. Largo ajustable de 40 a 45 cm.',
      available: true,
      featured: true,
      views: 119,
      createdAt: '2026-10-18T14:15:00.000Z',
    },
    {
      id: 'prod-aretes-perla-aurora',
      sku: 'HI-AR-022',
      name: 'Aretes Perla Austral y Pavé',
      category: 'Aretes',
      material: 'Oro Amarillo',
      karat: '18k',
      price: 24800,
      discountPercent: 0,
      images: ['/src/assets/images/product_earrings_pearl_1795641788515.jpg'],
      description:
        'Pendientes colgantes elaborados en oro amarillo de 18k con perlas naturales de cultivo lustre espejo y casquillo engastado con micro-pavé de diamantes.',
      available: true,
      featured: true,
      views: 94,
      createdAt: '2026-10-25T16:00:00.000Z',
    },
    {
      id: 'prod-pulsera-riviere',
      sku: 'HI-PU-031',
      name: 'Pulsera Rivière Platino',
      category: 'Pulseras',
      material: 'Platino',
      karat: '950',
      price: 68000,
      discountPercent: 12,
      images: ['/src/assets/images/product_bracelet_tennis_1795641788731.jpg'],
      description:
        'Brazalete tipo tennis articulado a mano en platino 950 con 3.40 ct totales en diamantes naturales corte redondo y broche de doble seguridad.',
      available: true,
      featured: true,
      views: 132,
      createdAt: '2026-11-01T11:20:00.000Z',
    },
    {
      id: 'prod-reloj-atelier',
      sku: 'HI-RE-009',
      name: 'Reloj Clásico Atelier Oro Rosa',
      category: 'Relojes',
      material: 'Oro Rosa',
      karat: '18k',
      price: 89500,
      discountPercent: 0,
      images: ['/src/assets/images/product_watch_gold_1795641788865.jpg'],
      description:
        'Guardatiempo ultradelgado con caja cepillada de oro rosa de 18k, carátula marfil lacada, cristal de zafiro antirreflejante y correa en piel legítima.',
      available: true,
      featured: false,
      views: 87,
      createdAt: '2026-11-04T09:40:00.000Z',
    },
    {
      id: 'prod-anillo-esmeralda',
      sku: 'HI-AN-041',
      name: 'Anillo Esmeralda Imperial',
      category: 'Anillos',
      material: 'Oro Amarillo',
      karat: '18k',
      price: 54000,
      discountPercent: 20,
      images: ['/src/assets/images/product_ring_emerald_1795641789118.jpg'],
      description:
        'Pieza de alta joyería con esmeralda colombiana talla octogonal de 1.65 ct flanqueada por seis diamantes laterales sobre montura artesanal de oro 18k.',
      available: true,
      featured: false,
      views: 163,
      createdAt: '2026-11-08T17:10:00.000Z',
    },
    {
      id: 'prod-collar-capas-oro',
      sku: 'HI-CO-029',
      name: 'Set Cadenas Cascada Dorada',
      category: 'Collares',
      material: 'Oro Amarillo',
      karat: '14k',
      price: 27400,
      discountPercent: 0,
      images: ['/src/assets/images/banner_gold_necklaces_1795641787215.jpg'],
      description:
        'Conjunto armonizado de cadenas italianas en oro amarillo de 14k con barra central de nueve diamantes en engaste compartido.',
      available: true,
      featured: false,
      views: 72,
      createdAt: '2026-11-12T13:05:00.000Z',
    },
    {
      id: 'prod-argolla-trilogia',
      sku: 'HI-AN-052',
      name: 'Alianza Pavé Eternidad',
      category: 'Anillos',
      material: 'Oro Blanco',
      karat: '18k',
      price: 31200,
      discountPercent: 0,
      images: ['/src/assets/images/banner_luxury_rings_1795641787477.jpg'],
      description:
        'Churumbela media eternidad en oro blanco 18k con rodio de alto brillo y 18 diamantes calibrados de fuego excepcional.',
      available: false,
      featured: false,
      views: 64,
      createdAt: '2026-11-15T15:30:00.000Z',
    },
  ];

  const banners: AdBanner[] = [
    {
      id: 'ban-temporada-brillo',
      title: 'Alta Joyería en Oro 18k y Diamantes',
      subtitle:
        'Hasta 20% de descuento en piezas seleccionadas y hasta 18 meses sin intereses.',
      ctaText: 'Explorar colección',
      imageUrl: '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
      template: 'editorial-gold',
      placement: 'hero-carousel',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      active: true,
      linkedCategory: 'Anillos',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'ban-collares-atelier',
      title: 'Colección Collares Atelier',
      subtitle:
        'Diseños italianos en oro sólido de 14k y 18k para cada momento especial.',
      ctaText: 'Ver collares',
      imageUrl: '/src/assets/images/banner_gold_necklaces_1795641787215.jpg',
      template: 'obsidian-noir',
      placement: 'hero-carousel',
      startDate: '2026-11-10',
      endDate: '2026-12-31',
      active: true,
      linkedCategory: 'Collares',
      createdAt: '2026-11-10T09:00:00.000Z',
    },
    {
      id: 'ban-franja-msi',
      title: 'Temporada de Beneficios · Hasta 18 Meses Sin Intereses y Envío Asegurado',
      subtitle: 'Vigencia limitada en todas nuestras líneas de oro y platino.',
      ctaText: 'Ver promociones',
      imageUrl: '/src/assets/images/product_ring_emerald_1795641789118.jpg',
      template: 'alabaster-minimal',
      placement: 'promo-strip',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
      active: true,
      linkedCategory: '',
      createdAt: '2026-11-01T08:00:00.000Z',
    },
    {
      id: 'ban-esmeraldas-promo',
      title: 'Selección Piedras Preciosas',
      subtitle:
        'Esmeraldas y diamantes con certificados de autenticidad y precios preferenciales.',
      ctaText: 'Descubrir ofertas',
      imageUrl: '/src/assets/images/product_ring_emerald_1795641789118.jpg',
      template: 'editorial-gold',
      placement: 'catalog-banner',
      startDate: '2026-11-05',
      endDate: '2026-12-31',
      active: true,
      linkedCategory: 'Anillos',
      createdAt: '2026-11-05T12:00:00.000Z',
    },
    {
      id: 'ban-san-valentin-2027',
      title: 'Avance San Valentín 2027',
      subtitle: 'Campaña programada automáticamente para activar el 1 de enero.',
      ctaText: 'Ver avances',
      imageUrl: '/src/assets/images/product_bracelet_tennis_1795641788731.jpg',
      template: 'obsidian-noir',
      placement: 'hero-carousel',
      startDate: '2027-01-01',
      endDate: '2027-02-14',
      active: true,
      linkedCategory: 'Pulseras',
      createdAt: '2026-11-20T10:00:00.000Z',
    },
  ];

  const leads: Lead[] = [
    {
      id: 'lead-1001',
      name: 'Sofía Mendoza Villalobos',
      phone: '+52 55 4128 9034',
      email: 'sofia.mendoza@ejemplo.mx',
      productId: 'prod-anillo-lumiere',
      productName: 'Anillo Solitario Lumière',
      message: 'Me interesa conocer disponibilidad en talla 6 y opciones a 12 MSI.',
      source: 'ficha',
      status: 'nuevo',
      createdAt: '2026-11-24T17:45:00.000Z',
    },
    {
      id: 'lead-1002',
      name: 'Alejandro Torres Peña',
      phone: '+52 33 8910 2214',
      email: 'atorres@ejemplo.mx',
      productId: 'prod-anillo-esmeralda',
      productName: 'Anillo Esmeralda Imperial',
      message: 'Quisiera agendar una cita en tienda para ver la esmeralda en persona.',
      source: 'ficha',
      status: 'nuevo',
      createdAt: '2026-11-23T14:20:00.000Z',
    },
    {
      id: 'lead-1003',
      name: 'Valeria Castañeda Ruiz',
      phone: '+52 81 3045 7712',
      email: 'valeria.cr@ejemplo.mx',
      productId: 'prod-pulsera-riviere',
      productName: 'Pulsera Rivière Platino',
      message: 'Solicito ficha técnica y certificado de los diamantes.',
      source: 'ficha',
      status: 'contactado',
      createdAt: '2026-11-21T11:10:00.000Z',
    },
    {
      id: 'lead-1004',
      name: 'Carlos Eduardo Navarro',
      phone: '+52 55 6723 1189',
      email: 'cnavarro@ejemplo.mx',
      productName: 'Asesoría personalizada',
      message: 'Busco argollas de matrimonio personalizadas en oro blanco 18k.',
      source: 'contacto',
      status: 'cerrado',
      createdAt: '2026-11-19T19:00:00.000Z',
    },
  ];

  const storeInfo: StoreInfo = {
    name: 'Joyería HI',
    whatsappNumber: '525512345678',
    phoneDisplay: '+52 (55) 1234 5678',
    email: 'atencion@joyeriahi.com',
    address: 'Av. Presidente Masaryk 340, Polanco, Miguel Hidalgo',
    city: 'Ciudad de México, C.P. 11550',
    hours: 'Lunes a Sábado: 11:00 – 20:00 · Domingo: 11:00 – 18:00',
    instagramHandle: '@joyeriahi.oficial',
    facebookHandle: 'Joyería HI Atelier',
  };

  return {
    products,
    banners,
    leads,
    storeInfo,
    adminAuth: null,
  };
}

function ensureStorage(): StoreDatabase {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const initial = createInitialData();
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  const raw = fs.readFileSync(STORE_FILE, 'utf8');
  return JSON.parse(raw) as StoreDatabase;
}

let db: StoreDatabase = ensureStorage();

function saveDb(): void {
  const tempPath = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_FILE);
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, hashHex: string, salt: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hashHex, 'hex');
  if (candidate.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidate, stored);
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  if (!safeEqualStrings(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!parsed.sub || !parsed.exp || Date.now() > parsed.exp) return null;
    return { sub: parsed.sub };
  } catch {
    return null;
  }
}

interface AuthenticatedRequest extends Request {
  adminUser?: string;
}

function extractBearerUser(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const verified = verifyToken(token);
  return verified ? verified.sub : null;
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: 'Sesión administrativa inválida o expirada.' });
    return;
  }
  req.adminUser = user;
  next();
}

const VALID_CATEGORIES = new Set<ProductCategory>([
  'Anillos',
  'Collares',
  'Aretes',
  'Pulseras',
  'Relojes',
]);
const VALID_MATERIALS = new Set<ProductMaterial>([
  'Oro Amarillo',
  'Oro Blanco',
  'Oro Rosa',
  'Plata',
  'Platino',
]);

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/storefront', (_req, res) => {
    const today = getTodayISO();
    const activeBanners = db.banners.filter((b) => isBannerVisibleToday(b, today));
    res.json({
      products: db.products,
      banners: activeBanners,
      storeInfo: db.storeInfo,
    });
  });

  app.post('/api/products/:id/view', (req, res) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    product.views += 1;
    saveDb();
    res.json({ views: product.views });
  });

  app.post('/api/leads', (req, res) => {
    const body = req.body as Partial<Lead>;
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim();
    const productName = String(body.productName || 'Consulta general').trim();
    const productId = body.productId ? String(body.productId).trim() : undefined;
    const message = body.message ? String(body.message).trim().slice(0, 800) : '';
    const source = body.source === 'ficha' ? 'ficha' : 'contacto';

    if (name.length < 2 || phone.length < 6 || !email.includes('@')) {
      res.status(400).json({
        error: 'Por favor ingresa nombre completo, teléfono/WhatsApp válido y correo electrónico.',
      });
      return;
    }

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name,
      phone,
      email,
      productId,
      productName,
      message,
      source,
      status: 'nuevo',
      createdAt: new Date().toISOString(),
    };

    db.leads.unshift(newLead);
    saveDb();
    res.status(201).json(newLead);
  });

  app.get('/api/auth/status', (req, res) => {
    const envPassword = process.env.ADMIN_PASSWORD || '';
    const envConfigured = envPassword.length > 0;
    const initialized = envConfigured || Boolean(db.adminAuth);
    const username = extractBearerUser(req);
    res.json({
      initialized,
      envConfigured,
      authenticated: Boolean(username),
      username: username || undefined,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    const envPassword = process.env.ADMIN_PASSWORD || '';
    if (envPassword.length > 0 || db.adminAuth) {
      res.status(403).json({ error: 'Las credenciales de administrador ya están configuradas.' });
      return;
    }
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '');
    if (cleanUser.length < 3 || cleanPass.length < 6) {
      res.status(400).json({
        error: 'El usuario debe tener al menos 3 caracteres y la contraseña al menos 6.',
      });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    db.adminAuth = {
      username: cleanUser,
      passwordHash: hashPassword(cleanPass, salt),
      salt,
      updatedAt: new Date().toISOString(),
    };
    saveDb();
    const token = signToken(cleanUser);
    res.status(201).json({ token, username: cleanUser });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '');

    const envPassword = process.env.ADMIN_PASSWORD || '';
    const envUser = process.env.ADMIN_USERNAME || 'admin';

    if (envPassword.length > 0) {
      const userMatches = safeEqualStrings(cleanUser, envUser);
      const passMatches = safeEqualStrings(cleanPass, envPassword);
      if (!userMatches || !passMatches) {
        res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        return;
      }
      res.json({ token: signToken(envUser), username: envUser });
      return;
    }

    if (!db.adminAuth) {
      res.status(400).json({ error: 'Aún no se ha configurado la cuenta de administrador.' });
      return;
    }

    const userMatches = safeEqualStrings(cleanUser, db.adminAuth.username);
    const passMatches = verifyPassword(
      cleanPass,
      db.adminAuth.passwordHash,
      db.adminAuth.salt
    );
    if (!userMatches || !passMatches) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      return;
    }

    res.json({ token: signToken(db.adminAuth.username), username: db.adminAuth.username });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const today = getTodayISO();
    const activePromotions = db.products.filter((p) => p.discountPercent > 0).length;
    const activeBanners = db.banners.filter((b) => isBannerVisibleToday(b, today)).length;
    const newLeadsCount = db.leads.filter((l) => l.status === 'nuevo').length;
    const totalViews = db.products.reduce((acc, p) => acc + p.views, 0);

    const payload: AdminOverviewResponse = {
      products: db.products,
      banners: db.banners,
      leads: db.leads,
      storeInfo: db.storeInfo,
      stats: {
        totalProducts: db.products.length,
        availableProducts: db.products.filter((p) => p.available).length,
        activePromotions,
        activeBanners,
        newLeadsCount,
        totalLeadsCount: db.leads.length,
        totalViews,
      },
    };
    res.json(payload);
  });

  app.post('/api/admin/upload', requireAdmin, (req, res) => {
    const { dataUrl } = req.body as { dataUrl?: string };
    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Archivo de imagen no proporcionado.' });
      return;
    }

    const match = /^data:(image\/(jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Formato inválido. Usa JPG, PNG o WebP.' });
      return;
    }

    const mimeSubtype = match[2] === 'jpg' ? 'jpeg' : match[2];
    const buffer = Buffer.from(match[3], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'La imagen supera el límite de 5 MB.' });
      return;
    }

    const filename = `${crypto.randomUUID()}.${mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype}`;
    const resolvedTarget = path.resolve(UPLOADS_DIR, filename);
    if (!resolvedTarget.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Ruta de archivo inválida.' });
      return;
    }

    fs.writeFileSync(resolvedTarget, buffer);
    res.status(201).json({ url: `/uploads/${filename}` });
  });

  app.post('/api/admin/products', requireAdmin, (req, res) => {
    const body = req.body as Partial<Product>;
    const name = String(body.name || '').trim();
    const category = body.category as ProductCategory;
    const material = body.material as ProductMaterial;
    const karat = String(body.karat || '').trim();
    const price = Number(body.price);
    const discountPercent = Math.min(90, Math.max(0, Number(body.discountPercent) || 0));
    const description = String(body.description || '').trim();
    const images = Array.isArray(body.images)
      ? body.images.map((u) => String(u).trim()).filter(Boolean)
      : [];

    if (!name || !VALID_CATEGORIES.has(category) || !VALID_MATERIALS.has(material) || !karat || !Number.isFinite(price) || price <= 0) {
      res.status(400).json({ error: 'Completa nombre, categoría, material, quilataje y precio válido.' });
      return;
    }

    const sku =
      String(body.sku || '').trim() ||
      `HI-${category.slice(0, 2).toUpperCase()}-${String(Math.floor(100 + Math.random() * 899))}`;

    const created: Product = {
      id: `prod-${Date.now()}`,
      sku,
      name,
      category,
      material,
      karat,
      price: Math.round(price),
      discountPercent: Math.round(discountPercent),
      images: images.length > 0 ? images : ['/src/assets/images/product_ring_solitaire_1795641786984.jpg'],
      description: description || 'Pieza exclusiva de Joyería HI elaborada con metales preciosos certificados.',
      available: body.available !== false,
      featured: Boolean(body.featured),
      views: 0,
      createdAt: new Date().toISOString(),
    };

    db.products.unshift(created);
    saveDb();
    res.status(201).json(created);
  });

  app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const index = db.products.findIndex((p) => p.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const existing = db.products[index];
    const body = req.body as Partial<Product>;
    const nextCategory = (body.category || existing.category) as ProductCategory;
    const nextMaterial = (body.material || existing.material) as ProductMaterial;

    if (!VALID_CATEGORIES.has(nextCategory) || !VALID_MATERIALS.has(nextMaterial)) {
      res.status(400).json({ error: 'Categoría o material inválido.' });
      return;
    }

    const updated: Product = {
      ...existing,
      sku: body.sku !== undefined ? String(body.sku).trim() || existing.sku : existing.sku,
      name: body.name !== undefined ? String(body.name).trim() || existing.name : existing.name,
      category: nextCategory,
      material: nextMaterial,
      karat: body.karat !== undefined ? String(body.karat).trim() || existing.karat : existing.karat,
      price: body.price !== undefined && Number(body.price) > 0 ? Math.round(Number(body.price)) : existing.price,
      discountPercent:
        body.discountPercent !== undefined
          ? Math.min(90, Math.max(0, Math.round(Number(body.discountPercent) || 0)))
          : existing.discountPercent,
      images:
        Array.isArray(body.images) && body.images.length > 0
          ? body.images.map((u) => String(u).trim()).filter(Boolean)
          : existing.images,
      description:
        body.description !== undefined
          ? String(body.description).trim()
          : existing.description,
      available: body.available !== undefined ? Boolean(body.available) : existing.available,
      featured: body.featured !== undefined ? Boolean(body.featured) : existing.featured,
    };

    db.products[index] = updated;
    saveDb();
    res.json(updated);
  });

  app.patch('/api/admin/products/:id/availability', requireAdmin, (req, res) => {
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    product.available = Boolean((req.body as { available?: boolean }).available);
    saveDb();
    res.json(product);
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const before = db.products.length;
    db.products = db.products.filter((p) => p.id !== req.params.id);
    if (db.products.length === before) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    saveDb();
    res.json({ ok: true });
  });

  app.post('/api/admin/promotions/apply', requireAdmin, (req, res) => {
    const { scope, targetId, discountPercent } = req.body as {
      scope?: 'product' | 'category';
      targetId?: string;
      discountPercent?: number;
    };
    const pct = Math.min(90, Math.max(0, Math.round(Number(discountPercent) || 0)));

    if (scope === 'product') {
      const product = db.products.find((p) => p.id === targetId);
      if (!product) {
        res.status(404).json({ error: 'Producto no encontrado.' });
        return;
      }
      product.discountPercent = pct;
      saveDb();
      res.json({ updatedCount: 1, products: db.products });
      return;
    }

    if (scope === 'category' && targetId && VALID_CATEGORIES.has(targetId as ProductCategory)) {
      let updatedCount = 0;
      db.products = db.products.map((p) => {
        if (p.category === targetId) {
          updatedCount += 1;
          return { ...p, discountPercent: pct };
        }
        return p;
      });
      saveDb();
      res.json({ updatedCount, products: db.products });
      return;
    }

    res.status(400).json({ error: 'Parámetros de promoción inválidos.' });
  });

  app.post('/api/admin/banners', requireAdmin, (req, res) => {
    const body = req.body as Partial<AdBanner>;
    const title = String(body.title || '').trim();
    const subtitle = String(body.subtitle || '').trim();
    const startDate = String(body.startDate || '').trim();
    const endDate = String(body.endDate || '').trim();

    if (!title || !startDate || !endDate) {
      res.status(400).json({ error: 'Título, fecha de inicio y fecha de fin son obligatorios.' });
      return;
    }

    const created: AdBanner = {
      id: `ban-${Date.now()}`,
      title,
      subtitle: subtitle || 'Promoción exclusiva Joyería HI.',
      ctaText: String(body.ctaText || 'Ver colección').trim() || 'Ver colección',
      imageUrl:
        String(body.imageUrl || '').trim() ||
        '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
      template:
        body.template === 'obsidian-noir' || body.template === 'alabaster-minimal'
          ? body.template
          : 'editorial-gold',
      placement:
        body.placement === 'promo-strip' || body.placement === 'catalog-banner'
          ? body.placement
          : 'hero-carousel',
      startDate,
      endDate,
      active: body.active !== false,
      linkedCategory: body.linkedCategory || '',
      createdAt: new Date().toISOString(),
    };

    db.banners.unshift(created);
    saveDb();
    res.status(201).json(created);
  });

  app.put('/api/admin/banners/:id', requireAdmin, (req, res) => {
    const index = db.banners.findIndex((b) => b.id === req.params.id);
    if (index === -1) {
      res.status(404).json({ error: 'Publicidad no encontrada.' });
      return;
    }
    const existing = db.banners[index];
    const body = req.body as Partial<AdBanner>;
    const updated: AdBanner = {
      ...existing,
      title: body.title !== undefined ? String(body.title).trim() || existing.title : existing.title,
      subtitle: body.subtitle !== undefined ? String(body.subtitle).trim() : existing.subtitle,
      ctaText: body.ctaText !== undefined ? String(body.ctaText).trim() || existing.ctaText : existing.ctaText,
      imageUrl: body.imageUrl !== undefined ? String(body.imageUrl).trim() || existing.imageUrl : existing.imageUrl,
      template: body.template || existing.template,
      placement: body.placement || existing.placement,
      startDate: body.startDate !== undefined ? String(body.startDate).trim() : existing.startDate,
      endDate: body.endDate !== undefined ? String(body.endDate).trim() : existing.endDate,
      active: body.active !== undefined ? Boolean(body.active) : existing.active,
      linkedCategory: body.linkedCategory !== undefined ? body.linkedCategory : existing.linkedCategory,
    };

    db.banners[index] = updated;
    saveDb();
    res.json(updated);
  });

  app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => {
    const before = db.banners.length;
    db.banners = db.banners.filter((b) => b.id !== req.params.id);
    if (db.banners.length === before) {
      res.status(404).json({ error: 'Publicidad no encontrada.' });
      return;
    }
    saveDb();
    res.json({ ok: true });
  });

  app.patch('/api/admin/leads/:id', requireAdmin, (req, res) => {
    const lead = db.leads.find((l) => l.id === req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }
    const { status } = req.body as { status?: Lead['status'] };
    if (status === 'nuevo' || status === 'contactado' || status === 'cerrado') {
      lead.status = status;
      saveDb();
      res.json(lead);
      return;
    }
    res.status(400).json({ error: 'Estado inválido.' });
  });

  app.delete('/api/admin/leads/:id', requireAdmin, (req, res) => {
    const before = db.leads.length;
    db.leads = db.leads.filter((l) => l.id !== req.params.id);
    if (db.leads.length === before) {
      res.status(404).json({ error: 'Registro no encontrado.' });
      return;
    }
    saveDb();
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Joyería HI server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
