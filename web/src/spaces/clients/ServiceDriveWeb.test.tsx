import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceDriveWeb } from './ServiceDriveWeb';

/** Pending 121 (design f-06): the service's Drive, asked when it opens. */
afterEach(() => vi.unstubAllGlobals());
const service = { id: 'srv-318', name: 'Pavimentación Av. Los Álamos', status: 'in_progress' as const, stage_label: '' };
const target = { jwt: 'jwt', spaceId: 's1', clientId: 'cli-cvs' };
const reply = (body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const file = (name: string, folder?: string) => ({ name, mime: name.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf', url: `https://lila.constroad.com/f/${name}`, ...(folder ? { folder } : {}) });

describe('ServiceDriveWeb', () => {
  it('asks for the service files and shows folders with counts, recents and the Drive link', async () => {
    // Arrange
    const fetchMock = reply({ files: [file('densidades.pdf', 'Informes'), file('t1.jpg', 'Fotos de obra / Día 1'), file('t2.jpg', 'Fotos de obra / Día 2')], drive_url: 'https://drive.google.com/drive/folders/x' });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" onBack={() => undefined} />);
    // Assert
    expect((await screen.findByTestId('carpeta-Fotos de obra')).textContent).toContain('2');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/files');
    expect(screen.getByText('Abrir en Google Drive').closest('a')?.getAttribute('href')).toBe('https://drive.google.com/drive/folders/x');
    fireEvent.click(screen.getByTestId('carpeta-Fotos de obra'));
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('t1.jpg'), expect.stringContaining('t2.jpg')]);
  });

  it('search finds by name across folders', async () => {
    vi.stubGlobal('fetch', reply({ files: [file('densidades.pdf', 'Informes'), file('plano-perfil.pdf', 'Planos')], drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" onBack={() => undefined} />);
    fireEvent.change(await screen.findByTestId('buscar-drive'), { target: { value: 'perfil' } });
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('plano-perfil.pdf')]);
  });

  it('when the app fails it says so and offers the service link', async () => {
    vi.stubGlobal('fetch', reply({ error: 'drive_failed', message: 'No se pudo traer el Drive', drive_url: 'https://portal.example.com/s/318' }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" onBack={() => undefined} />);
    expect((await screen.findByTestId('drive-fallo')).textContent).toContain('No se pudo traer el Drive');
    expect(screen.getByText('Abrir el servicio en el Portal').closest('a')?.getAttribute('href')).toBe('https://portal.example.com/s/318');
  });

  it('the file line reads folder · day, and the crumb goes back', async () => {
    const onBack = vi.fn();
    vi.stubGlobal('fetch', reply({ files: [{ ...file('densidades.pdf', 'Informes'), modifiedAt: '2026-10-21T15:00:00.000Z' }], drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" onBack={onBack} />);
    expect((await screen.findAllByTestId('archivo-drive'))[0]).toHaveTextContent('Informes · 21 oct');
    fireEvent.click(screen.getByTestId('volver-a-drive'));
    expect(onBack).toHaveBeenCalled();
  });
});

describe('sending a file to the service Drive (José 06/11)', () => {
  const ticket = { url: 'https://constroad.com/api/public/service-drive-upload/t1', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-06T23:00:00.000Z', maxBytes: 52428800, maxSeconds: 60, mimeTypes: ['image/jpeg', 'video/mp4'] };
  const outcome = (body: object) => ({ commandId: 'c1', appId: 'p', appName: 'Portal', ...body });
  const open = (upload = { status: 201 }) => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body });
      if (url.endsWith('/files')) return new Response(JSON.stringify({ files: [file('densidades.pdf')], drive_url: null }), { status: 200 });
      if (url.endsWith('/reports/forms')) return new Response(JSON.stringify(outcome({ outcome: 'form', response: { responseType: 'form', form: { id: 'subir_al_drive', title: 'x', schema: { type: 'object', properties: {} } } } })), { status: 200 });
      if (url.endsWith('/commands/c1/form')) return new Response(JSON.stringify(outcome({ outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Ya', upload: ticket } })), { status: 200 });
      return new Response(JSON.stringify({ mediaId: 'm1', url: 'https://x/y.jpg' }), upload);
    }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" onBack={() => undefined} />);
    return calls;
  };
  const picked = new File(['x'], 'obra.jpg', { type: 'image/jpeg' });

  it('asks the ticket, sends the file straight to Portal and reads the Drive again', async () => {
    // Arrange
    const calls = open();
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('archivo-para-drive'), { target: { files: [picked] } });
    // Assert
    expect(await screen.findByText('Archivo subido al Drive.')).toBeInTheDocument();
    const sent = calls.find((call) => call.url === ticket.url)!.body as FormData;
    expect((sent.get('file') as File).name).toBe('obra.jpg');
    expect(sent.get('clientUploadId')).toBeTruthy();
    await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/files'))).toHaveLength(2));
  });

  it('says why Portal did not take it, and the Drive is not asked again', async () => {
    // Arrange
    const calls = open({ status: 413 });
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('archivo-para-drive'), { target: { files: [picked] } });
    // Assert
    expect(await screen.findByText('El archivo pesa demasiado.')).toBeInTheDocument();
    expect(calls.filter((call) => call.url.endsWith('/files'))).toHaveLength(1);
  });

  it('a file that is not a photo or a video stays here', async () => {
    // Arrange
    const calls = open();
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('archivo-para-drive'), { target: { files: [new File(['x'], 'nota.pdf', { type: 'application/pdf' })] } });
    // Assert
    expect(await screen.findByText('Solo se admiten fotos y videos.')).toBeInTheDocument();
    expect(calls.some((call) => call.url === ticket.url)).toBe(false);
  });
});

