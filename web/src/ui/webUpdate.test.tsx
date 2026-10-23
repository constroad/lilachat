import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { NewVersionBand } from './NewVersionBand';
import { __resetWebUpdate, markWorkerWaiting } from './webUpdate';

const activate = vi.fn();
vi.mock('../pwa/serviceWorker', () => ({ activarVersionNueva: () => activate() }));

describe('NewVersionBand (pending 61)', () => {
  afterEach(() => {
    __resetWebUpdate();
    activate.mockReset();
  });

  it('is hidden while nothing new is waiting', () => {
    // Act
    render(<NewVersionBand />);
    // Assert
    expect(screen.queryByTestId('banda-version-nueva')).toBeNull();
  });

  it('a waiting service worker shows ONE band, and «Recargar» activates it and says it is updating', () => {
    // Arrange
    render(<NewVersionBand />);
    act(() => markWorkerWaiting());
    // Act
    fireEvent.click(screen.getByTestId('btn-recargar-version'));
    // Assert
    expect(screen.getAllByTestId('banda-version-nueva')).toHaveLength(1);
    expect(activate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('btn-recargar-version').textContent).toBe('Actualizando…');
    expect((screen.getByTestId('btn-recargar-version') as HTMLButtonElement).disabled).toBe(true);
  });

  it('a second click while updating does nothing more', () => {
    // Arrange
    render(<NewVersionBand />);
    act(() => markWorkerWaiting());
    // Act
    fireEvent.click(screen.getByTestId('btn-recargar-version'));
    fireEvent.click(screen.getByTestId('btn-recargar-version'));
    // Assert
    expect(activate).toHaveBeenCalledTimes(1);
  });
});
