import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChecklistItem } from '@lilachat/shared';
import { TaskDialog } from './TaskDialog';

/** José 06/11: «a las tareas agrega que se puedan agregar recordatorios x tiempo antes». */
const dated: ChecklistItem = { id: 't1', text: 'Tren de imprimación', doneBy: null, doneAt: null, assignee: null, dueAt: '2099-01-01T15:00:00Z' };
const open = (item: ChecklistItem, onSave = vi.fn()) => {
  render(<TaskDialog item={item} members={[]} canRemove={false} onSave={onSave} onRemove={vi.fn()} onClose={vi.fn()} />);
  return onSave;
};

describe('the reminders of a task on the web', () => {
  it('asks «Recordar antes» only with a date', () => {
    open({ ...dated, dueAt: null });
    expect(screen.queryByTestId('tarea-recordatorios')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tarea-tomorrow'));
    expect(screen.getByTestId('tarea-recordatorios')).toBeInTheDocument();
  });

  it('saving without touching it leaves the space\'s default, with no advance sent', () => {
    const onSave = open(dated);
    fireEvent.click(screen.getByTestId('tarea-guardar'));
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('advance');
  });

  it('sends what was chosen', () => {
    const onSave = open(dated);
    fireEvent.click(screen.getByTestId('aviso-15'));
    fireEvent.click(screen.getByTestId('tarea-guardar'));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ advance: [15] });
  });

  it('what the task already had stays', () => {
    const onSave = open({ ...dated, advance: [60] });
    fireEvent.click(screen.getByTestId('tarea-guardar'));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ advance: [60] });
  });

  it('does not promise a ring at the hour: a task only rings before', () => {
    open(dated);
    expect(screen.getByTestId('tarea-recordatorios')).not.toHaveTextContent('a la hora');
  });
});
