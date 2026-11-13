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
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    // Assert
    expect((await screen.findByTestId('carpeta-Fotos de obra')).textContent).toContain('2');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/files');
    expect(screen.getByText('Abrir en Google Drive').closest('a')?.getAttribute('href')).toBe('https://drive.google.com/drive/folders/x');
    fireEvent.click(screen.getByTestId('carpeta-Fotos de obra'));
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('t1.jpg'), expect.stringContaining('t2.jpg')]);
  });

  it('search finds by name across folders', async () => {
    vi.stubGlobal('fetch', reply({ files: [file('densidades.pdf', 'Informes'), file('plano-perfil.pdf', 'Planos')], drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    fireEvent.change(await screen.findByTestId('buscar-drive'), { target: { value: 'perfil' } });
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('plano-perfil.pdf')]);
  });

  it('when the app fails it says so and offers the service link', async () => {
    vi.stubGlobal('fetch', reply({ error: 'drive_failed', message: 'No se pudo traer el Drive', drive_url: 'https://portal.example.com/s/318' }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    expect((await screen.findByTestId('drive-fallo')).textContent).toContain('No se pudo traer el Drive');
    expect(screen.getByText('Abrir el servicio en el Portal').closest('a')?.getAttribute('href')).toBe('https://portal.example.com/s/318');
  });

  it('the file line reads folder · day, and inside a folder the crumb goes back to the Drive', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ files: [{ ...file('densidades.pdf', 'Informes'), modifiedAt: '2026-10-21T15:00:00.000Z' }], drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    expect((await screen.findAllByTestId('archivo-drive'))[0]).toHaveTextContent('Informes · 21 oct');
    expect(screen.queryByTestId('volver-a-drive')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('carpeta-Informes'));
    fireEvent.click(screen.getByTestId('volver-a-drive'));
    // Assert
    expect(await screen.findByTestId('carpeta-Informes')).toBeInTheDocument();
    expect(screen.queryByTestId('volver-a-drive')).toBeNull();
  });
});

describe('sending a file to the service Drive (José 06/11)', () => {
  const ticket = { url: 'https://constroad.com/api/public/service-drive-upload/t1', method: 'POST', fields: {}, fileField: 'file', expiresAt: '2026-11-06T23:00:00.000Z', maxBytes: 52428800, maxSeconds: 60, mimeTypes: ['image/jpeg', 'video/mp4'] };
  const outcome = (body: object) => ({ commandId: 'c1', appId: 'p', appName: 'Portal', ...body });
  const open = (upload = { status: 201 }, stored: object = { mediaId: 'm1', url: 'https://x/y.jpg' }) => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body });
      if (url.endsWith('/files')) return new Response(JSON.stringify({ files: [file('densidades.pdf')], drive_url: null }), { status: 200 });
      if (url.endsWith('/reports/forms')) return new Response(JSON.stringify(outcome({ outcome: 'form', response: { responseType: 'form', form: { id: 'subir_al_drive', title: 'x', schema: { type: 'object', properties: {} } } } })), { status: 200 });
      if (url.endsWith('/commands/c1/form')) return new Response(JSON.stringify(outcome({ outcome: 'ephemeral', response: { responseType: 'ephemeral', text: 'Ya', upload: ticket } })), { status: 200 });
      return new Response(JSON.stringify(stored), upload);
    }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
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

  it('any other refusal is told in Portal’s words', async () => {
    // Arrange
    open({ status: 404 }, { message: 'Ese servicio ya no existe.' });
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('archivo-para-drive'), { target: { files: [picked] } });
    // Assert
    expect(await screen.findByText('Ese servicio ya no existe.')).toBeInTheDocument();
  });

  it('a PDF the browser left without a type goes from «Documento» as application/pdf when Portal takes documents (Jeremy, 13/11)', async () => {
    // Arrange
    ticket.mimeTypes = [...ticket.mimeTypes, 'application/pdf'];
    const calls = open();
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('documento-para-drive'), { target: { files: [new File(['%PDF'], 'Acta de entrega.pdf', { type: '' })] } });
    // Assert
    expect(await screen.findByText('Archivo subido al Drive.')).toBeInTheDocument();
    const sent = (calls.find((call) => call.url === ticket.url)!.body as FormData).get('file') as File;
    expect(sent.name).toBe('Acta de entrega.pdf');
    expect(sent.type).toBe('application/pdf');
    ticket.mimeTypes = ticket.mimeTypes.filter((one) => one !== 'application/pdf');
  });

  it('a file that is not a photo or a video stays here', async () => {
    // Arrange
    const calls = open();
    await screen.findByTestId('subir-al-drive');
    // Act
    fireEvent.change(screen.getByTestId('archivo-para-drive'), { target: { files: [new File(['x'], 'nota.pdf', { type: 'application/pdf' })] } });
    // Assert
    expect(await screen.findByText('Ese tipo de archivo no se puede subir al Drive.')).toBeInTheDocument();
    expect(calls.some((call) => call.url === ticket.url)).toBe(false);
  });
});


