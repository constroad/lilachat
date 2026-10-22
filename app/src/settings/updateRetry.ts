/**
 * When the update download is cut (José, 22/10: the screen locked halfway
 * through the 35 MB and, on reopening, the band showed «Call to function
 * 'FileSystem.downloadFileAsync' has been rejected»). Android cuts an app's
 * network in the background: the screen now stays on while it downloads, and
 * a download cut by leaving the app goes on alone, once, on return. The
 * technical reason goes to the diagnostics, not to the screen.
 */
export function downloadFailedText(interrupted: boolean): string {
  return interrupted ? 'La descarga se cortó al bloquearse la pantalla. Sigue sola al volver.' : 'No se pudo descargar la actualización. Toca «Reintentar».';
}

export type AfterCut = 'resume-now' | 'resume-on-return' | 'none';

/**
 * One automatic resume, only for a download cut while the app was away. The
 * cut often surfaces once the app is back in front (E2E 22/10: the error came
 * after the return), so then it goes on at once instead of waiting for a
 * return that already happened.
 */
export function afterCutDownload(state: { cut: boolean; leftTheApp: boolean; activeNow: boolean; alreadyResumed: boolean }): AfterCut {
  if (!state.cut || !state.leftTheApp || state.alreadyResumed) return 'none';
  return state.activeNow ? 'resume-now' : 'resume-on-return';
}
