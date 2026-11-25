import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'store' | 'admin';
  showLabel?: boolean;
}

export function ThemeToggle({
  variant = 'store',
  showLabel = false,
}: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  const shortText = isDark ? 'Claro' : 'Oscuro';

  const variantClasses =
    variant === 'admin'
      ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
      : 'border-black/15 dark:border-white/15 bg-white dark:bg-[#18181D] text-[#18181B] dark:text-[#F5F3EE] hover:bg-[#F4F1EC] dark:hover:bg-[#23232A]';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
        showLabel ? 'px-3 py-2 text-xs font-medium' : 'w-9 h-9'
      } ${variantClasses}`}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#DFC58B]" />
      ) : (
        <Moon className="w-4 h-4 text-[#8C6D2E]" />
      )}
      {showLabel && <span>{shortText}</span>}
    </button>
  );
}
