/**
 * Las opciones que recibe el grabador nativo: las comunes más las de la
 * plataforma. Es lo que hace `useAudioRecorder` de expo-audio por dentro; acá
 * hace falta porque el grabador se crea recién al grabar (19/10), no al montar.
 */
type OpcionesDeGrabacion = {
  extension: string;
  sampleRate: number;
  numberOfChannels: number;
  bitRate: number;
  isMeteringEnabled?: boolean;
  directory?: unknown;
  android?: object;
  ios?: object;
  web?: object;
};

export function opcionesNativasDeGrabacion(opciones: OpcionesDeGrabacion, plataforma: string): Record<string, unknown> {
  const comunes = {
    extension: opciones.extension,
    sampleRate: opciones.sampleRate,
    numberOfChannels: opciones.numberOfChannels,
    bitRate: opciones.bitRate,
    isMeteringEnabled: opciones.isMeteringEnabled ?? false,
  };
  if (plataforma === 'ios') return { ...comunes, directory: opciones.directory, ...opciones.ios };
  if (plataforma === 'android') return { ...comunes, directory: opciones.directory, ...opciones.android };
  return { ...comunes, ...opciones.web };
}
