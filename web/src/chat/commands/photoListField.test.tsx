import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { formFields } from '@lilachat/shared';
import { PhotoListField } from './PhotoListField';

/** Several photos, each removable (José, 24/10). */
const [fotos] = formFields({ id: 'registrar_medida_tanque', title: 'Medida', schema: { type: 'object', properties: { fotos: { type: 'array', 'x-input': 'photo', maxItems: 2, title: 'Fotos de la wincha' } }, required: [] } });

describe('a list of photos in an app form', () => {
  it('uploads each one, removes one and lets add again up to the maximum', async () => {
    // Arrange
    if (fotos?.kind !== 'photo') throw new Error('photo');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    const onChange = vi.fn();
    let next = 0;
    const upload = vi.fn(async () => ({ ok: true as const, fileId: `f${(next += 1)}` }));
    render(<PhotoListField field={fotos} onChange={onChange} upload={upload} />);
    const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' });
    // Act
    fireEvent.change(screen.getByTestId('archivo-fotos'), { target: { files: [file('a.jpg'), file('b.jpg'), file('c.jpg')] } });
    // Assert
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['f1', 'f2']));
    expect(upload).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('campo-fotos')).toBeNull();
    fireEvent.click(screen.getByTestId('quitar-foto-fotos-0'));
    expect(onChange).toHaveBeenLastCalledWith(['f2']);
    expect(screen.getByTestId('campo-fotos')).toBeInTheDocument();
  });
});
