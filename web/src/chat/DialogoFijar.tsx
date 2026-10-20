import { useState } from 'react';
import { ETIQUETAS_DE_DURACION, type DuracionDeFijado } from '@lilachat/shared';
import { Overlay, PrimaryButton } from '../ui/Overlay';

const OPCIONES: DuracionDeFijado[] = ['24h', '7d', '30d'];

/** «¿Por cuánto tiempo?» al fijar (19/10). Abre en 7 días, como WhatsApp. */
export function DialogoFijar(props: { onFijar: (duracion: DuracionDeFijado) => void; onCerrar: () => void }) {
  const [elegida, setElegida] = useState<DuracionDeFijado>('7d');
  return (
    <Overlay
      title="¿Por cuánto tiempo?"
      onClose={props.onCerrar}
      footer={
        <PrimaryButton testId="btn-confirmar-fijar" onClick={() => props.onFijar(elegida)}>
          Fijar
        </PrimaryButton>
      }
    >
      <p className="text-sm text-on-surface-variant">Se ve arriba del chat para todos. Puedes desfijarlo cuando quieras.</p>
      <div role="radiogroup" className="mt-3">
        {OPCIONES.map((opcion) => (
          <label key={opcion} className={`-mx-4 flex min-h-[48px] cursor-pointer items-center justify-between px-4 text-sm ${opcion === elegida ? 'bg-primary/5' : ''}`}>
            {ETIQUETAS_DE_DURACION[opcion]}
            <input type="radio" name="duracion" data-testid={`duracion-${opcion}`} checked={opcion === elegida} onChange={() => setElegida(opcion)} className="h-4 w-4 accent-primary" />
          </label>
        ))}
      </div>
    </Overlay>
  );
}
