import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Familia', memberIds: ['yo', 'ana'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const aviso = (senderId: string): MensajeEnPantalla => ({ chatId: 'c1', seq: 4, senderId, clientKey: 'sis-fijo-4', kind: 'system', body: '902049935 fijó un mensaje', system: { evento: 'fijo', valor: '3', quien: { phone: '902049935' } }, at: new Date().toISOString() });

function dibujar(mensaje: MensajeEnPantalla) {
  const contexto: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana'], ['yo', 'Tú']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
  render(
    <ConversacionContext.Provider value={contexto}>
      <BurbujaDeMensaje mensaje={mensaje} mio={false} agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
}

describe('la línea de aviso en la web', () => {
  it('si lo hice yo, en segunda persona (no el teléfono que mandó el server)', () => {
    dibujar(aviso('yo'));
    expect(screen.getByText('Fijaste un mensaje')).toBeInTheDocument();
  });

  it('si lo hizo otro, con el nombre que ve esta persona', () => {
    dibujar(aviso('ana'));
    expect(screen.getByText('Ana fijó un mensaje')).toBeInTheDocument();
  });
});

describe('el recordatorio que suena, en la web (20/10)', () => {
  it('se dibuja como tarjeta destacada, sin el emoji del texto', () => {
    dibujar({ chatId: 'c1', seq: 9, senderId: 'ana', clientKey: 'sis-rec-9', kind: 'system', body: '⏰ Recordatorio: Llamar al laboratorio', system: { evento: 'recordatorio-suena', valor: 'Llamar al laboratorio' }, at: new Date().toISOString() });
    expect(screen.getByTestId('aviso-destacado-9')).toHaveTextContent('Recordatorio: Llamar al laboratorio');
    expect(screen.getByTestId('aviso-destacado-9').textContent).not.toContain('⏰');
  });
});
