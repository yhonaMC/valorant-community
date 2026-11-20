// Icono de error (triángulo de aviso). El error siempre va con icono y texto (§5.2).
export function ErrorIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d="M10 2 19 18H1L10 2Z" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M10 8v4.5M10 14.5v1.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
