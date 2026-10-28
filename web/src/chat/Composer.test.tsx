import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer } from './Composer';
import type { ContextoDelComposer } from './Composer';

const ANA = { id: 'u-ana', nombre: 'Ana' };
const EDITING: ContextoDelComposer = { tipo: 'edicion', titulo: 'Editando', texto: 'mensaje viejo', clave: 'k1' };

type ComposerProps = Partial<Parameters<typeof Composer>[0]> & { chatId: string };

const composer = ({ chatId, ...rest }: ComposerProps, onSend = vi.fn()) => (
  <Composer chatId={chatId} onSend={onSend} onCreateEvent={() => undefined} onCreatePoll={() => undefined} onElegirArchivos={() => undefined} {...rest} />
);

const field = () => screen.getByTestId('input-mensaje') as HTMLTextAreaElement;

describe('Composer: the text is per chat (José, 25/10)', () => {
  beforeEach(() => localStorage.clear());

  it('the field is empty in a chat without a draft, and each chat gets its own text back', async () => {
    const user = userEvent.setup();
    const { rerender } = render(composer({ chatId: 'general' }));
    await user.type(field(), 'hola equipo');

    rerender(composer({ chatId: 'administracion' }));
    expect(field().value).toBe('');
    await user.type(field(), 'factura pendiente');

    rerender(composer({ chatId: 'general' }));
    expect(field().value).toBe('hola equipo');
    rerender(composer({ chatId: 'administracion' }));
    expect(field().value).toBe('factura pendiente');
  });

  it('the draft survives reopening the page: it is saved as it is typed', async () => {
    const user = userEvent.setup();
    const first = render(composer({ chatId: 'general' }));
    await user.type(field(), 'sin enviar');
    first.unmount();

    render(composer({ chatId: 'general' }));
    expect(field().value).toBe('sin enviar');
  });

  it('sending clears the draft', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const first = render(composer({ chatId: 'general' }, onSend));
    await user.type(field(), 'listo{Enter}');
    expect(onSend).toHaveBeenCalledWith('listo', undefined);
    expect(field().value).toBe('');
    first.unmount();

    render(composer({ chatId: 'general' }));
    expect(field().value).toBe('');
  });

  it('blank text is not a draft', async () => {
    const user = userEvent.setup();
    const first = render(composer({ chatId: 'general' }));
    await user.type(field(), '   ');
    first.unmount();
    expect(localStorage.length).toBe(0);
  });

  it('the «@» of one channel does not open the field of the next one', async () => {
    const user = userEvent.setup();
    const { rerender } = render(composer({ chatId: 'general', mencionables: [ANA] }));
    await user.type(field(), '@');
    expect(screen.getByTestId('sugerencias-mencion')).toBeInTheDocument();

    rerender(composer({ chatId: 'administracion', mencionables: [ANA] }));
    expect(field().value).toBe('');
    expect(screen.queryByTestId('sugerencias-mencion')).not.toBeInTheDocument();
  });

  it('a mention chosen in one chat is not sent as a mention in the next', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const { rerender } = render(composer({ chatId: 'general', mencionables: [ANA] }, onSend));
    await user.type(field(), '@An{Enter}');
    expect(field().value).toBe('@Ana ');

    rerender(composer({ chatId: 'administracion', mencionables: [ANA] }, onSend));
    fireEvent.change(field(), { target: { value: '@Ana hola' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('@Ana hola', undefined);
  });

  it('in the same chat the chosen mention does travel', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(composer({ chatId: 'general', mencionables: [ANA] }, onSend));
    await user.type(field(), '@An{Enter}hola{Enter}');
    expect(onSend).toHaveBeenCalledWith('@Ana hola', [{ userId: 'u-ana', desde: 0, largo: 4 }]);
  });

  it('the text of a message being edited is not saved as a draft', async () => {
    const user = userEvent.setup();
    const first = render(composer({ chatId: 'general' }));
    await user.type(field(), 'borrador');
    first.rerender(composer({ chatId: 'general', contexto: EDITING }));
    expect(field().value).toBe('mensaje viejo');
    first.unmount();

    render(composer({ chatId: 'general' }));
    expect(field().value).toBe('borrador');
  });
});
