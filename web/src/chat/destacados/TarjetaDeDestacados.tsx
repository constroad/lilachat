import { useState } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import { ListaDeDestacados } from './ListaDeDestacados';

/** «Mensajes destacados» en la info del chat (20/10): cuántos, y la lista de ese chat. */
export function TarjetaDeDestacados(props: { chatId: string; jwt: string; yo: string; cuantos: number; onIr: (seq: number) => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button type="button" data-testid="tarjeta-destacados" onClick={() => setAbierta(true)} className="mx-4 mt-3 flex min-h-[52px] w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-surface px-4 text-left hover:bg-surface/80">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
          <Star size={16} />
        </span>
        <span className="flex-1 text-sm">Mensajes destacados</span>
        <span className="text-sm text-on-surface-variant">{props.cuantos}</span>
        <ChevronRight size={16} className="text-on-surface-variant" />
      </button>
      {abierta ? <ListaDeDestacados jwt={props.jwt} yo={props.yo} chatId={props.chatId} onIr={(destacado) => props.onIr(destacado.seq)} onCerrar={() => setAbierta(false)} /> : null}
    </>
  );
}
