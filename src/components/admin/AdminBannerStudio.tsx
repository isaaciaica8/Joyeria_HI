import { useRef, useState } from 'react';
import { Calendar, Eye, Pause, Play, Plus, Trash2, Upload } from 'lucide-react';
import type {
  AdBanner,
  BannerPlacement,
  BannerTemplate,
  ProductCategory,
} from '../../types';
import {
  deleteBannerInFirestore,
  saveBannerInFirestore,
  uploadAdminImageWithFirebaseAuth,
} from '../../services/firestoreStore';
import {
  PRODUCT_CATEGORIES,
  formatShortDate,
  getBannerScheduleState,
  getTodayISODate,
} from '../../utils/formatters';
import { BannerPreview } from '../BannerPreview';
import { JewelryImage } from '../JewelryImage';

interface AdminBannerStudioProps {
  banners: AdBanner[];
}

const TEMPLATE_OPTIONS: {
  id: BannerTemplate;
  name: string;
  desc: string;
}[] = [
  {
    id: 'editorial-gold',
    name: 'Editorial Dorado',
    desc: 'Velo cálido dorado ideal para colecciones de oro y diamantes.',
  },
  {
    id: 'obsidian-noir',
    name: 'Obsidiana Nocturna',
    desc: 'Fondo oscuro elegante con tipografía marfil y botón dorado.',
  },
  {
    id: 'alabaster-minimal',
    name: 'Alabastro Minimalista',
    desc: 'Contraste claro editorial para lanzamientos y temporada.',
  },
];

const PLACEMENT_OPTIONS: { id: BannerPlacement; label: string }[] = [
  { id: 'hero-carousel', label: 'Carrusel Principal (Inicio)' },
  { id: 'promo-strip', label: 'Franja Superior (Aviso)' },
  { id: 'catalog-banner', label: 'Sección Promociones' },
];

