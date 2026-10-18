import { useEffect, useState } from 'react';
import type { ResultadoDelChequeo } from './actualizacion';
import { buscarActualizacion, versionCodeActual } from './versionApi';
import { decidirAvisoDeActualizacion, type AvisoDeActualizacion } from './avisoDeActualizacion';
import { abrirActualizacion } from './abrirTienda';
import { useActualizador, type InfoActualizacion } from './useActualizador';
import { infoParaActualizar } from './actualizacionInfo';
import { guardarActualizacionDescartada, leerActualizacionDescartada } from './preferencias';

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

  /**
   * UNA sola consulta al arrancar, que sirve para las dos cosas: el enlace de
   * la invitación y el aviso de versión nueva. Atado al botón «buscar», la
   * invitación salía sin el enlace directo (visto en el emulador, 27/08/2026).
   */
  useEffect(() => {
    void (async () => {
      const [{ downloadUrl, ultima, minima, version, sha256, size, releaseId }, descartada] =
        await Promise.all([buscarActualizacion(), leerActualizacionDescartada()]);
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
    const { resultado, downloadUrl, sha256, size, releaseId } = await buscarActualizacion();
    setChequeo(resultado);
    setEnlaceApp(downloadUrl);
    const info = { downloadUrl, releaseId, sha256, size };
    setInfoApp(info);
    setVerificando(false);
    if (resultado.estado === 'hay-nueva') void actualizar(info);
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
    abrirTienda: () => void abrirActualizacion(infoApp.downloadUrl),
    descartarAviso,
  };
}
