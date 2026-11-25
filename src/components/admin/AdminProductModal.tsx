import { useRef, useState } from 'react';
import { ImagePlus, Star, Trash2, Upload, X } from 'lucide-react';
import type { Product, ProductCategory, ProductMaterial } from '../../types';
import { uploadAdminImageWithFirebaseAuth } from '../../services/firestoreStore';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_MATERIALS,
  formatCurrencyMXN,
  getFinalPrice,
} from '../../utils/formatters';
import { JewelryImage } from '../JewelryImage';

interface AdminProductModalProps {
  initialProduct?: Product | null;
  onSave: (payload: Partial<Product>) => Promise<void>;
  onClose: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function AdminProductModal({
  initialProduct,
  onSave,
  onClose,
}: AdminProductModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialProduct?.name || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [category, setCategory] = useState<ProductCategory>(
    initialProduct?.category || 'Anillos'
  );
  const [material, setMaterial] = useState<ProductMaterial>(
    initialProduct?.material || 'Oro Amarillo'
  );
  const [karat, setKarat] = useState(initialProduct?.karat || '18k');
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : '');
  const [discountPercent, setDiscountPercent] = useState(
    initialProduct ? String(initialProduct.discountPercent) : '0'
  );
  const [description, setDescription] = useState(initialProduct?.description || '');
  const [available, setAvailable] = useState(
    initialProduct ? initialProduct.available : true
  );
  const [featured, setFeatured] = useState(initialProduct?.featured || false);
  const [images, setImages] = useState<string[]>(initialProduct?.images || []);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function processFiles(files: FileList | File[]) {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) {
      setError('Selecciona archivos de imagen válidos (JPG, PNG o WebP).');
      return;
    }

    setError('');
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of fileArray) {
        const dataUrl = await readFileAsDataUrl(file);
        const res = await uploadAdminImageWithFirebaseAuth(dataUrl);
        uploadedUrls.push(res.url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir una o más fotos.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  }

  function setPrimaryImage(index: number) {
    setImages((prev) => {
      const target = prev[index];
      if (!target) return prev;
      return [target, ...prev.filter((_, i) => i !== index)];
    });
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const numPrice = Number(price);
    const numDiscount = Number(discountPercent) || 0;
    if (!name.trim() || !Number.isFinite(numPrice) || numPrice <= 0) {
      setError('Ingresa un nombre válido y un precio mayor a 0.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        sku: sku.trim(),
        name: name.trim(),
        category,
        material,
        karat: karat.trim() || '18k',
        price: numPrice,
        discountPercent: numDiscount,
        description: description.trim(),
        available,
        featured,
        images,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  }

  const previewFinalPrice = getFinalPrice(Number(price) || 0, Number(discountPercent) || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/75 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border border-black/10 dark:border-slate-800 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/8 dark:border-slate-800 shrink-0">
          <h2 className="text-lg font-semibold text-[#18181B] dark:text-slate-100">
            {initialProduct ? `Editar pieza · ${initialProduct.name}` : 'Nueva pieza en catálogo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-2 rounded-lg text-[#52525B] dark:text-slate-400 hover:bg-black/5 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Nombre de la joya *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Anillo Solitario Diamante 18k"
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                SKU (opcional)
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Automático"
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 font-mono-tabular placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 cursor-pointer"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Material *
              </label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value as ProductMaterial)}
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40 cursor-pointer"
              >
                {PRODUCT_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Quilataje / Ley *
              </label>
              <input
                type="text"
                required
                value={karat}
                onChange={(e) => setKarat(e.target.value)}
                placeholder="Ej. 18k, 14k, 925"
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Precio lista (MXN) *
              </label>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25000"
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
                Descuento (%)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                step={1}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
              />
            </div>

            <div className="rounded-xl bg-[#FAF9F7] dark:bg-slate-950 border border-black/8 dark:border-slate-800 px-3.5 py-2">
              <p className="text-[11px] text-[#6B6B73] dark:text-slate-400">
                Precio final al público
              </p>
              <p className="font-mono-tabular text-base font-semibold text-[#18181B] dark:text-slate-100">
                {formatCurrencyMXN(previewFinalPrice)} MXN
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300 mb-1">
              Descripción
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe detalles de diseño, piedras, medidas y acabados..."
              className="w-full px-3.5 py-2 rounded-xl border border-black/12 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 text-sm text-[#18181B] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8C6D2E]/40"
            />
          </div>

          {/* Drag & Drop Multi-photo uploader */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[#3F3F46] dark:text-slate-300">
              Fotografías del producto (arrastra y suelta varias fotos)
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-[#8C6D2E] bg-[#8C6D2E]/8 dark:border-[#DFC58B]'
                  : 'border-black/15 dark:border-slate-700 bg-[#FAF9F7] dark:bg-slate-950 hover:border-black/30 dark:hover:border-slate-500'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void processFiles(e.target.files);
                }}
              />
              <Upload className="w-6 h-6 text-[#8C6D2E] dark:text-[#DFC58B] mx-auto mb-2" />
              <p className="text-sm font-medium text-[#18181B] dark:text-slate-100">
                {uploading
                  ? 'Subiendo imágenes...'
                  : 'Arrastra tus fotos aquí o haz clic para seleccionar'}
              </p>
              <p className="text-xs text-[#6B6B73] dark:text-slate-400 mt-1">
                Formatos JPG, PNG o WebP · Máximo 5 MB por fotografía
              </p>
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative group rounded-xl overflow-hidden border border-black/10 dark:border-slate-700 bg-[#F4F1EC] dark:bg-slate-800 aspect-[4/3]"
                  >
                    <JewelryImage
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/75 to-transparent flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(idx)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          idx === 0
                            ? 'bg-[#C5A059] text-[#111113]'
                            : 'bg-white/90 text-[#18181B] hover:bg-white'
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        <span>{idx === 0 ? 'Principal' : 'Portada'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        aria-label="Eliminar foto"
                        className="p-1 rounded bg-white/90 text-[#991B1B] hover:bg-white cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {images.length === 0 && (
              <p className="inline-flex items-center gap-1.5 text-xs text-[#6B6B73] dark:text-slate-400">
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Si no subes fotos, se asignará una imagen de referencia de Joyería HI.</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="inline-flex items-center gap-2 text-sm text-[#18181B] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setAvailable(e.target.checked)}
                className="w-4 h-4 accent-[#8C6D2E] rounded"
              />
              <span>Disponible en tienda</span>
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-[#18181B] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#8C6D2E] rounded"
              />
              <span>Destacar en catálogo</span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-[#991B1B] dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="pt-4 border-t border-black/8 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-black/12 dark:border-slate-700 text-sm font-medium text-[#3F3F46] dark:text-slate-300 hover:bg-[#FAF9F7] dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-5 py-2.5 rounded-xl bg-[#18181B] dark:bg-[#C5A059] text-white dark:text-[#111113] text-sm font-medium hover:bg-[#2E2E33] dark:hover:bg-[#D4B372] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Guardando...' : initialProduct ? 'Guardar cambios' : 'Publicar pieza'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
