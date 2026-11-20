import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DriveFileMenu } from './DriveFileMenu';
import { FloatingNotice } from '../../ui/FloatingNotice';

/** José 19/11, design cc-05 mobile: on a phone the file's menu is a sheet from the bottom. */
const photo = { id: 'f1', name: 'parche-12-antes.jpg', mime: 'image/jpeg', url: 'https://drive.example/f1', folder: 'Fotos de obra', sizeBytes: 1_887_437 };
const asPhone = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

describe('DriveFileMenu on a phone', () => {
  it('opens the sheet with the file\'s name, «carpeta · tamaño» and the actions of the design', () => {
    // Arrange
    asPhone();
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(async () => undefined) });
    render(<DriveFileMenu file={photo} onOpen={vi.fn()} onNotice={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    // Assert
    const sheet = screen.getByTestId('hoja-archivo-drive');
    expect(sheet).toHaveTextContent('parche-12-antes.jpg');
    expect(sheet).toHaveTextContent('Fotos de obra · 1.8 MB');
    expect(sheet).toHaveTextContent('Vincula esta foto al reporte fotográfico');
    expect(screen.queryByTestId('archivo-drive-menu')).toBeNull();
    expect(screen.getByTestId('archivo-drive-share')).toHaveTextContent('Compartir');
  });

  it('«Compartir» opens the phone\'s share sheet with the file\'s link and closes the sheet', () => {
    // Arrange
    asPhone();
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, share });
    render(<DriveFileMenu file={photo} onOpen={vi.fn()} onNotice={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    fireEvent.click(screen.getByTestId('archivo-drive-share'));
    // Assert
    expect(share).toHaveBeenCalledWith({ title: 'parche-12-antes.jpg', url: 'https://drive.example/f1' });
    expect(screen.queryByTestId('hoja-archivo-drive')).toBeNull();
  });

  it('✕ closes the sheet without doing anything', () => {
    asPhone();
    const onOpen = vi.fn();
    render(<DriveFileMenu file={photo} onOpen={onOpen} onNotice={vi.fn()} />);
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    fireEvent.click(screen.getByTestId('archivo-drive-cerrar'));
    expect(screen.queryByTestId('hoja-archivo-drive')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('«Medios» reads «Ver en el chat»', () => {
    asPhone();
    render(<DriveFileMenu file={photo} openLabel="Ver en el chat" onOpen={vi.fn()} onNotice={vi.fn()} />);
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    expect(screen.getByTestId('archivo-drive-open')).toHaveTextContent('Ver en el chat');
  });
});

describe('DriveFileMenu on a computer', () => {
  it('keeps the floating menu, without «Compartir» where the browser has no share sheet', () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined });
    render(<DriveFileMenu file={photo} onOpen={vi.fn()} onNotice={vi.fn()} />);
    fireEvent.click(screen.getByTestId('archivo-drive-mas'));
    expect(screen.getByTestId('archivo-drive-menu')).toBeInTheDocument();
    expect(screen.queryByTestId('hoja-archivo-drive')).toBeNull();
    expect(screen.queryByTestId('archivo-drive-share')).toBeNull();
  });
});

describe('FloatingNotice', () => {
  it('«Enlace copiado» floats with its check; nothing without text', () => {
    const { rerender, container } = render(<FloatingNotice text="Enlace copiado" done />);
    expect(screen.getByRole('status')).toHaveTextContent('Enlace copiado');
    expect(container.querySelector('svg')).not.toBeNull();
    rerender(<FloatingNotice text="" done />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
