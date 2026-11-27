import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ClientWorkspace } from '@lilachat/shared';
import { CameraLogoRow } from './CameraLogoRow';

vi.mock('../chat/shrinkPhoto', () => ({ shrinkPhotoBlob: async (file: File, name: string) => ({ blob: file, name }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const space = { id: '6a87c797c709c4a21aba3aff', name: 'Constroad', logoUrl: 'https://x/round.png', joinPolicy: 'open', role: 'owner', status: 'active' } as unknown as ClientWorkspace;

/** José 27/11: the round avatar in the app, the square logo on the camera's photos. */
describe('CameraLogoRow', () => {
  it('uploads the camera logo to its own address and shows it', async () => {
    // Arrange
    const saved = { ...space, cameraLogoUrl: 'https://x/square.png' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ workspace: saved }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const onSaved = vi.fn();
    render(<CameraLogoRow space={space} jwt="jwt" onSaved={onSaved} onError={vi.fn()} />);
    expect(screen.queryByTestId('ajustes-quitar-logo-camara')).toBeNull();
    // Act
    fireEvent.change(screen.getByTestId('ajustes-logo-camara-archivo'), { target: { files: [new File(['png'], 'sello.png', { type: 'image/png' })] } });
    // Assert
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(`/api/workspaces/${space.id}/camera-logo`);
    expect((screen.getByTestId('ajustes-logo-camara-vista') as HTMLImageElement).src).toBe('https://x/square.png');
    expect(screen.getByTestId('ajustes-quitar-logo-camara')).toBeTruthy();
  });
});
