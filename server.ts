import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const FIREBASE_CONFIG_PATH = path.resolve(process.cwd(), 'firebase-applet-config.json');

const BOOTSTRAP_ADMIN_EMAIL = 'isaaciaica8@gmail.com';

function loadFirebaseApiKey(): string {
  try {
    const raw = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey || '';
  } catch {
    return '';
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

interface AuthenticatedRequest extends Request {
  adminEmail?: string;
}

async function requireFirebaseAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesión administrativa requerida.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  const apiKey = loadFirebaseApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'Configuración de Firebase no disponible.' });
    return;
  }

  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) {
      res.status(401).json({ error: 'Token de Firebase inválido o expirado.' });
      return;
    }

    const payload = (await verifyRes.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = payload.users?.[0];
    if (!user || !user.emailVerified || user.email !== BOOTSTRAP_ADMIN_EMAIL) {
      res.status(403).json({ error: 'Acceso restringido a administradores autorizados.' });
      return;
    }

    req.adminEmail = user.email;
    next();
  } catch {
    res.status(401).json({ error: 'No se pudo verificar la sesión de Firebase.' });
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/uploads', express.static(UPLOADS_DIR));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/admin/upload', requireFirebaseAdmin, (req, res) => {
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