const PRESET_STUDIO_IMAGES = [
  {
    label: 'Anillos Solitarios',
    url: '/src/assets/images/banner_luxury_rings_1795641787477.jpg',
  },
  {
    label: 'Collares Oro 14k',
    url: '/src/assets/images/banner_gold_necklaces_1795641787215.jpg',
  },
  {
    label: 'Esmeralda Imperial',
    url: '/src/assets/images/product_ring_emerald_1795641789118.jpg',
  },
  {
    label: 'Pulsera Platino',
    url: '/src/assets/images/product_bracelet_tennis_1795641788731.jpg',
  },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function AdminBannerStudio({ banners }: AdminBannerStudioProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = getTodayISODate();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('Nueva Colección Temporada Dorada');
  const [subtitle, setSubtitle] = useState(
    'Piezas seleccionadas con hasta 20% de descuento y 12 meses sin intereses.'
  );
  const [ctaText, setCtaText] = useState('Explorar colección');
  const [template, setTemplate] = useState<BannerTemplate>('editorial-gold');
  const [placement, setPlacement] = useState<BannerPlacement>('hero-carousel');
  const [imageUrl, setImageUrl] = useState(PRESET_STUDIO_IMAGES[0].url);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('2026-12-31');
  const [linkedCategory, setLinkedCategory] = useState<ProductCategory | ''>('');
  const [active, setActive] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  async function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen JPG, PNG o WebP.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await uploadAdminImageWithFirebaseAuth(dataUrl);
      setImageUrl(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
    }
  }

  function loadBannerIntoEditor(b: AdBanner) {
    setEditingId(b.id);
    setTitle(b.title);
    setSubtitle(b.subtitle);
    setCtaText(b.ctaText);
    setTemplate(b.template);
    setPlacement(b.placement);
    setImageUrl(b.imageUrl);
    setStartDate(b.startDate);
    setEndDate(b.endDate);
    setLinkedCategory(b.linkedCategory || '');
    setActive(b.active);
    setFeedback('');
    setError('');
  }

  function resetEditor() {
    setEditingId(null);
    setTitle('');
    setSubtitle('');
    setCtaText('Explorar colección');
    setTemplate('editorial-gold');
    setPlacement('hero-carousel');
    setImageUrl(PRESET_STUDIO_IMAGES[0].url);
    setStartDate(today);
    setEndDate('2026-12-31');
    setLinkedCategory('');
    setActive(true);
    setError('');
  }

  async function handleSaveBanner(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFeedback('');

    if (endDate < startDate) {
      setError('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        subtitle,
        ctaText,
        imageUrl,
        template,
        placement,
        startDate,
        endDate,
        linkedCategory,
        active,
      };
      if (editingId) {
        await saveBannerInFirestore(editingId, payload);
        setFeedback('Publicidad actualizada correctamente.');
      } else {
        await saveBannerInFirestore(null, payload);
        setFeedback('Nueva campaña publicitaria publicada.');
      }
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la publicidad.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(banner: AdBanner) {
    await saveBannerInFirestore(banner.id, { ...banner, active: !banner.active });
  }

  async function handleDeleteBanner(id: string) {
    await deleteBannerInFirestore(id);
    if (editingId === id) resetEditor();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#18181B]">
            Generador de Publicidad
          </h2>
          <p className="text-sm text-[#52525B] mt-1">
            Crea banners con las plantillas de Joyería HI. Se activan y desactivan automáticamente según sus fechas.
          </p>
        </div>

        {editingId && (
          <button
            type="button"
            onClick={resetEditor}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-black/12 bg-white text-xs font-medium text-[#18181B] hover:bg-[#FAF9F7] cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear nueva campaña</span>
          </button>
        )}
      </div>

      {/* Studio Split: Form Left + Live Preview Right */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleSaveBanner}
          className="xl:col-span-6 bg-white rounded-2xl border border-black/8 p-6 space-y-5"
        >
          {/* Step 1: Template Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B73] mb-2">
              1. Plantilla Joyería HI
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {TEMPLATE_OPTIONS.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplate(tpl.id)}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    template === tpl.id
                      ? 'border-[#8C6D2E] bg-[#FAF7F0]'
                      : 'border-black/10 bg-white hover:bg-[#FAF9F7]'
                  }`}
                >
                  <p className="text-xs font-semibold text-[#18181B]">{tpl.name}</p>
                  <p className="text-[11px] text-[#6B6B73] mt-0.5 line-clamp-2">
                    {tpl.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Image Upload or Studio Preset */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B73]">
              2. Fotografía de campaña
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-black/15 bg-[#FAF9F7] text-xs font-medium text-[#18181B] hover:bg-[#EFECE5] cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#8C6D2E]" />
                <span>{uploading ? 'Subiendo...' : 'Subir imagen propia'}</span>
              </button>

              {PRESET_STUDIO_IMAGES.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => setImageUrl(preset.url)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                    imageUrl === preset.url
                      ? 'border-[#18181B] bg-[#18181B] text-white'
                      : 'border-black/10 bg-white text-[#52525B] hover:text-[#18181B]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Text */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B73]">
              3. Mensaje y enlace
            </label>
            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                Título principal *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Festival de Anillos de Compromiso"
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                Texto secundario / Promoción
              </label>
              <textarea
                rows={2}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Describe el beneficio o colección destacada..."
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Texto del botón
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Categoría al hacer clic
                </label>
                <select
                  value={linkedCategory}
                  onChange={(e) =>
                    setLinkedCategory(e.target.value as ProductCategory | '')
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm cursor-pointer"
                >
                  <option value="">Todo el catálogo</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 4: Placement & Automatic Schedule */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B6B73]">
              4. Ubicación y vigencia automática
            </label>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                Ubicación en la página
              </label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as BannerPlacement)}
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm cursor-pointer"
              >
                {PLACEMENT_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Fecha de inicio *
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Fecha de fin *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/12 bg-[#FAF9F7] text-sm font-mono-tabular"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[#991B1B]" role="alert">
              {error}
            </p>
          )}
          {feedback && (
            <p className="text-xs text-[#166534] font-medium">{feedback}</p>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowFullPreview(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/12 text-xs font-medium text-[#18181B] hover:bg-[#FAF9F7] cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Vista previa ampliada</span>
            </button>

            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-[#18181B] text-white text-sm font-medium hover:bg-[#2E2E33] disabled:opacity-60 cursor-pointer"
            >
              {saving
                ? 'Publicando...'
                : editingId
                ? 'Actualizar campaña'
                : 'Publicar campaña'}
            </button>
          </div>
        </form>

        {/* Live Preview Panel */}
        <div className="xl:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B6B73]">
              Vista previa en vivo
            </span>
            <span className="text-xs text-[#52525B]">
              Estado calculado:{' '}
              <strong className="text-[#18181B]">
                {getBannerScheduleState({ active, startDate, endDate })}
              </strong>
            </span>
          </div>

          {placement === 'promo-strip' ? (
            <div className="bg-white rounded-2xl border border-black/8 p-5 space-y-3">
              <p className="text-xs text-[#6B6B73]">
                Así lucirá en la franja superior de la tienda:
              </p>
              <div className="bg-[#18181B] text-[#FAF9F7] h-9 px-4 rounded-lg flex items-center justify-center text-xs font-medium">
                {title || 'Texto de franja promocional'}
              </div>
            </div>
          ) : (
            <BannerPreview
              compact
              banner={{
                title,
                subtitle,
                ctaText,
                imageUrl,
                template,
                linkedCategory,
              }}
            />
          )}
        </div>
      </div>

      {/* Scheduled & Published Banners Table */}
      <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
        <div className="px-6 py-4 border-b border-black/8 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#18181B]">
            Campañas registradas ({banners.length})
          </h3>
          <span className="text-xs text-[#6B6B73]">
            Activación automática por fecha vigente ({formatShortDate(today)})
          </span>
        </div>

        <div className="divide-y divide-black/6">
          {banners.map((b) => {
            const scheduleState = getBannerScheduleState(b, today);
            const stateColor =
              scheduleState === 'Vigente'
                ? 'text-[#166534]'
                : scheduleState === 'Programada'
                ? 'text-[#8C6D2E]'
                : scheduleState === 'Expirada'
                ? 'text-[#71717A]'
                : 'text-[#991B1B]';

            const placementLabel =
              PLACEMENT_OPTIONS.find((p) => p.id === b.placement)?.label || b.placement;

            return (
              <div
                key={b.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F7] transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-[#F4F1EC] border border-black/8 shrink-0">
                    <JewelryImage
                      src={b.imageUrl}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`font-semibold ${stateColor}`}>{scheduleState}</span>
                      <span aria-hidden="true" className="text-black/25">
                        ·
                      </span>
                      <span className="text-[#6B6B73] truncate">{placementLabel}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#18181B] truncate mt-0.5">
                      {b.title}
                    </p>
                    <p className="text-xs text-[#6B6B73] inline-flex items-center gap-1 mt-0.5 font-mono-tabular">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {formatShortDate(b.startDate)} – {formatShortDate(b.endDate)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadBannerIntoEditor(b)}
                    className="px-3 py-1.5 rounded-lg border border-black/12 text-xs font-medium text-[#18181B] hover:bg-white cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(b)}
                    title={b.active ? 'Pausar campaña' : 'Reactivar campaña'}
                    className="p-2 rounded-lg border border-black/12 text-[#3F3F46] hover:bg-white cursor-pointer"
                  >
                    {b.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteBanner(b.id)}
                    aria-label="Eliminar campaña"
                    className="p-2 rounded-lg border border-black/12 text-[#991B1B] hover:bg-[#FEF2F2] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {showFullPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-6xl bg-[#FAF9F7] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#18181B]">
                Vista previa a tamaño completo
              </h3>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="px-4 py-1.5 rounded-lg bg-[#18181B] text-white text-xs font-medium cursor-pointer"
              >
                Cerrar vista previa
              </button>
            </div>
            <BannerPreview
              banner={{
                title,
                subtitle,
                ctaText,
                imageUrl,
                template,
                linkedCategory,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
