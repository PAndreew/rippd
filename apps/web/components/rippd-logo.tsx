import type { SVGProps } from 'react';

export function RippdWordmark({ textClassName = 'sm:text-5xl sm:tracking-[-0.04em]', textColor = 'text-white' }: { textClassName?: string; textColor?: string }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <RippdLogo className="h-9 w-auto text-[--brand-logo] sm:h-10" />
      <span className={`display-font text-4xl font-black uppercase tracking-[-0.01em] ${textColor} ${textClassName}`}>
        rippd
      </span>
    </div>
  );
}

export function RippdLogo({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 11.39931 8.47184"
      aria-hidden="true"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M1.26969 0 0 8.47184h6.47248l-2.69803-2.69803 2.89698-2.88458h.0129l.0253-.0253L3.833 0zm4.48449 0 2.87631 2.86391-2.73214 2.73213h-.0243l-.1788.17777 2.69803 2.69803h1.60921L11.39931 0z"
        fill="currentColor"
        fillOpacity="0.9"
      />
    </svg>
  );
}
