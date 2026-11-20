// Iconos SVG en línea, un mismo trazo. Acompañan siempre a un texto (§5.2, §6).
export function ErrorIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="M10 2 19 18H1L10 2Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M10 8v4.5M10 14.5v1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="m4 10.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
