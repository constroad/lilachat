import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { useActualizacionSilenciosa } from './useActualizacionSilenciosa';

/** Mounted once per session, inside the call provider (no UI): see `useActualizacionSilenciosa`. */
export function SilentUpdateHost() {
  const { hayLlamada } = useLlamadas();
  useActualizacionSilenciosa(hayLlamada);
  return null;
}
