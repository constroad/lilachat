import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** José 17/11: a KML sent to a chat opened as text in another tab and could not be downloaded. */
const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['yo', 'ana'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const URL_KML = 'https://lilachat.constroad.com/media/apps/lilachat/6ade7935c6013f4b0dbc8f86/file-2026-11-17T22-27-19-653Z_b4ee483b3d179be4.kml';

function draw(fileName: string) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), flat: false };
  const message: MensajeEnPantalla = { chatId: 'c1', seq: 7, senderId: 'ana', clientKey: 'k7', kind: 'text', at: new Date().toISOString(), media: { url: URL_KML, mime: 'application/octet-stream', fileName } };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={message} mio={false} agrupado={false} ultimoDelGrupo conAutor chat={chat} flat={false} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
}

describe('a file in a message', () => {
  it('downloads with the name it was sent with, not the storage name', () => {
    // Act
    draw('METRADOS 161126.kml');
    // Assert
    const link = screen.getByTestId('archivo-k7');
    expect(link.getAttribute('href')).toBe(`${URL_KML}?download=METRADOS%20161126.kml`);
    expect(link.getAttribute('download')).toBe('METRADOS 161126.kml');
    expect(link.textContent).toContain('METRADOS 161126.kml');
  });

  it('shows and saves an escaped name decoded', () => {
    // Act
    draw('Planilla%20de%20avance.xlsx');
    // Assert
    expect(screen.getByTestId('archivo-k7').getAttribute('download')).toBe('Planilla de avance.xlsx');
  });
});
