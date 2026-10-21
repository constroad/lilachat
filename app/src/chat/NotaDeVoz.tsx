import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { duracionDeVoz, firstPlay, nextPlaybackRate, scrubFraction } from '@lilachat/shared';
import { soltarElAudio, tomarElAudio } from './notaDeVozMotor';
import { useColores } from '../ui/tema';
import { reportarError } from '../ui/reportarError';
import { playbackAudioMode } from './audioMode';

/** Longer than this, Android stops background audio after ~3 min unless it shows lock-screen controls. */
const LOCK_SCREEN_FROM_S = 150;

/** Plays with the screen locked (20/10); a long audio also gets lock-screen controls so Android does not cut it. */
function playInBackground(player: AudioPlayer, durationS: number): void {
  void setAudioModeAsync(playbackAudioMode()).catch((error) => reportarError('nota.audioMode', error));
  if (durationS >= LOCK_SCREEN_FROM_S) player.setActiveForLockScreen(true, { title: 'Nota de voz' });
  player.play();
}

type PropsDeNota = {
  id: string;
  url: string;
  durationMs?: number;
  onda?: number[];
  /** En la propia (violeta sólido, FL13) todo va en el color del texto. */
  mia?: boolean;
};

/**
 * La nota de voz, con su play, su tiempo y —como WhatsApp (FL9b)— la velocidad
 * (1× / 1,5× / 2×), una sola sonando a la vez, y tocar la barra para saltar.
 *
 * **El reproductor nace al primer toque** (FL12, §49 #10). `useAudioPlayer`
 * crea un reproductor nativo y empieza a bajar el audio al montarse: un chat
 * con diez notas visibles eran diez reproductores y diez descargas peleando
 * con las fotos. Hasta que se toca, es solo la onda y la duración guardadas.
 *
 * **No arranca solo.** Un audio que empieza a sonar al aparecer en pantalla es
 * lo peor que puede hacer una app de mensajería: suena en la mesa, en la
 * reunión, o encima de otro audio.
 */
export function NotaDeVoz(props: PropsDeNota) {
  const [activa, setActiva] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  /** Touching the bar before the first play starts there (backlog 34). */
  const [startShare, setStartShare] = useState<number | null>(null);
  if (activa) return <NotaDeVozActiva {...props} velocidadInicial={velocidad} startShare={startShare} />;
  return (
    <VistaDeNota
      mia={props.mia}
      onda={props.onda}
      sonando={false}
      ms={props.durationMs ?? 0}
      avance={0}
      velocidad={velocidad}
      onPlay={() => setActiva(true)}
      onVelocidad={() => setVelocidad(nextPlaybackRate(velocidad))}
      durationS={(props.durationMs ?? 0) / 1000}
      onSeek={(share) => {
        setStartShare(share);
        setActiva(true);
      }}
    />
  );
}

/** Ya tocada: el reproductor vive y arranca solo, porque es la respuesta al toque. */
function NotaDeVozActiva({ id, url, durationMs, onda, mia, velocidadInicial, startShare }: PropsDeNota & { velocidadInicial: number; startShare: number | null }) {
  const player = useAudioPlayer(url);
  const estado = useAudioPlayerStatus(player);
  const [velocidad, setVelocidad] = useState(velocidadInicial);
  const arrancada = useRef(false);

  useEffect(() => () => soltarElAudio(id), [id]);
  // A finished long audio takes its lock-screen controls away.
  useEffect(() => {
    if (estado.didJustFinish && estado.duration >= LOCK_SCREEN_FROM_S) player.clearLockScreenControls();
  }, [estado.didJustFinish, estado.duration, player]);

  const sonando = estado.playing;
  // En reposo se muestra la duración REAL que se grabó (guardada al subir): el
  // `m4a` remoto reporta mal su duración hasta cargar entero, y ahí salía «0:25»
  // para una nota de 4 segundos. Al reproducir se muestra lo que va corriendo.
  const enReposo = durationMs ?? estado.duration * 1000;
  const ms = sonando || estado.currentTime > 0 ? estado.currentTime * 1000 : enReposo;
  const duracion = estado.duration > 0 ? estado.duration : (durationMs ?? 0) / 1000;
  /** 0→1: cuánto va sonando. */
  const avance = duracion > 0 ? Math.min(1, estado.currentTime / duracion) : 0;

  const reproducir = () => {
    if (sonando) return player.pause();
    // Terminada: vuelve al principio. Sin esto, el segundo toque no hace nada
    // y parece que el audio se rompió.
    if (estado.didJustFinish || estado.currentTime >= estado.duration) player.seekTo(0);
    tomarElAudio(id, () => player.pause());
    player.setPlaybackRate(velocidad);
    playInBackground(player, duracion);
  };

  // The tap that activated it asked to play: once the audio is loaded (Android ignores an earlier play), from where it was touched.
  useEffect(() => {
    const decision = firstPlay({ loaded: estado.isLoaded, started: arrancada.current, startShare, duration: duracion });
    if (!decision.play) return;
    arrancada.current = true;
    if (decision.seekTo > 0) void player.seekTo(decision.seekTo);
    tomarElAudio(id, () => player.pause());
    player.setPlaybackRate(velocidad);
    playInBackground(player, duracion);
  }, [estado.isLoaded, id, player, velocidad, duracion, startShare]);

  return (
    <VistaDeNota
      mia={mia}
      onda={onda}
      sonando={sonando}
      ms={ms}
      avance={avance}
      velocidad={velocidad}
      onPlay={reproducir}
      onVelocidad={() => {
        const nueva = nextPlaybackRate(velocidad);
        setVelocidad(nueva);
        player.setPlaybackRate(nueva);
      }}
      loading={!estado.isLoaded}
      durationS={duracion}
      onSeek={(share) => void player.seekTo(share * duracion)}
    />
  );
}

