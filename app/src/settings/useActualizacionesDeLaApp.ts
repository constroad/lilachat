import { useEffect, useState } from 'react';
import type { ResultadoDelChequeo } from './actualizacion';
import { buscarActualizacion, versionCodeActual } from './versionApi';
import { decidirAvisoDeActualizacion, type AvisoDeActualizacion } from './avisoDeActualizacion';
import { abrirActualizacion } from './abrirTienda';
import { useActualizador, type InfoActualizacion } from './useActualizador';
import { infoParaActualizar } from './actualizacionInfo';
import { guardarActualizacionDescartada, leerActualizacionDescartada } from './preferencias';
import type { Novedad } from './novedades';

const SIN_INFO: InfoActualizacion = { downloadUrl: '', releaseId: '', sha256: '', size: 0 };

/**
 * Todo lo de «hay versión nueva» (salió de `TabsShell`): la consulta del
 * arranque, la banda de la lista, el botón de Ajustes y el enlace que lleva la
 * invitación.
 */
export function useActualizacionesDeLaApp() {
  const [chequeo, setChequeo] = useState<ResultadoDelChequeo | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [enlaceApp, setEnlaceApp] = useState('');
  const [infoApp, setInfoApp] = useState<InfoActualizacion>(SIN_INFO);
  const { estado, actualizar } = useActualizador();
  const [aviso, setAviso] = useState<AvisoDeActualizacion>({ tipo: 'ninguno' });
  /** Lo nuevo de cada versión posterior (19/10): se muestra ANTES de bajar. */
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [viendoNovedades, setViendoNovedades] = useState(false);

  /**
   * UNA sola consulta al arrancar, que sirve para las dos cosas: el enlace de
   * la invitación y el aviso de versión nueva. Atado al botón «buscar», la
   * invitación salía sin el enlace directo (visto en el emulador, 27/08/2026).
   */
  useEffect(() => {
    void (async () => {
      const [{ downloadUrl, ultima, minima, version, sha256, size, releaseId, novedades: nuevas }, descartada] =
        await Promise.all([buscarActualizacion(), leerActualizacionDescartada()]);
      setNovedades(nuevas);
      setEnlaceApp(downloadUrl);
      setInfoApp({ downloadUrl, releaseId, sha256, size });
      setAviso(decidirAvisoDeActualizacion({ actual: versionCodeActual(), ultima, minima, version, descartada }));
    })();
  }, []);

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

  /** «Actualizar» de la banda: primero las novedades, si las hay (19/10). */
  const pedirActualizacion = () => (novedades.length > 0 ? setViendoNovedades(true) : actualizarDesdeBanda());
  const descargarDesdeNovedades = () => {
    setViendoNovedades(false);
    actualizarDesdeBanda();
  };

  const descartarAviso = () => {
    if (aviso.tipo !== 'ninguno') void guardarActualizacionDescartada(aviso.version);
    setAviso({ tipo: 'ninguno' });
  };

  return {
    aviso,
    estado,
    chequeo,
    verificando,
    enlaceApp,
    verificar,
    actualizarDesdeBanda,
    pedirActualizacion,
    novedades,
    viendoNovedades,
    cerrarNovedades: () => setViendoNovedades(false),
    descargarDesdeNovedades,
    abrirTienda: () => void abrirActualizacion(infoApp.downloadUrl),
    descartarAviso,
  };
}
