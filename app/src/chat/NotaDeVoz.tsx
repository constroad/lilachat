import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { duracionDeVoz } from '@lilachat/shared';
import { segundosDelToque, siguienteVelocidad, soltarElAudio, tomarElAudio } from './notaDeVozMotor';
import { useColores } from '../ui/tema';

/**
 * La nota de voz, con su play, su tiempo y —como WhatsApp (FL9b)— la velocidad
 * (1× / 1,5× / 2×), una sola sonando a la vez, y tocar la barra para saltar.
 *
 * El reproductor vive en un componente aparte porque `useAudioPlayer` es un
 * hook: en la fila habría que montarlo para CADA mensaje, incluidos los de
 * texto, y quedarían decenas de reproductores vivos en una conversación larga.
 *
 * **No arranca solo.** Un audio que empieza a sonar al aparecer en pantalla es
 * lo peor que puede hacer una app de mensajería: suena en la mesa, en la
 * reunión, o encima de otro audio.
 */
export function NotaDeVoz({ id, url, durationMs }: { id: string; url: string; durationMs?: number }) {
  const colores = useColores();
  const player = useAudioPlayer(url);
  const estado = useAudioPlayerStatus(player);
  const [velocidad, setVelocidad] = useState(1);
  const [anchoBarra, setAnchoBarra] = useState(0);

  useEffect(() => () => soltarElAudio(id), [id]);

  const sonando = estado.playing;
  // En reposo se muestra la duración REAL que se grabó (guardada al subir): el
  // `m4a` remoto reporta mal su duración hasta cargar entero, y ahí salía «0:25»
  // para una nota de 4 segundos. Al reproducir se muestra lo que va corriendo.
  const enReposo = durationMs ?? estado.duration * 1000;
  const ms = sonando || estado.currentTime > 0 ? estado.currentTime * 1000 : enReposo;
  const duracion = estado.duration > 0 ? estado.duration : (durationMs ?? 0) / 1000;

  const reproducir = () => {
    if (sonando) return player.pause();
    // Terminada: vuelve al principio. Sin esto, el segundo toque no hace nada
    // y parece que el audio se rompió.
    if (estado.didJustFinish || estado.currentTime >= estado.duration) player.seekTo(0);
    tomarElAudio(id, () => player.pause());
    player.setPlaybackRate(velocidad);
    player.play();
  };

  const cambiarVelocidad = () => {
    const nueva = siguienteVelocidad(velocidad);
    setVelocidad(nueva);
    player.setPlaybackRate(nueva);
  };

  return (
    <View testID="nota-de-voz" className="min-w-[210px] flex-row items-center gap-3 px-3 py-2.5">
      <Pressable
        testID={sonando ? 'btn-pausar-voz' : 'btn-reproducir-voz'}
        accessibilityLabel={sonando ? 'Pausar' : 'Reproducir'}
        onPress={reproducir}
        className="h-10 w-10 items-center justify-center rounded-full bg-primary/10"
      >
        {sonando ? <Pause size={18} color={colores.primary} /> : <Play size={18} color={colores.primary} fill={colores.primary} />}
      </Pressable>
      <View className="min-w-0 flex-1">
        {/* Tocar la barra salta a ese punto; el área es más alta que la línea. */}
        <Pressable
          testID="barra-voz"
          accessibilityLabel="Ir a un punto de la nota"
          onLayout={(evento) => setAnchoBarra(evento.nativeEvent.layout.width)}
          onPress={(evento) => player.seekTo(segundosDelToque({ x: evento.nativeEvent.locationX, ancho: anchoBarra, duracion }))}
          className="h-6 justify-center"
        >
          <View className="h-1 rounded-full bg-primary/15">
            <View
              className="h-1 rounded-full bg-primary"
              style={{ width: `${duracion > 0 ? Math.min(100, (estado.currentTime / duracion) * 100) : 0}%` }}
            />
          </View>
        </Pressable>
        <Text className="text-[11px] text-on-surface-variant">{duracionDeVoz(ms)}</Text>
      </View>
      <Pressable
        testID="btn-velocidad-voz"
        accessibilityLabel={`Velocidad ${velocidad}×`}
        onPress={cambiarVelocidad}
        className="h-11 min-w-[44px] items-center justify-center"
      >
        <Text className="rounded-full bg-primary/10 px-2 py-1 text-[12px] font-bold text-primary">
          {`${String(velocidad).replace('.', ',')}×`}
        </Text>
      </Pressable>
    </View>
  );
}
