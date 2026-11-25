import { ArrowRight } from 'lucide-react';
import type { AdBanner, ProductCategory } from '../types';
import { JewelryImage } from './JewelryImage';

interface BannerPreviewProps {
  banner: Pick<
    AdBanner,
    'title' | 'subtitle' | 'ctaText' | 'imageUrl' | 'template' | 'linkedCategory'
  >;
  onAction?: (category?: ProductCategory | '') => void;
  compact?: boolean;
}

export function BannerPreview({ banner, onAction, compact = false }: BannerPreviewProps) {
  const isNoir = banner.template === 'obsidian-noir';
  const isAlabaster = banner.template === 'alabaster-minimal';

  const scrimClass = isNoir
    ? 'bg-gradient-to-r from-[#111113]/90 via-[#111113]/65 to-[#111113]/20'
    : isAlabaster
    ? 'bg-gradient-to-r from-[#FAF9F7]/95 via-[#FAF9F7]/80 to-[#FAF9F7]/15'
    : 'bg-gradient-to-r from-[#1A1611]/85 via-[#261F15]/55 to-transparent';

  const titleColor = isAlabaster ? 'text-[#18181B]' : 'text-[#FAF9F7]';
  const subtitleColor = isAlabaster ? 'text-[#52525B]' : 'text-[#E8E2D7]';
  const kickerColor = isAlabaster ? 'text-[#8C6D2E]' : 'text-[#DFC58B]';
  const ctaClass = isAlabaster
    ? 'bg-[#18181B] text-[#FAF9F7] hover:bg-[#2E2E33]'
    : isNoir
    ? 'bg-[#C5A059] text-[#111113] hover:bg-[#D4B372]'
    : 'bg-[#FAF9F7] text-[#18181B] hover:bg-[#EFECE6]';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 ${
        compact ? 'min-h-[260px]' : 'min-h-[380px] sm:min-h-[460px] lg:min-h-[520px]'
      }`}
    >
      <JewelryImage
        src={banner.imageUrl}
        alt={banner.title}
        fallbackLabel={banner.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className={`absolute inset-0 ${scrimClass}`} />

      <div
        className={`relative z-10 flex flex-col justify-center h-full ${
          compact
            ? 'p-6 sm:p-8 max-w-lg min-h-[260px]'
            : 'px-6 py-12 sm:px-12 lg:px-16 max-w-2xl min-h-[380px] sm:min-h-[460px] lg:min-h-[520px]'
        }`}
      >
        <p className={`text-xs font-medium tracking-widest uppercase mb-3 ${kickerColor}`}>
          Joyería HI {banner.linkedCategory ? `· ${banner.linkedCategory}` : ''}
        </p>

        <h2
          className={`font-display font-semibold tracking-tight leading-[1.08] [text-wrap:balance] ${titleColor} ${
            compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl lg:text-[3.5rem]'
          }`}
        >
          {banner.title || 'Título de campaña'}
        </h2>

        <p
          className={`mt-3 leading-relaxed max-w-lg ${subtitleColor} ${
            compact ? 'text-sm' : 'text-base sm:text-lg'
          }`}
        >
          {banner.subtitle || 'Describe los detalles o vigencia de esta promoción.'}
        </p>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => onAction?.(banner.linkedCategory)}
            className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8C6D2E] ${ctaClass}`}
          >
            <span>{banner.ctaText || 'Ver colección'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
