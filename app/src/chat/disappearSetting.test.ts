import { describe, expect, it, vi } from 'vitest';
import { disappearSettingOf } from './disappearSetting';

const me = { esYo: true, role: 'member' };
const onNotice = vi.fn();

describe('where «Mensajes temporales» shows in the app (R31/10-B6)', () => {
  it('a 1:1: always, and either of the two changes it', () => {
    expect(disappearSettingOf({ kind: 'direct', encrypted: false, disappearSeconds: 86_400, members: [me] }, 'c1', 't', onNotice)).toEqual({ chatId: 'c1', jwt: 't', seconds: 86_400, canChange: true, onNotice });
  });

  it('a group: a member changes it only with «Editar la info» open to everyone', () => {
    const locked = disappearSettingOf({ kind: 'group', encrypted: false, memberPermissions: { editInfo: false }, members: [me] }, 'c1', 't', onNotice);
    const open = disappearSettingOf({ kind: 'group', encrypted: false, memberPermissions: { editInfo: true }, members: [me] }, 'c1', 't', onNotice);
    const admin = disappearSettingOf({ kind: 'group', encrypted: false, memberPermissions: { editInfo: false }, members: [{ esYo: true, role: 'admin' }] }, 'c1', 't', onNotice);
    expect(locked).toMatchObject({ canChange: false, seconds: 0 });
    expect(open?.canChange).toBe(true);
    expect(admin?.canChange).toBe(true);
  });

  it('a channel, a secret chat and the notes chat do not have it', () => {
    expect(disappearSettingOf({ kind: 'group', encrypted: false, channel: { visibility: 'public' }, members: [me] }, 'c1', 't', onNotice)).toBeUndefined();
    expect(disappearSettingOf({ kind: 'direct', encrypted: true, members: [me] }, 'c1', 't', onNotice)).toBeUndefined();
    expect(disappearSettingOf({ kind: 'notas', encrypted: false, members: [me] }, 'c1', 't', onNotice)).toBeUndefined();
  });
});
