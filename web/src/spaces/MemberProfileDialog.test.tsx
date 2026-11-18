import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ClientWorkspace, ClientWorkspaceMember } from '@lilachat/shared';
import { MemberProfileDialog } from './MemberProfileDialog';

const space = { id: 'w1', name: 'Constroad', joinCode: 'CONS-7K3P' } as ClientWorkspace;
const LONG_AREA = 'Supervisión de obras de pavimentación urbana y mantenimiento vial';
const LONG_NAME = 'María Fernanda de los Ángeles Quispe Huamán Villanueva';
const LONG_CHANNEL = 'imprimacion-asfaltica-condominio-los-alamos-santa-clara';
const member: ClientWorkspaceMember = { id: 'm1', userId: 'u1', name: LONG_NAME, phone: '51902049935', role: 'member', status: 'active', title: 'Ingeniera residente', area: LONG_AREA, joinedAt: '2026-11-01T00:00:00.000Z' };

const show = () => render(<MemberProfileDialog space={space} member={member} isMe={false} online={false} commonChannels={[LONG_CHANNEL]} onMessage={vi.fn()} onClose={vi.fn()} />);

afterEach(cleanup);

/**
 * At 390 px (a phone) the card is as wide as the screen; a long value cannot push it wider (jsdom has no layout:
 * these are the classes that let each piece shrink and wrap, checked by eye at 390 px in the browser).
 */
describe('MemberProfileDialog at a phone width', () => {
  it('lets a long value wrap inside its row instead of pushing the card wider', () => {
    show();
    const value = screen.getByText(LONG_AREA);
    expect(value.className).toMatch(/\bmin-w-0\b/);
    expect(value.className).toMatch(/\bbreak-words\b/);
    expect(value.parentElement!.className).toMatch(/\bmin-w-0\b/);
  });

  it('keeps the label, the icon and the copy button whole', () => {
    show();
    expect(screen.getByText('Área').className).toMatch(/\bshrink-0\b/);
    expect(screen.getByTestId('perfil-copiar-telefono').className).toMatch(/\bshrink-0\b/);
  });

  it('wraps a long name, a long role line and a long channel', () => {
    show();
    expect(screen.getByRole('heading', { name: LONG_NAME }).className).toMatch(/\bbreak-words\b/);
    expect(screen.getByText(`Ingeniera residente · ${LONG_AREA}`).className).toMatch(/\bbreak-words\b/);
    const channel = screen.getByText(LONG_CHANNEL);
    expect(channel.className).toMatch(/\bbreak-all\b|\bbreak-words\b/);
  });
});
