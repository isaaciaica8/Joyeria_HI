import nodemailer from 'nodemailer';

export interface LeadNotificationPayload {
  leadId: string;
  name: string;
  phone: string;
  email: string;
  productId?: string;
  productName: string;
  message?: string;
  source: 'ficha' | 'contacto';
}

export interface NotificationLogEntry {
  id: string;
  createdAt: string;
  leadId: string;
  clientName: string;
  productName: string;
  source: 'ficha' | 'contacto' | 'prueba';
  status: 'enviado' | 'pendiente_configuracion' | 'error';
  detail: string;
}

export interface NotificationTransportConfig {
  configured: boolean;
  provider: 'resend' | 'smtp' | 'none';
  recipientEmail: string;
}

const DEFAULT_ADMIN_EMAIL = 'isaaciaica8@gmail.com';
const MAX_LOGS = 20;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

const notifiedLeads = new Map<string, number>();
const ipRequests = new Map<string, number[]>();
const recentLogs: NotificationLogEntry[] = [];

function stripHeaderBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePublicAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().replace(/\/$/, '');
    }
    return '';
  } catch {
    return '';
  }
}

function recordLog(entry: NotificationLogEntry): void {
  recentLogs.unshift(entry);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.length = MAX_LOGS;
  }
}

export function getRecentNotificationLogs(): NotificationLogEntry[] {
  return [...recentLogs];
}

export function getNotificationConfig(fallbackAdminEmail?: string): NotificationTransportConfig {
  const envRecipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const recipientEmail =
    envRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(envRecipient)
      ? envRecipient
      : fallbackAdminEmail || DEFAULT_ADMIN_EMAIL;

  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasSmtp = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );

  if (hasResend) {
    return { configured: true, provider: 'resend', recipientEmail };
  }
  if (hasSmtp) {
    return { configured: true, provider: 'smtp', recipientEmail };
  }
  return { configured: false, provider: 'none', recipientEmail };
}

export function isRateLimited(ipKey: string): boolean {
  const now = Date.now();
  const existing = (ipRequests.get(ipKey) || []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (existing.length >= RATE_LIMIT_MAX) {
    ipRequests.set(ipKey, existing);
    return true;
  }
  existing.push(now);
  ipRequests.set(ipKey, existing);
  return false;
}

export function validateLeadNotificationPayload(
  rawBody: unknown
): { ok: true; data: LeadNotificationPayload } | { ok: false; error: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { ok: false, error: 'Cuerpo de solicitud inválido.' };
  }

  const body = rawBody as Record<string, unknown>;
  const leadId = typeof body.leadId === 'string' ? body.leadId.trim() : '';
  const name = typeof body.name === 'string' ? stripHeaderBreaks(body.name) : '';
  const phone = typeof body.phone === 'string' ? stripHeaderBreaks(body.phone) : '';
  const email = typeof body.email === 'string' ? stripHeaderBreaks(body.email) : '';
  const productName =
    typeof body.productName === 'string' ? stripHeaderBreaks(body.productName) : '';
  const productId =
    typeof body.productId === 'string' ? body.productId.trim() : undefined;
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const source = body.source === 'ficha' ? 'ficha' : body.source === 'contacto' ? 'contacto' : null;

  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(leadId)) {
    return { ok: false, error: 'Identificador de registro inválido.' };
  }
  if (name.length < 2 || name.length > 120) {
    return { ok: false, error: 'Nombre del cliente inválido.' };
  }
  if (phone.length < 6 || phone.length > 32) {
    return { ok: false, error: 'Teléfono del cliente inválido.' };
  }
  if (email.length < 5 || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Correo del cliente inválido.' };
  }
  if (productName.length < 1 || productName.length > 160) {
    return { ok: false, error: 'Producto de interés inválido.' };
  }
  if (productId && !/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) {
    return { ok: false, error: 'Identificador de producto inválido.' };
  }
  if (message.length > 800) {
    return { ok: false, error: 'Mensaje demasiado largo.' };
  }
  if (!source) {
    return { ok: false, error: 'Origen de solicitud inválido.' };
  }

  return {
    ok: true,
    data: {
      leadId,
      name,
      phone,
      email,
      productId,
      productName,
      message,
      source,
    },
  };
}

