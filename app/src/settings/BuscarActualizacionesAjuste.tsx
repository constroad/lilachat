import { Pressable, Text, View } from 'react-native';
import { ChevronRight, RefreshCw } from 'lucide-react-native';
import type { ResultadoDelChequeo } from './actualizacion';
import type { EstadoActualizacion } from './useActualizador';
import { versionActual } from './versionApi';
import { useColores } from '../ui/tema';

/** Lo que dice debajo: el estado de la descarga manda sobre el del chequeo. */
function detalle(params: { estado: EstadoActualizacion; verificando: boolean; chequeo: ResultadoDelChequeo | null }): string {
  const { estado, verificando, chequeo } = params;
  if (estado.fase === 'descargando') return `Descargando… ${Math.round(estado.progreso * 100)}%`;
  if (estado.fase === 'instalando') return 'Abriendo el instalador…';
  if (estado.fase === 'error') return estado.mensaje;
  if (verificando) return 'Verificando…';
  if (chequeo?.estado === 'al-dia') return `Versión ${versionActual()} · estás al día`;
  if (chequeo?.estado === 'no-se-pudo') return 'No se pudo verificar. Revisá la señal.';
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
  const colores = useColores();
  return (
    <Pressable
      testID="btn-actualizaciones"
      onPress={props.onVerificar}
      className="mt-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <RefreshCw size={18} color={colores.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-on-surface">
          {props.chequeo?.estado === 'hay-nueva' ? `Actualizar a ${props.chequeo.version}` : 'Buscar actualizaciones'}
        </Text>
        <Text className="text-[11px] text-on-surface-variant">{detalle(props)}</Text>
      </View>
      <ChevronRight size={18} color={colores.outline} />
    </Pressable>
  );
}
