import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WelcomePane } from './WelcomePane';

/** Pending 5 (design e-01): the first screen of a new account on the web. */
vi.mock('./spacesApi', () => ({ previewSpace: vi.fn(async () => ({ ok: true, status: 200, data: { id: 's1', name: 'CONSTROAD', members: 48, joinPolicy: 'approval' } })) }));

afterEach(cleanup);

describe('WelcomePane', () => {
  it('offers personal, joining and creating; each card calls its own path', () => {
    // Arrange
    const on = { onPersonal: vi.fn(), onJoin: vi.fn(), onCreate: vi.fn() };
    render(<WelcomePane jwt="jwt" detectedCode={null} {...on} />);
    // Act
    fireEvent.click(screen.getByTestId('bienvenida-personal'));
    fireEvent.click(screen.getByTestId('bienvenida-unirme'));
    fireEvent.click(screen.getByTestId('bienvenida-crear'));
    // Assert
    expect(on.onPersonal).toHaveBeenCalledTimes(1);
    expect(on.onJoin).toHaveBeenCalledTimes(1);
    expect(on.onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Detectado')).toBeNull();
  });

  it('a join link marks the join card «Detectado» with its code and the space\'s name', async () => {
    render(<WelcomePane jwt="jwt" detectedCode="CONS-7K3P" onPersonal={vi.fn()} onJoin={vi.fn()} onCreate={vi.fn()} />);
    expect(screen.getByText('Detectado')).toBeInTheDocument();
    expect(screen.getByTestId('bienvenida-espacio-detectado').textContent).toContain('CONS-7K3P');
    expect(await screen.findByText('CONSTROAD')).toBeInTheDocument();
  });
});
