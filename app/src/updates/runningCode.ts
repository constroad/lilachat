export type RunningCode = { code: string; runtime: string };

const SHORT_LENGTH = 8;

/** What Ajustes → Diagnóstico says about the code this phone runs (OTA vs the APK's own). */
export function describeRunningCode(source: { updateId: string | null; runtimeVersion: string | null }): RunningCode {
  return {
    code: source.updateId ? `Actualización ${source.updateId.slice(0, SHORT_LENGTH)}` : 'Incluido en el APK',
    runtime: source.runtimeVersion ? source.runtimeVersion.slice(0, SHORT_LENGTH) : 'sin runtime',
  };
}
