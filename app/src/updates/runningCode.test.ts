import { describe, expect, it } from 'vitest';
import { describeRunningCode } from './runningCode';

/** Diagnóstico shows which code runs: the same APK can run any update published for its runtime. */
describe('describeRunningCode', () => {
  it('says the code is the one inside the APK when no update was applied', () => {
    expect(describeRunningCode({ updateId: null, runtimeVersion: '1441aed1602610372a0cc7330e2817023eec6a3a' })).toEqual({
      code: 'Incluido en el APK',
      runtime: '1441aed1',
    });
  });

  it('shows the first 8 characters of the update that runs, enough to tell two apart', () => {
    expect(describeRunningCode({ updateId: '3f1c2a9e-7d4b-4e5a-9a10-2c5b8f6d1e00', runtimeVersion: '1441aed1602610372a0cc7330e2817023eec6a3a' })).toEqual({
      code: 'Actualización 3f1c2a9e',
      runtime: '1441aed1',
    });
  });

  it('says it plainly when OTA is off (development builds): nothing to show, nothing made up', () => {
    expect(describeRunningCode({ updateId: null, runtimeVersion: null })).toEqual({ code: 'Incluido en el APK', runtime: 'sin runtime' });
  });
});