describe('marking a Drive photo «antes» or «después» (José 08/11, Portal 2ef27173)', () => {
  const outcome = (body: object) => ({ commandId: 'c9', appId: 'p', appName: 'Portal', ...body });
  const photo = { ...file('fresado.jpg', 'Fotos de obra'), id: 'f-1' };

  it('the viewer shows the mark and sends the new phase with its stretch through the channel\'s door', async () => {
    // Arrange
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body });
      if (url.endsWith('/files')) return new Response(JSON.stringify({ files: [photo], drive_url: null }), { status: 200 });
      if (url.endsWith('/reports/forms')) return new Response(JSON.stringify(outcome({ outcome: 'form', response: { responseType: 'form', form: { id: 'marcar_foto_antes_despues', title: 'x', schema: { type: 'object', properties: {} } } } })), { status: 200 });
      return new Response(JSON.stringify(outcome({ outcome: 'done', response: { responseType: 'text', text: '' } })), { status: 200 });
    }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" marks={[{ photoId: 'f-1', phase: 'antes', stretch: 'Cdra 1' }]} />);
    fireEvent.click(await screen.findByTestId('carpeta-Fotos de obra'));
    // Act
    fireEvent.click(screen.getByTestId('archivo-drive'));
    // Assert
    expect(await screen.findByTestId('foto-fase')).toHaveTextContent('Antes · Cdra 1');
    fireEvent.click(screen.getByTestId('foto-fase-despues'));
    fireEvent.change(screen.getByTestId('foto-fase-tramo'), { target: { value: 'Cdra 1' } });
    fireEvent.click(screen.getByTestId('foto-fase-guardar'));
    expect(await screen.findByText('Foto marcada.')).toBeInTheDocument();
    const opened = calls.find((call) => call.url.endsWith('/reports/forms'))!;
    expect(JSON.parse(String(opened.body))).toMatchObject({ kind: 'photo_phase', photo_id: 'f-1', phase: 'despues', stretch: 'Cdra 1' });
    expect(screen.getByTestId('foto-fase')).toHaveTextContent('Después · Cdra 1');
  });

  it('a file Portal sent without its id cannot be marked', async () => {
    vi.stubGlobal('fetch', reply({ files: [file('sin-id.jpg', 'Fotos de obra')], drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" marks={[]} />);
    fireEvent.click(await screen.findByTestId('carpeta-Fotos de obra'));
    fireEvent.click(screen.getByTestId('archivo-drive'));
    expect(await screen.findByTestId('visor-foto')).toBeInTheDocument();
    expect(screen.queryByTestId('foto-fase')).toBeNull();
  });
});

describe('one «Subir», list or grid, and the chips (José 13/11, designs drv-01/02/03)', () => {
  afterEach(() => localStorage.clear());
  const files = [
    { ...file('t1.jpg', 'Fotos de obra'), modifiedAt: '2026-11-13T15:00:00.000Z' },
    { ...file('acta.pdf'), modifiedAt: '2026-11-12T15:00:00.000Z' },
  ];

  it('with a camera (a webcam too) the camera is one tap away beside «Subir», and the menu offers it as well', async () => {
    // Arrange
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal('fetch', reply({ files, drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    // Act
    fireEvent.click(await screen.findByTestId('subir-al-drive'));
    // Assert
    expect(screen.getByTestId('drive-camara')).toHaveAccessibleName('Abrir la cámara');
    expect(screen.getByTestId('drive-foto')).toHaveTextContent('Tomar foto');
    expect(screen.getByTestId('drive-video')).toHaveTextContent('Grabar video');
  });

  it('a single «Subir» opens the menu; on a computer it offers the files of the equipment and documents', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ files, drive_url: null }));
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    // Act
    fireEvent.click(await screen.findByTestId('subir-al-drive'));
    // Assert
    expect(screen.getByTestId('menu-subir-drive')).toBeInTheDocument();
    expect(screen.getByTestId('drive-galeria')).toHaveTextContent('Fotos y videos del equipo');
    expect(screen.getByTestId('drive-documento')).toHaveTextContent('PDF, Word, Excel o PowerPoint');
    expect(screen.queryByTestId('drive-foto')).toBeNull();
  });

  it('the grid groups by day and is remembered; the chip «Documentos» leaves only the PDF', async () => {
    // Arrange
    vi.stubGlobal('fetch', reply({ files, drive_url: null }));
    const { unmount } = render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    // Act
    fireEvent.click(await screen.findByTestId('drive-vista-cuadricula'));
    // Assert
    expect(screen.getByTestId('drive-cuadricula')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('drive-tipo-document'));
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('acta.pdf')]);
    unmount();
    render(<ServiceDriveWeb target={target} service={service} chatId="chat-1" />);
    expect(await screen.findByTestId('drive-cuadricula')).toBeInTheDocument();
  });
});