/** Lo que se ve, igual con o sin reproductor. */
function VistaDeNota(props: {
  mia?: boolean;
  onda?: number[];
  sonando: boolean;
  ms: number;
  avance: number;
  velocidad: number;
  onPlay: () => void;
  onVelocidad: () => void;
  /** Tap or drag along the bar: jump to that share of the audio (backlog 34). */
  onSeek: (share: number) => void;
  /** Its length, to show the time under the finger while dragging. */
  durationS: number;
  /** The audio is still loading after the tap: a spinner, not a dead button. */
  loading?: boolean;
}) {
  const { mia, onda, sonando, velocidad } = props;
  const colores = useColores();
  const tinta = mia ? colores['on-burbuja-propia'] : colores.primary;
  const [anchoBarra, setAnchoBarra] = useState(0);
  /** While the finger is on the bar, the bar and the time follow it; letting go jumps there. */
  const [dragShare, setDragShare] = useState<number | null>(null);
  const avance = dragShare ?? props.avance;
  const ms = dragShare !== null ? dragShare * props.durationS * 1000 : props.ms;

  return (
    <View testID="nota-de-voz" className="min-w-[210px] flex-row items-center gap-3 px-3 py-2.5">
      <Pressable
        testID={sonando ? 'btn-pausar-voz' : 'btn-reproducir-voz'}
        accessibilityLabel={sonando ? 'Pausar' : 'Reproducir'}
        onPress={props.onPlay}
        hitSlop={2}
        className={`h-10 w-10 items-center justify-center rounded-full ${mia ? 'bg-white/20' : 'bg-primary/10'}`}
      >
        {props.loading ? <ActivityIndicator size="small" color={tinta} /> : sonando ? <Pause size={18} color={tinta} /> : <Play size={18} color={tinta} fill={tinta} />}
      </Pressable>
      <View className="min-w-0 flex-1">
        {/* Tap or drag along the bar, like WhatsApp: the area is taller than the line. */}
        <View
          testID="barra-voz"
          accessibilityLabel="Ir a un punto de la nota"
          accessibilityRole="adjustable"
          onLayout={(evento) => setAnchoBarra(evento.nativeEvent.layout.width)}
          hitSlop={{ top: 10, bottom: 10 }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          // The chat's swipe-to-reply must not steal a drag along the bar.
          onResponderTerminationRequest={() => false}
          onResponderGrant={(evento) => setDragShare(scrubFraction(evento.nativeEvent.locationX, anchoBarra))}
          onResponderMove={(evento) => setDragShare(scrubFraction(evento.nativeEvent.locationX, anchoBarra))}
          onResponderRelease={(evento) => {
            props.onSeek(scrubFraction(evento.nativeEvent.locationX, anchoBarra));
            setDragShare(null);
          }}
          onResponderTerminate={() => setDragShare(null)}
          className="h-6 justify-center"
        >
          {onda?.length ? (
            // La onda que se midió al grabar (FL9), como WhatsApp: se llena
            // con el avance. Sin onda (notas viejas), la línea de siempre.
            <View testID="onda-voz" className="h-6 flex-row items-center justify-between">
              {onda.map((valor, indice) => (
                <View
                  key={indice}
                  className={`w-[3px] rounded-full ${
                    indice / onda.length < avance ? (mia ? 'bg-on-burbuja-propia' : 'bg-primary') : mia ? 'bg-on-burbuja-propia/40' : 'bg-primary/30'
                  }`}
                  style={{ height: 3 + (valor / 100) * 19 }}
                />
              ))}
            </View>
          ) : (
            <View className={`h-1 rounded-full ${mia ? 'bg-on-burbuja-propia/25' : 'bg-primary/15'}`}>
              <View className={`h-1 rounded-full ${mia ? 'bg-on-burbuja-propia' : 'bg-primary'}`} style={{ width: `${Math.min(100, avance * 100)}%` }} />
            </View>
          )}
        </View>
        <Text className={`text-[11px] ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`}>{duracionDeVoz(ms)}</Text>
      </View>
      <Pressable
        testID="btn-velocidad-voz"
        accessibilityLabel={`Velocidad ${velocidad}×`}
        onPress={props.onVelocidad}
        className="h-11 min-w-[44px] items-center justify-center"
      >
        <Text className={`rounded-full px-2 py-1 text-[12px] font-bold ${mia ? 'bg-white/20 text-on-burbuja-propia' : 'bg-primary/10 text-primary'}`}>
          {`${String(velocidad).replace('.', ',')}×`}
        </Text>
      </Pressable>
    </View>
  );
}
