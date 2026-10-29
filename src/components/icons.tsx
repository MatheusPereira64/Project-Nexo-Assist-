type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function Mark({ className }: IconProps) {
  return (
    <div className={className ? `mark ${className}` : "mark"} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M5.2 19V5h3.2l7.2 8.6V5H18.8v14h-3.2l-7.2-8.6V19H5.2Z" />
      </svg>
    </div>
  );
}

export function IconAtendimento(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
      <path d="M21 12a8.5 8.5 0 0 1-8.5 8.5c-1.3 0-2.5-.3-3.6-.8L4 21l1.2-4.2A8.5 8.5 0 1 1 21 12Z" />
    </Svg>
  );
}

export function IconPerfil(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.2a6.5 6.5 0 0 1 13 0" />
    </Svg>
  );
}

export function IconSair(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 7V5.8A1.8 1.8 0 0 1 11.8 4h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17" />
      <path d="M4 12h10" />
      <path d="M11.5 8.5 15 12l-3.5 3.5" />
    </Svg>
  );
}
