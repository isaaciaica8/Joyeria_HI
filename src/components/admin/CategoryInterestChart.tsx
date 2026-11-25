import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import type {
  Lead,
  Product,
  ProductCategory,
  ProductViewEvent,
} from '../../types';
import { PRODUCT_CATEGORIES } from '../../utils/formatters';

interface CategoryInterestChartProps {
  products: Product[];
  leads: Lead[];
  productViews: ProductViewEvent[];
}

type TimeRange = '7d' | '30d' | '6m';
type MetricMode = 'all' | 'views' | 'leads';

interface ChartBucket {
  key: string;
  label: string;
  fullLabel: string;
  Anillos: number;
  Collares: number;
  Aretes: number;
  Pulseras: number;
  Relojes: number;
}

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

const CATEGORY_COLORS: Record<ProductCategory, string> = {
  Anillos: '#8C6D2E',
  Collares: '#18181B',
  Aretes: '#0F766E',
  Pulseras: '#3B82F6',
  Relojes: '#B45309',
};

const RANGE_OPTIONS: { id: TimeRange; label: string }[] = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '6m', label: '6 meses' },
];

const METRIC_OPTIONS: { id: MetricMode; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'views', label: 'Consultas' },
  { id: 'leads', label: 'Clientes' },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function resolveCategoryFromLead(
  lead: Lead,
  categoryById: Map<string, ProductCategory>,
  categoryByName: Map<string, ProductCategory>
): ProductCategory | null {
  if (lead.productId) {
    const byId = categoryById.get(lead.productId);
    if (byId) return byId;
  }

  const normalizedName = normalizeText(lead.productName || '');
  if (!normalizedName) return null;

  const exactMatch = categoryByName.get(normalizedName);
  if (exactMatch) return exactMatch;

  for (const [prodName, category] of categoryByName.entries()) {
    if (normalizedName.includes(prodName)) {
      return category;
    }
  }

  if (normalizedName.includes('anillo')) return 'Anillos';
  if (normalizedName.includes('collar')) return 'Collares';
  if (normalizedName.includes('arete')) return 'Aretes';
  if (normalizedName.includes('pulsera')) return 'Pulseras';
  if (normalizedName.includes('reloj')) return 'Relojes';

  return null;
}

function CustomInterestTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const firstPayload = payload[0] as TooltipEntry & { payload?: ChartBucket };
  const heading = firstPayload?.payload?.fullLabel || '';
  const visibleEntries = payload.filter((entry) => Number(entry.value || 0) > 0);
  const total = visibleEntries.reduce((sum, entry) => sum + Number(entry.value || 0), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md px-3.5 py-2.5 text-xs min-w-[180px]">
      <div className="flex items-center justify-between gap-4 pb-1.5 mb-1.5 border-b border-slate-100">
        <span className="font-semibold text-slate-900 capitalize">{heading}</span>
        <span className="font-mono-tabular font-semibold text-[#8C6D2E]">
          {total} {total === 1 ? 'evento' : 'eventos'}
        </span>
      </div>
      {visibleEntries.length === 0 ? (
        <p className="text-slate-400">Sin registros en este período</p>
      ) : (
        <div className="space-y-1">
          {visibleEntries.map((entry) => (
            <div key={entry.dataKey || entry.name} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-slate-700">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-mono-tabular font-medium text-slate-900">
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryInterestChart({
  products,
  leads,
  productViews,
}: CategoryInterestChartProps) {
  const [range, setRange] = useState<TimeRange>('30d');
  const [metric, setMetric] = useState<MetricMode>('all');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null);

  const { chartData, categoryTotals, totalEvents, unmatchedLeadsCount } = useMemo(() => {
    const categoryById = new Map<string, ProductCategory>();
    const categoryByName = new Map<string, ProductCategory>();

    products.forEach((p) => {
      categoryById.set(p.id, p.category);
      categoryByName.set(normalizeText(p.name), p.category);
    });

    const buckets: ChartBucket[] = [];
    const bucketMap = new Map<string, ChartBucket>();
    const now = new Date();

    if (range === '6m') {
      const shortMonthFmt = new Intl.DateTimeFormat('es-MX', {
        month: 'short',
        year: '2-digit',
      });
      const fullMonthFmt = new Intl.DateTimeFormat('es-MX', {
        month: 'long',
        year: 'numeric',
      });

      for (let i = 5; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = toLocalMonthKey(d);
        const bucket: ChartBucket = {
          key,
          label: shortMonthFmt.format(d).replace('.', ''),
          fullLabel: fullMonthFmt.format(d),
          Anillos: 0,
          Collares: 0,
          Aretes: 0,
          Pulseras: 0,
          Relojes: 0,
        };
        buckets.push(bucket);
        bucketMap.set(key, bucket);
      }
    } else {
      const days = range === '7d' ? 7 : 30;
      const shortDayFmt = new Intl.DateTimeFormat('es-MX', {
        day: 'numeric',
        month: 'short',
      });
      const fullDayFmt = new Intl.DateTimeFormat('es-MX', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });

      for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = toLocalDayKey(d);
        const bucket: ChartBucket = {
          key,
          label: shortDayFmt.format(d).replace('.', ''),
          fullLabel: fullDayFmt.format(d),
          Anillos: 0,
          Collares: 0,
          Aretes: 0,
          Pulseras: 0,
          Relojes: 0,
        };
        buckets.push(bucket);
        bucketMap.set(key, bucket);
      }
    }

    const totals: Record<ProductCategory, number> = {
      Anillos: 0,
      Collares: 0,
      Aretes: 0,
      Pulseras: 0,
      Relojes: 0,
    };

    const getBucketKey = (isoDate: string): string | null => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return null;
      return range === '6m' ? toLocalMonthKey(parsed) : toLocalDayKey(parsed);
    };

    if (metric === 'all' || metric === 'views') {
      productViews.forEach((view) => {
        const category = categoryById.get(view.productId);
        if (!category) return;
        const key = getBucketKey(view.createdAt);
        if (!key) return;
        const bucket = bucketMap.get(key);
        if (!bucket) return;
        bucket[category] += 1;
        totals[category] += 1;
      });
    }

    let unmatchedLeads = 0;
    if (metric === 'all' || metric === 'leads') {
      leads.forEach((lead) => {
        const key = getBucketKey(lead.createdAt);
        if (!key) return;
        const bucket = bucketMap.get(key);
        if (!bucket) return;
        const category = resolveCategoryFromLead(lead, categoryById, categoryByName);
        if (!category) {
          unmatchedLeads += 1;
          return;
        }
        bucket[category] += 1;
        totals[category] += 1;
      });
    }

    const totalSum = PRODUCT_CATEGORIES.reduce<number>(
      (acc, cat) => acc + totals[cat],
      0
    );

    return {
      chartData: buckets,
      categoryTotals: totals,
      totalEvents: totalSum,
      unmatchedLeadsCount: unmatchedLeads,
    };
  }, [products, leads, productViews, range, metric]);

  const visibleCategories = useMemo<readonly ProductCategory[]>(
    () => (selectedCategory ? [selectedCategory] : PRODUCT_CATEGORIES),
    [selectedCategory]
  );

  const visibleTotal = useMemo(
    () =>
      visibleCategories.reduce<number>(
        (sum, cat) => sum + categoryTotals[cat],
        0
      ),
    [visibleCategories, categoryTotals]
  );

  return (
    <section
      aria-label="Volumen de interés por categoría a lo largo del tiempo"
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900">
              Volumen de interés por categoría
            </h2>
            <span className="font-mono-tabular text-xs font-semibold text-[#8C6D2E]">
              {visibleTotal} {visibleTotal === 1 ? 'interacción' : 'interacciones'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Evolución temporal de consultas en fichas de producto y registros de clientes interesados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Filter */}
          <div
            role="group"
            aria-label="Filtrar tipo de interés"
            className="inline-flex items-center p-1 rounded-lg bg-slate-100"
          >
            {METRIC_OPTIONS.map((opt) => {
              const active = metric === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMetric(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Time Range Filter */}
          <div
            role="group"
            aria-label="Seleccionar período de tiempo"
            className="inline-flex items-center p-1 rounded-lg bg-slate-100"
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = range === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRange(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      {totalEvents === 0 ? (
        <div className="h-[280px] sm:h-[310px] rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center px-6">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-[#8C6D2E]" />
          </div>
          <p className="text-sm font-medium text-slate-900">
            Sin actividad fechada en este período
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Cuando los visitantes consulten fichas de joyería o envíen solicitudes de interés,
            su volumen por categoría se graficará aquí en tiempo real.
          </p>
        </div>
      ) : (
        <div className="h-[280px] sm:h-[310px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E2E8F0"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                minTickGap={18}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip
                content={<CustomInterestTooltip />}
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
              />
              {visibleCategories.map((cat, index) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  stackId="interest"
                  fill={CATEGORY_COLORS[cat]}
                  maxBarSize={36}
                  radius={
                    index === visibleCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Interactive Category Summary Footer */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRODUCT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const isDimmed = selectedCategory !== null && !isSelected;
            return (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setSelectedCategory((prev) => (prev === cat ? null : cat))
                }
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#18181B] bg-slate-50 text-slate-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                } ${isDimmed ? 'opacity-50' : ''}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                <span>{cat}</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {categoryTotals[cat]}
                </span>
              </button>
            );
          })}
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-medium text-[#8C6D2E] hover:underline px-1.5 cursor-pointer"
            >
              Ver todas
            </button>
          )}
        </div>

        {unmatchedLeadsCount > 0 && (
          <p className="text-[11px] text-slate-400 tabular-nums">
            + {unmatchedLeadsCount}{' '}
            {unmatchedLeadsCount === 1
              ? 'consulta general sin categoría asignada'
              : 'consultas generales sin categoría asignada'}
          </p>
        )}
      </div>
    </section>
  );
}
