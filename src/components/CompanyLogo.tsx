import React from 'react';

interface CompanyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  textClassName?: string;
  subtextClassName?: string;
  variant?: 'light' | 'dark' | 'auto';
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  className = '',
  size = 'md',
  showText = false,
  textClassName = '',
  subtextClassName = '',
}) => {
  const sizeClasses = {
    sm: 'h-7 w-auto',
    md: 'h-9 w-auto',
    lg: 'h-12 w-auto',
    xl: 'h-16 w-auto'
  };

  const imageClass = className || sizeClasses[size];

  return (
    <div className="inline-flex items-center gap-2.5">
      <div className="relative shrink-0 flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Viña Construcciones & Estructuras SpA"
          referrerPolicy="no-referrer"
          className={`${imageClass} object-contain max-w-full rounded-md drop-shadow-2xs`}
          onError={(e) => {
            // Fallback SVG if image load fails
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        {/* SVG Fallback */}
        <div className="hidden items-center justify-center bg-sky-500 text-white rounded-lg p-1.5 shadow-sm">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="min-w-0 flex flex-col justify-center">
          <span className={`font-black tracking-tight uppercase leading-none text-slate-900 dark:text-white ${textClassName || 'text-xs sm:text-sm'}`}>
            Viña Construcciones
          </span>
          <span className={`text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight mt-0.5 ${subtextClassName}`}>
            & Estructuras SpA
          </span>
        </div>
      )}
    </div>
  );
};

export default CompanyLogo;
