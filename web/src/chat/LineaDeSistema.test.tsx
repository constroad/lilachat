import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Familia', memberIds: ['yo', 'ana'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const aviso = (senderId: string): MensajeEnPantalla => ({ chatId: 'c1', seq: 4, senderId, clientKey: 'sis-fijo-4', kind: 'system', body: '902049935 fijó un mensaje', system: { evento: 'fijo', valor: '3', quien: { phone: '902049935' } }, at: new Date().toISOString() });

function dibujar(mensaje: MensajeEnPantalla) {
  renderWith(mensaje);
}

function renderWith(message: MensajeEnPantalla, extra: Partial<ContextoDeLaConversacion> = {}) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana'], ['yo', 'Tú']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), ...extra };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={message} mio={false} agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
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

/** José, 21/10: «aparece el recordatorio pero no puedo reaccionar o responder o enviar sticker». */
describe('the reminder that rang takes the actions of a message', () => {
  const reminder: MensajeEnPantalla = { chatId: 'c1', seq: 9, senderId: 'yo', clientKey: 'sis-rec-9', kind: 'system', body: '⏰ Recordatorio: Llamar a Wilson', system: { evento: 'recordatorio-suena', valor: 'Llamar a Wilson' }, at: new Date().toISOString(), reacciones: [{ userId: 'ana', emoji: '👍' }] };

  it('react, reply in a thread and the menu, with its reactions under it', () => {
    renderWith(reminder, { onReaccionar: vi.fn(), onAbrirHilo: vi.fn() });
    expect(screen.getByTestId('reaccionar-sis-rec-9')).toBeInTheDocument();
    expect(screen.getByTestId('hilo-sis-rec-9')).toBeInTheDocument();
    expect(screen.getByTestId('menu-sis-rec-9')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-destacado-9')).toHaveTextContent('👍');
  });

  it('a grey notice keeps none of them', () => {
    renderWith(aviso('ana'), { onReaccionar: vi.fn(), onAbrirHilo: vi.fn() });
    expect(screen.queryByTestId('reaccionar-sis-fijo-4')).toBeNull();
    expect(screen.queryByTestId('menu-sis-fijo-4')).toBeNull();
  });
});
