/** Lo que se ve mientras la tarjeta carga, si falló o si ya no está (W3c). */
export function TarjetaCargando() {
  return <div className="h-32 animate-pulse rounded-xl bg-background" />;
}

export function TarjetaQueNoEsta({ texto }: { texto: string }) {
  return <p className="px-1 text-[13px] italic text-on-surface-variant">{texto}</p>;
}

export function TarjetaConFallo({ texto, onReintentar }: { texto: string; onReintentar: () => void }) {
  return (
    <button type="button" onClick={onReintentar} className="min-h-[44px] w-full rounded-xl border border-outline/15 bg-surface px-4 text-left text-[13px] text-on-surface-variant">
      {texto} Clic para reintentar.
    </button>
  );
}
