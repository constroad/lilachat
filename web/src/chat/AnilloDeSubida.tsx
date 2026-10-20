import { anilloDeSubidaWeb } from './progresoDeSubida';

/** El anillo y su fondo (px). */
const DIAMETRO = 44;
const GROSOR = 3;
const RADIO = (DIAMETRO - GROSOR) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Encima de la foto que sube (auditoría 19/10), como WhatsApp Web: la foto se
 * ve nítida y el anillo dice cuánto falta; gira mientras no hay medida o el
 * server procesa. Blanco sobre la foto, en los dos temas.
 */
export function AnilloDeSubida({ razon }: { razon?: number }) {
  const { fraccion, girando } = anilloDeSubidaWeb(razon);
  return (
    <span data-testid="anillo-de-subida" role="progressbar" aria-label="Enviando" aria-valuenow={girando ? undefined : Math.round(fraccion * 100)} className="absolute inset-0 grid place-items-center">
      <span className="grid place-items-center rounded-full bg-black/45" style={{ width: DIAMETRO, height: DIAMETRO }}>
        <svg width={DIAMETRO} height={DIAMETRO} className={girando ? 'animate-spin' : '-rotate-90'}>
          <circle cx={DIAMETRO / 2} cy={DIAMETRO / 2} r={RADIO} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={GROSOR} />
          <circle
            cx={DIAMETRO / 2}
            cy={DIAMETRO / 2}
            r={RADIO}
            fill="none"
            stroke="white"
            strokeWidth={GROSOR}
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={CIRCUNFERENCIA * (1 - (girando ? 0.25 : fraccion))}
          />
        </svg>
      </span>
    </span>
  );
}