function buildLeadEmailContent(payload: LeadNotificationPayload) {
  const originLabel =
    payload.source === 'ficha' ? 'Ficha de producto ("Me interesa")' : 'Formulario de contacto';
  const appUrl = sanitizePublicAppUrl();
  const phoneDigits = payload.phone.replace(/\D/g, '');
  const whatsappHref = phoneDigits.length >= 8 ? `https://wa.me/${phoneDigits}` : '';
  const safeSubjectProduct = payload.productName.slice(0, 80);

  const subject = `Nuevo cliente interesado: ${safeSubjectProduct} — Joyería HI`;

  const textLines = [
    'Joyería HI — Notificación automática de nuevo cliente interesado',
    '',
    `Producto de interés: ${payload.productName}`,
    `Origen: ${originLabel}`,
    `Cliente: ${payload.name}`,
    `Teléfono / WhatsApp: ${payload.phone}`,
    `Correo electrónico: ${payload.email}`,
    payload.message ? `Notas del cliente: ${payload.message}` : '',
    '',
    appUrl ? `Revisar en el panel administrativo: ${appUrl}` : '',
  ].filter(Boolean);

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background:#FAF9F7; padding:24px; color:#18181B;">
      <div style="max-width:580px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:14px; overflow:hidden;">
        <div style="background:#18181B; padding:20px 24px; color:#FAF9F7;">
          <p style="margin:0; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:#DFC58B;">
            Joyería HI · Clientes Interesados
          </p>
          <h1 style="margin:6px 0 0; font-size:20px; font-weight:600;">
            Nueva solicitud de información
          </h1>
        </div>
        <div style="padding:24px; font-size:14px; line-height:1.6;">
          <p style="margin:0 0 16px; color:#52525B;">
            Se registró un nuevo cliente interesado desde <strong>${escapeHtml(originLabel)}</strong>:
          </p>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; color:#64748B; width:150px;">Pieza / Servicio</td>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; font-weight:600; color:#8C6D2E;">${escapeHtml(payload.productName)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; color:#64748B;">Cliente</td>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; font-weight:600;">${escapeHtml(payload.name)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; color:#64748B;">Teléfono / WhatsApp</td>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.phone)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9; color:#64748B;">Correo electrónico</td>
              <td style="padding:8px 0; border-bottom:1px solid #F1F5F9;">${escapeHtml(payload.email)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748B; vertical-align:top;">Notas</td>
              <td style="padding:8px 0; color:#334155;">${escapeHtml(payload.message || 'Sin notas adicionales')}</td>
            </tr>
          </table>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            ${
              whatsappHref
                ? `<a href="${escapeHtml(whatsappHref)}" style="display:inline-block; background:#15803D; color:#FFFFFF; text-decoration:none; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;">Contactar por WhatsApp</a>`
                : ''
            }
            ${
              appUrl
                ? `<a href="${escapeHtml(appUrl)}" style="display:inline-block; background:#18181B; color:#FFFFFF; text-decoration:none; padding:10px 16px; border-radius:8px; font-size:13px; font-weight:600;">Abrir Joyería HI</a>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text: textLines.join('\n'), html };
}

async function sendRawEmail(params: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ provider: 'resend' | 'smtp' }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const fromAddress =
      process.env.SMTP_FROM?.trim() || 'Joyería HI <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.to],
        reply_to: params.replyTo,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Resend HTTP ${response.status}: ${errBody.slice(0, 180)}`);
    }
    return { provider: 'resend' };
  }

  const host = process.env.SMTP_HOST?.trim() || '';
  const user = process.env.SMTP_USER?.trim() || '';
  const pass = process.env.SMTP_PASS?.trim() || '';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
  const fromAddress = process.env.SMTP_FROM?.trim() || `Joyería HI <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: fromAddress,
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  return { provider: 'smtp' };
}

export async function dispatchLeadNotification(
  payload: LeadNotificationPayload
): Promise<{
  sent: boolean;
  configured: boolean;
  deduplicated?: boolean;
  provider: 'resend' | 'smtp' | 'none';
  recipientEmail: string;
  detail: string;
}> {
  const now = Date.now();
  // Prune expired dedup keys
  for (const [key, ts] of notifiedLeads.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      notifiedLeads.delete(key);
    }
  }

  const config = getNotificationConfig();
  if (notifiedLeads.has(payload.leadId)) {
    return {
      sent: false,
      configured: config.configured,
      deduplicated: true,
      provider: config.provider,
      recipientEmail: config.recipientEmail,
      detail: 'Notificación ya procesada previamente para este registro.',
    };
  }

  notifiedLeads.set(payload.leadId, now);

  if (!config.configured) {
    const detail =
      'Falta configurar SMTP_* o RESEND_API_KEY en los secretos del entorno.';
    recordLog({
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      leadId: payload.leadId,
      clientName: payload.name,
      productName: payload.productName,
      source: payload.source,
      status: 'pendiente_configuracion',
      detail,
    });
    return {
      sent: false,
      configured: false,
      provider: 'none',
      recipientEmail: config.recipientEmail,
      detail,
    };
  }

  const { subject, text, html } = buildLeadEmailContent(payload);

  try {
    const result = await sendRawEmail({
      to: config.recipientEmail,
      replyTo: payload.email,
      subject,
      text,
      html,
    });
    const detail = `Correo enviado a ${config.recipientEmail}`;
    recordLog({
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      leadId: payload.leadId,
      clientName: payload.name,
      productName: payload.productName,
      source: payload.source,
      status: 'enviado',
      detail,
    });
    return {
      sent: true,
      configured: true,
      provider: result.provider,
      recipientEmail: config.recipientEmail,
      detail,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 180) : 'Error al enviar correo.';
    recordLog({
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      leadId: payload.leadId,
      clientName: payload.name,
      productName: payload.productName,
      source: payload.source,
      status: 'error',
      detail,
    });
    return {
      sent: false,
      configured: true,
      provider: config.provider,
      recipientEmail: config.recipientEmail,
      detail,
    };
  }
}

export async function dispatchTestAdminNotification(adminEmail: string): Promise<{
  sent: boolean;
  configured: boolean;
  provider: 'resend' | 'smtp' | 'none';
  recipientEmail: string;
  detail: string;
}> {
  const config = getNotificationConfig(adminEmail);
  if (!config.configured) {
    return {
      sent: false,
      configured: false,
      provider: 'none',
      recipientEmail: config.recipientEmail,
      detail:
        'Configura RESEND_API_KEY o SMTP_HOST/SMTP_USER/SMTP_PASS en las variables de entorno para activar el envío.',
    };
  }

  const subject = 'Prueba de notificaciones — Joyería HI';
  const text = `Las notificaciones automáticas de Clientes Interesados para Joyería HI están activas y enviando correctamente a ${config.recipientEmail}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding:24px; background:#FAF9F7; color:#18181B;">
      <div style="max-width:520px; margin:0 auto; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:12px; padding:24px;">
        <p style="margin:0; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#8C6D2E;">Joyería HI</p>
        <h2 style="margin:8px 0 12px; font-size:18px;">Notificaciones por correo activas</h2>
        <p style="margin:0; font-size:14px; color:#3F3F46;">
          Este correo confirma que el sistema enviará avisos automáticos a <strong>${escapeHtml(
            config.recipientEmail
          )}</strong> cada vez que un cliente interesado solicite información sobre una pieza.
        </p>
      </div>
    </div>
  `;

  try {
    const result = await sendRawEmail({
      to: config.recipientEmail,
      subject,
      text,
      html,
    });
    const detail = `Correo de prueba enviado a ${config.recipientEmail}`;
    recordLog({
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      leadId: 'test-admin',
      clientName: 'Administrador',
      productName: 'Correo de prueba',
      source: 'prueba',
      status: 'enviado',
      detail,
    });
    return {
      sent: true,
      configured: true,
      provider: result.provider,
      recipientEmail: config.recipientEmail,
      detail,
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message.slice(0, 180) : 'No se pudo enviar la prueba.';
    recordLog({
      id: `log-${Date.now()}`,
      createdAt: new Date().toISOString(),
      leadId: 'test-admin',
      clientName: 'Administrador',
      productName: 'Correo de prueba',
      source: 'prueba',
      status: 'error',
      detail,
    });
    return {
      sent: false,
      configured: true,
      provider: config.provider,
      recipientEmail: config.recipientEmail,
      detail,
    };
  }
}
