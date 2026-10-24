import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audienceOfNotes, updateMatters } from '@lilachat/shared';
import type { ResultadoDelChequeo } from './actualizacion';
import { buscarActualizacion, versionCodeActual } from './versionApi';
import { subscribeUpdateRequired } from '../api/appBuild';
import { decidirAvisoDeActualizacion, shouldRecheckVersion } from './avisoDeActualizacion';
import type { AvisoDeActualizacion } from './avisoDeActualizacion';
import { useAlVolver } from '../ui/useAlVolver';
import { abrirActualizacion } from './abrirTienda';
import { useActualizador, type InfoActualizacion } from './useActualizador';
import { infoParaActualizar } from './actualizacionInfo';
import { guardarActualizacionDescartada, leerActualizacionDescartada } from './preferencias';
import { newerAudiences, type Novedad } from './novedades';

const SIN_INFO: InfoActualizacion = { downloadUrl: '', releaseId: '', sha256: '', size: 0 };

/**
 * Todo lo de «hay versión nueva» (salió de `TabsShell`): la consulta del
 * arranque, la banda de la lista, el botón de Ajustes y el enlace que lleva la
 * invitación.
 */
export function useActualizacionesDeLaApp(usage: { spaces: boolean; personal: boolean } | null) {
  const [chequeo, setChequeo] = useState<ResultadoDelChequeo | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enlaceApp, setEnlaceApp] = useState('');
  const [infoApp, setInfoApp] = useState<InfoActualizacion>(SIN_INFO);
  const { estado, actualizar } = useActualizador();
  /** The last check, kept so the notice follows what this person uses once their spaces and chats load. */
  const [published, setPublished] = useState<{ ultima: number | null; minima: number; version: string; descartada: string | null } | null>(null);
  /** Lo nuevo de cada versión posterior (19/10): se muestra ANTES de bajar. */
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [viendoNovedades, setViendoNovedades] = useState(false);

  /**
   * ONE query serves both: the invitation link and the new-version notice
   * (tied to the «buscar» button, the invitation went out without the direct
   * link; seen on the emulator, 27/08/2026). It runs at start and when coming
   * back to the app (backlog 32, José 21/10: it only noticed on a cold start),
   * at most every 30 min.
   */
  const lastCheck = useRef<number | null>(null);
  const checkPublished = useCallback(async () => {
    lastCheck.current = Date.now();
    const [{ downloadUrl, ultima, minima, version, sha256, size, releaseId, novedades: nuevas }, descartada] =
      await Promise.all([buscarActualizacion(), leerActualizacionDescartada()]);
    setNovedades(nuevas);
    setEnlaceApp(downloadUrl);
    setInfoApp({ downloadUrl, releaseId, sha256, size });
    setPublished({ ultima, minima, version, descartada });
  }, []);
  useEffect(() => {
    void checkPublished();
  }, [checkPublished]);
  useAlVolver(true, () => {
    if (shouldRecheckVersion(lastCheck.current, Date.now())) void checkPublished();
  });
  // The server said 426 (below the minimum): checked now, so the lock screen comes without waiting.
  useEffect(() => subscribeUpdateRequired(() => void checkPublished()), [checkPublished]);

  /**
   * El botón de Ajustes: busca la versión publicada y, si hay una más nueva, la
   * baja y la instala DENTRO de la app; si no se puede verificar, el propio
   * actualizador cae a un error que ofrece LilaStore.
   */
  const verificar = async () => {
    if (verificando) return;
    setVerificando(true);
    const { resultado, downloadUrl, sha256, size, releaseId, novedades: nuevas } = await buscarActualizacion();
    setChequeo(resultado);
    setEnlaceApp(downloadUrl);
    const info = { downloadUrl, releaseId, sha256, size };
    setInfoApp(info);
    setNovedades(nuevas);
    setVerificando(false);
    if (resultado.estado !== 'hay-nueva') return;
    // Con novedades publicadas, primero se ven; la descarga sale de ahí.
    if (nuevas.length > 0) setViendoNovedades(true);
    else void actualizar(info);
  };

  /**
   * La banda vuelve a preguntar al TOCAR: la info del arranque puede ser de una
   * versión que ya no es la última (16/10: seis publicaciones seguidas y se
   * bajaba una vieja).
   */
  const actualizarDesdeBanda = () =>
    void buscarActualizacion().then(({ downloadUrl, releaseId, sha256, size }) => {
      const info = infoParaActualizar({ downloadUrl, releaseId, sha256, size }, infoApp);
      setInfoApp(info);
      return actualizar(info);
    });

  /** The band's button: the release notes first, if any (19/10); a retry (22/10) downloads at once, the notes were already seen. */
  const requestUpdate = () => (novedades.length > 0 && estado.fase !== 'error' ? setViendoNovedades(true) : actualizarDesdeBanda());
  const descargarDesdeNovedades = () => {
    setViendoNovedades(false);
    actualizarDesdeBanda();
  };

  // José, 24/10: a company-mode release is not offered to someone with only personal chats, and vice versa.
  const notice = useMemo<AvisoDeActualizacion>(() => {
    if (!published) return { tipo: 'ninguno' };
    const relevant = updateMatters(newerAudiences(novedades, versionCodeActual(), published.ultima), usage);
    return decidirAvisoDeActualizacion({ actual: versionCodeActual(), ...published, relevant });
  }, [published, novedades, usage]);

  // The news before downloading: only the versions for what this person uses; if none is, all of them (a manual check).
  const shownNews = useMemo(() => {
    const mine = novedades.filter((novedad) => updateMatters([audienceOfNotes(novedad.notas)], usage));
    return mine.length ? mine : novedades;
  }, [novedades, usage]);

  const descartarAviso = () => {
    if (notice.tipo === 'ninguno') return;
    void guardarActualizacionDescartada(notice.version);
    setPublished((before) => (before ? { ...before, descartada: notice.version } : before));
  };

  return {
    aviso: notice,
    /** The published APK's size, for the lock screen's «Se descarga desde LilaStore · 35 MB». */
    size: infoApp.size,
    estado,
    chequeo,
    verificando,
    enlaceApp,
    verificar,
    actualizarDesdeBanda,
    requestUpdate,
    novedades: shownNews,
    viendoNovedades,
    cerrarNovedades: () => setViendoNovedades(false),
    descargarDesdeNovedades,
    abrirTienda: () => void abrirActualizacion(infoApp.downloadUrl),
    descartarAviso,
  };
}
