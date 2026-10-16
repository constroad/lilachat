import * as Battery from 'expo-battery';
import * as Network from 'expo-network';
import type { Condiciones } from '@lilachat/shared';

/** Lo que el sistema informa, en la forma que `puedeSubirAhora` entiende. Copiado de Lilafotos. */
export async function leerCondiciones(): Promise<Condiciones> {
  const [estadoBateria, nivel, red] = await Promise.all([
    Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
    Battery.getBatteryLevelAsync().catch(() => -1),
    Network.getNetworkStateAsync().catch(() => null),
  ]);
  const cargando =
    estadoBateria === Battery.BatteryState.CHARGING || estadoBateria === Battery.BatteryState.FULL;
  const wifi = red?.type === Network.NetworkStateType.WIFI || red?.type === Network.NetworkStateType.ETHERNET;
  return {
    cargando,
    wifi: Boolean(wifi && red?.isConnected),
    // expo-network no informa si el wifi es medido: se asume que no. Un
    // hotspot ajeno queda como riesgo aceptado hasta tener el dato nativo.
    wifiMedido: false,
    bateriaPct: nivel >= 0 ? Math.round(nivel * 100) : null,
  };
}
