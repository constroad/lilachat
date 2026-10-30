import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceDriveWeb } from './ServiceDriveWeb';

/** Pending 121 (design f-06): the service's Drive, asked when it opens. */
afterEach(() => vi.unstubAllGlobals());
const service = { id: 'srv-318', name: 'Pavimentación Av. Los Álamos' };
const reply = (body: object) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const file = (name: string, folder?: string) => ({ name, mime: name.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf', url: `https://lila.constroad.com/f/${name}`, ...(folder ? { folder } : {}) });

describe('ServiceDriveWeb', () => {
  it('asks for the service files and shows folders with counts, recents and the Drive link', async () => {
    // Arrange
    const fetchMock = reply({ files: [file('densidades.pdf', 'Informes'), file('t1.jpg', 'Fotos de obra / Día 1'), file('t2.jpg', 'Fotos de obra / Día 2')], drive_url: 'https://drive.google.com/drive/folders/x' });
    vi.stubGlobal('fetch', fetchMock);
    // Act
    render(<ServiceDriveWeb jwt="jwt" spaceId="s1" clientId="cli-cvs" service={service} onClose={() => undefined} />);
    // Assert
    expect((await screen.findByTestId('carpeta-Fotos de obra')).textContent).toContain('2');
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain('/api/workspaces/s1/clients/cli-cvs/services/srv-318/files');
    expect(screen.getByText('Abrir en Google Drive').closest('a')?.getAttribute('href')).toBe('https://drive.google.com/drive/folders/x');
    fireEvent.click(screen.getByTestId('carpeta-Fotos de obra'));
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('t1.jpg'), expect.stringContaining('t2.jpg')]);
  });

  it('search finds by name across folders', async () => {
    vi.stubGlobal('fetch', reply({ files: [file('densidades.pdf', 'Informes'), file('plano-perfil.pdf', 'Planos')], drive_url: null }));
    render(<ServiceDriveWeb jwt="jwt" spaceId="s1" clientId="cli-cvs" service={service} onClose={() => undefined} />);
    fireEvent.change(await screen.findByTestId('buscar-drive'), { target: { value: 'perfil' } });
    expect(screen.getAllByTestId('archivo-drive').map((one) => one.textContent)).toEqual([expect.stringContaining('plano-perfil.pdf')]);
  });

  it('when the app fails it says so and offers the service link', async () => {
    vi.stubGlobal('fetch', reply({ error: 'drive_failed', message: 'No se pudo traer el Drive', drive_url: 'https://portal.example.com/s/318' }));
    render(<ServiceDriveWeb jwt="jwt" spaceId="s1" clientId="cli-cvs" service={service} onClose={() => undefined} />);
    expect((await screen.findByTestId('drive-fallo')).textContent).toContain('No se pudo traer el Drive');
    expect(screen.getByText('Abrir el servicio en el Portal').closest('a')?.getAttribute('href')).toBe('https://portal.example.com/s/318');
  });
});
