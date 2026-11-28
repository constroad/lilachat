import { describe, expect, it } from 'vitest';
import { resolvePendingProgress, workResolveRequest } from './workPending.js';

/** José 28/11: the resolve tool only serves the admin's own record and the admin's «Deshacer». */
describe('resolving a field record', () => {
  it('sends the progress and the decision, with the note trimmed', () => {
    expect(workResolveRequest('a1', 'aprobar')).toEqual({ kind: 'work_resolve', progress_id: 'a1', decision: 'aprobar', forms: expect.any(Number) });
    expect(workResolveRequest('a1', 'rechazar', '  medido mal ')).toMatchObject({ note: 'medido mal' });
    expect(workResolveRequest('a1', 'rechazar', '   ')).not.toHaveProperty('note');
  });

  it('answers null when it worked, Portal\'s reason when not', async () => {
    const ok = async () => ({ ok: true as const, message: 'x' });
    const refused = async () => ({ ok: false as const, message: 'Solo admins.' });
    expect(await resolvePendingProgress(ok, 'a1', 'aprobar')).toBeNull();
    expect(await resolvePendingProgress(refused, 'a1', 'rechazar')).toBe('Solo admins.');
  });
});
