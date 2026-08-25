import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateEventOverlay, CreatePollOverlay, NewChatOverlay } from './CreatePanels';

/**
 * Crear cosas DESDE LA WEB.
 *
 * Existe por el reporte de José sobre lilachat.constroad.com: «desde la web no
 * hay forma de crear chats grupos eventos encuestas ni nada». Era cierto —todo
 * eso vivía solo en la app— y estos tests fijan que la web ahora llega al mismo
 * endpoint, con el mismo cuerpo, que el que ya usaba el teléfono.
 *
 * Lo que se verifica es el REQUEST, no el dibujo: un formulario lindo que manda
 * un cuerpo que el server rechaza es exactamente el bug que se está evitando.
 */
const contactos = {
  groups: [
    {
      letter: 'M',
      contacts: [
        { id: 'u2', name: 'Mamá', phone: '999111222' },
        { id: 'u3', name: 'Martín', phone: '999333444' },
      ],
    },
  ],
};

let llamadas: { url: string; body: unknown }[] = [];

beforeEach(() => {
  llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      llamadas.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.includes('/contacts')) {
        return new Response(JSON.stringify(contactos), { status: 200 });
      }
      if (url.includes('/chats')) {
        return new Response(JSON.stringify({ chatId: 'c-nuevo' }), { status: 201 });
      }
      return new Response(JSON.stringify({ id: 'x1' }), { status: 201 });
    })
  );
});

const cuerpoDe = (parte: string) => llamadas.find((llamada) => llamada.url.includes(parte))?.body;

describe('NewChatOverlay', () => {
  it('un contacto elegido crea el chat directo y lo abre', async () => {
    const alCrear = vi.fn();
    render(<NewChatOverlay jwt="j" kind="direct" onClose={() => {}} onCreated={alCrear} />);

    await userEvent.click(await screen.findByTestId('contacto-u2'));
    await userEvent.click(screen.getByTestId('btn-crear-chat'));

    await waitFor(() => expect(alCrear).toHaveBeenCalledWith('c-nuevo'));
    expect(cuerpoDe('/chats')).toEqual({ kind: 'direct', memberIds: ['u2'] });
  });

  /**
   * El server rechaza un grupo sin nombre con un 400. Cortarlo acá evita que la
   * persona elija a todos y recién ahí se entere.
   */
  it('un grupo sin nombre no se manda', async () => {
    render(<NewChatOverlay jwt="j" kind="group" onClose={() => {}} onCreated={() => {}} />);

    await userEvent.click(await screen.findByTestId('contacto-u2'));
    await userEvent.click(screen.getByTestId('contacto-u3'));
    await userEvent.click(screen.getByTestId('btn-crear-chat'));

    expect(screen.getByTestId('error-formulario')).toHaveTextContent('nombre');
    expect(cuerpoDe('/chats')).toBeUndefined();
  });

  it('con nombre y varios contactos, crea el grupo', async () => {
    render(<NewChatOverlay jwt="j" kind="group" onClose={() => {}} onCreated={() => {}} />);

    await userEvent.type(screen.getByTestId('nombre-grupo'), 'Familia');
    await userEvent.click(await screen.findByTestId('contacto-u2'));
    await userEvent.click(screen.getByTestId('contacto-u3'));
    await userEvent.click(screen.getByTestId('btn-crear-chat'));

    await waitFor(() =>
      expect(cuerpoDe('/chats')).toEqual({
        kind: 'group',
        memberIds: ['u2', 'u3'],
        name: 'Familia',
      })
    );
  });
});

describe('CreateEventOverlay', () => {
  /**
   * La queja original: el evento pedía CONVERSACIONES. Ahora se eligen personas
   * y la conversación se crea sola —con una, el chat 1:1—.
   */
  it('elegir un contacto crea el chat y cuelga el evento de ahí', async () => {
    render(<CreateEventOverlay jwt="j" onClose={() => {}} onCreated={() => {}} />);

    await userEvent.type(screen.getByTestId('titulo-evento'), 'Almuerzo');
    await userEvent.click(await screen.findByTestId('contacto-u2'));
    await userEvent.click(screen.getByTestId('btn-crear-evento'));

    await waitFor(() => expect(cuerpoDe('/agenda/events')).toBeDefined());
    expect(cuerpoDe('/chats')).toEqual({ kind: 'direct', memberIds: ['u2'] });
    expect(cuerpoDe('/agenda/events')).toMatchObject({ chatId: 'c-nuevo', title: 'Almuerzo' });
  });

  /**
   * Abierto desde adentro de un chat (el «+» del composer): no se crea ninguna
   * conversación ni se pregunta por invitados.
   */
  it('desde un chat abierto usa ese chat y no toca /chats', async () => {
    render(
      <CreateEventOverlay
        jwt="j"
        chat={{ id: 'c-abierto', name: 'Familia' }}
        onClose={() => {}}
        onCreated={() => {}}
      />
    );

    await userEvent.type(screen.getByTestId('titulo-evento'), 'Almuerzo');
    await userEvent.click(screen.getByTestId('btn-crear-evento'));

    await waitFor(() =>
      expect(cuerpoDe('/agenda/events')).toMatchObject({ chatId: 'c-abierto' })
    );
    expect(llamadas.some((llamada) => llamada.url.endsWith('/api/chats'))).toBe(false);
  });

  it('sin título no se manda nada', async () => {
    render(<CreateEventOverlay jwt="j" chat={{ id: 'c1' }} onClose={() => {}} onCreated={() => {}} />);

    await userEvent.click(screen.getByTestId('btn-crear-evento'));

    expect(screen.getByTestId('error-formulario')).toHaveTextContent('nombre');
    expect(cuerpoDe('/agenda/events')).toBeUndefined();
  });
});

describe('CreatePollOverlay', () => {
  it('manda pregunta y opciones al chat abierto', async () => {
    render(
      <CreatePollOverlay jwt="j" chat={{ id: 'c1' }} onClose={() => {}} onCreated={() => {}} />
    );

    await userEvent.type(screen.getByTestId('pregunta-encuesta'), '¿Dónde comemos?');
    await userEvent.type(screen.getByTestId('opcion-0'), 'Casa');
    await userEvent.type(screen.getByTestId('opcion-1'), 'Afuera');
    await userEvent.click(screen.getByTestId('btn-crear-encuesta'));

    await waitFor(() =>
      expect(cuerpoDe('/agenda/polls')).toMatchObject({
        chatId: 'c1',
        question: '¿Dónde comemos?',
        options: ['Casa', 'Afuera'],
      })
    );
  });

  /** La validación es la MISMA que corre el server (`validatePoll`). */
  it('una sola opción no pasa', async () => {
    render(
      <CreatePollOverlay jwt="j" chat={{ id: 'c1' }} onClose={() => {}} onCreated={() => {}} />
    );

    await userEvent.type(screen.getByTestId('pregunta-encuesta'), '¿Dónde?');
    await userEvent.type(screen.getByTestId('opcion-0'), 'Casa');
    await userEvent.click(screen.getByTestId('btn-crear-encuesta'));

    expect(screen.getByTestId('error-formulario')).toBeInTheDocument();
    expect(cuerpoDe('/agenda/polls')).toBeUndefined();
  });
});
