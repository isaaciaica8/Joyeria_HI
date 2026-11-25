import { useState } from 'react';
import { Gem } from 'lucide-react';
import { sanitizeImageUrl } from '../utils/formatters';

interface JewelryImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function JewelryImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
}: JewelryImageProps) {
  const [failed, setFailed] = useState(false);
  const safeSrc = sanitizeImageUrl(src || '');

  if (!safeSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#F4F1EC] via-[#EAE4DA] to-[#DFD7C8] text-[#6E6454] p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Gem className="w-8 h-8 mb-2 stroke-[1.25] text-[#8C6D2E]" />
        <span className="font-display text-base font-medium tracking-tight text-[#3E372C] line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
