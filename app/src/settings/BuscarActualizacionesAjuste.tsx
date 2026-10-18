import { RefreshCw } from 'lucide-react-native';
import type { ResultadoDelChequeo } from './actualizacion';
import type { EstadoActualizacion } from './useActualizador';
import { versionActual } from './versionApi';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';

/** Lo que dice debajo: el estado de la descarga manda sobre el del chequeo. */
function detalle(params: { estado: EstadoActualizacion; verificando: boolean; chequeo: ResultadoDelChequeo | null }): string {
  const { estado, verificando, chequeo } = params;
  if (estado.fase === 'descargando') return `Descargando… ${Math.round(estado.progreso * 100)}%`;
  if (estado.fase === 'instalando') return 'Abriendo el instalador…';
  if (estado.fase === 'error') return estado.mensaje;
  if (verificando) return 'Verificando…';
  if (chequeo?.estado === 'al-dia') return `Versión ${versionActual()} · estás al día`;
  if (chequeo?.estado === 'no-se-pudo') return 'No se pudo verificar. Revisa la señal.';
  return `Versión ${versionActual()}`;
}

/**
 * «Buscar actualizaciones» en Ajustes (salió de `TabsShell`). Se dispara con
 * un toque y NO al abrir Ajustes: un pedido de red cada vez que alguien entra
 * acá es tráfico que nadie pidió.
 */
export function BuscarActualizacionesAjuste(props: {
  chequeo: ResultadoDelChequeo | null;
  estado: EstadoActualizacion;
  verificando: boolean;
  onVerificar: () => void;
}) {
  return (
    <FilaDeAjuste
      testID="btn-actualizaciones"
      icono={RefreshCw}
      titulo={props.chequeo?.estado === 'hay-nueva' ? `Actualizar a ${props.chequeo.version}` : 'Buscar actualizaciones'}
      detalle={detalle(props)}
      onPress={props.onVerificar}
    />
  );
}
