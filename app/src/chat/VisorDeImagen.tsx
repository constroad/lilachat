import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ViewToken, useWindowDimensions } from 'react-native';
import { Modal } from '../ui/Modal';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadedVideoSource } from './uploadedVideoSource';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Download, FileText, Play, Share2, Sticker, Trash2, X } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { nombreLimpio } from './archivoDescargado';
import { copiaLocalDe } from './colaDeArchivos';
import { PaginaDelVisor } from './PaginaDelVisor';
import { indiceDeFoto } from './visor';
import { useEvent } from 'expo';
import Animated, { FadeIn, FadeOut, type SharedValue } from 'react-native-reanimated';
import { beginInteraction } from '../diagnostico/frameMonitor';
import { FlyingPhoto, useViewerTransition, VIEWER_FRAME_WINDOW } from './ViewerTransition';

/** The bars come and go softly (plan 1, F2), instead of popping. */
const BARS_FADE_MS = 150;
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
/** Three pages alive at most: the one in sight and its neighbours. */
const PAGER_WINDOW = { windowSize: 3, initialNumToRender: 1, maxToRenderPerBatch: 2 } as const;

/** Seconds buffered before a video starts: Android waits two by default, and that reads as «it loads, then it plays». */
const VIDEO_START_BUFFER_S = 0.5;

/**
 * El visor a pantalla completa.
 *
 * **Rehecho el 28/08/2026 mirando el diseño**, que es lo que tendría que haber
 * hecho la primera vez: `design/stitch/visor-archivos.png` existía y lo construí
 * de cero sin abrirlo. José lo marcó comparándolo con WhatsApp.
 *
 * Del diseño salen la cabecera con contexto y la tira de «compartido en el
 * chat»; de WhatsApp, las acciones que uno espera tener acá arriba: descargar,
 * compartir y borrar.
 *
 * **Quién manda la foto y cuándo, arriba de todo.** Es lo que el diseño pone en
 * la cabecera y lo que WhatsApp muestra: una foto a pantalla completa sin autor
 * ni fecha obliga a cerrar el visor para saber de quién era.
 *
 * **Rehecho otra vez el 17/10/2026** (José: «cuando abro una imagen y deslizo
 * con los dedos no pasa a la previa o la siguiente»): era UNA imagen con dos
 * flechas —y las flechas iban al revés, porque la lista llega de vieja a
 * nueva—. Ahora es un pager: se desliza entre fotos, se pellizca o se toca dos
 * veces para acercar, se arrastra hacia abajo para cerrar y un toque esconde
 * las barras (`PaginaDelVisor`, cuentas en `visor.ts`). La tira de abajo usa
 * las miniaturas: antes decodificaba cada foto entera para dibujarla a 52 px.
 */
export type FotoDelVisor = {
  url: string;
  /** Quién la mandó, ya resuelto contra la agenda por quien abre el visor. */
  autor: string;
  /** Cuándo, ya formateado: el visor no decide formatos de fecha. */
  cuando: string;
  /** El `seq`, para poder borrarla desde acá. */
  seq: number;
  /** Si es mía: solo entonces se ofrece eliminar. */
  mia: boolean;
  /** La fecha sin formatear, para nombrar el archivo al guardarlo. */
  cuandoReal: Date;
  mime?: string;
  /** El nombre original, cuando es un archivo. */
  nombre?: string;
  /** La miniatura: para la tira y como portada de un video que no se está viendo. */
  miniatura?: string;
  /** What I sent opens from its copy on the phone (`copiaLocalDe`). */
  clientKey?: string;
  /** Width / height, when known: the shape the photo grows into out of its bubble (plan 1, F2). */
  aspecto?: number;
};

/**
 * ¿Esto es un video?
 *
 * Por el `mime`, que es lo que el server ya guarda de cada archivo. Mirar la
 * extensión de la URL no serviría: el nombre en el storage lo pone lila y no
 * tiene por qué terminar en `.mp4`.
 */
const esVideo = (mime?: string): boolean => (mime ?? '').startsWith('video/');

/** Ni foto ni video: un documento, que no se dibuja sino que se abre. */
const esArchivoSuelto = (mime?: string): boolean => {
  const tipo = mime ?? '';
  return tipo !== '' && !tipo.startsWith('image/') && !tipo.startsWith('video/');
};

/**
 * El video, a pantalla completa y con los controles nativos.
 *
 * Es un componente aparte porque `useVideoPlayer` es un hook: adentro del visor
 * habría que llamarlo siempre, también cuando lo que se abre es una foto, y
 * dejaría un reproductor vivo por cada imagen que se mira.
 *
 * **Arranca solo.** Uno toca un video para verlo, no para encontrarse otro
 * botón de play; los controles quedan a mano para pausar.
 *
 * **And it starts soon** (José, 21/10: it loaded and then played, WhatsApp
 * plays at once): half a second of buffer instead of the two Android waits
 * for, and meanwhile the cover with a spinner, not a black screen.
 */
function Reproductor({ url, poster, author }: { url: string; poster?: string; author?: string }) {
  const player = useVideoPlayer(uploadedVideoSource({ url, poster, chatTitle: author }), (reproductor) => {
    reproductor.loop = false;
    // Pending 74: it keeps playing with the screen off or in another app, with its control in the notification; closing the viewer stops it.
    reproductor.staysActiveInBackground = true;
    reproductor.showNowPlayingNotification = true;
    reproductor.bufferOptions = { ...reproductor.bufferOptions, minBufferForPlayback: VIDEO_START_BUFFER_S };
    reproductor.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const loading = status === 'loading' || status === 'idle';

  return (
    <View style={{ flex: 1 }}>
    {loading && poster ? <Image source={{ uri: poster }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} contentFit="contain" /> : null}
    {loading ? <View pointerEvents="none" className="absolute inset-0 items-center justify-center"><ActivityIndicator size="large" color="#ffffff" /></View> : null}
    <VideoView
      testID="visor-video"
      style={{ flex: 1 }}
      player={player}
      nativeControls
      fullscreenOptions={{ enable: true }}
      // Sin esto, salir del visor con el video andando deja el audio sonando
      // por detrás de la conversación.
      allowsPictureInPicture={false}
      contentFit="contain"
    />
    </View>
  );
}

type VisorProps = {
  foto: FotoDelVisor | null;
  /** Todas las fotos del chat, de la MÁS VIEJA a la más nueva (como el chat). */
  otras?: FotoDelVisor[];
  onCerrar: () => void;
  onCambiar?: (foto: FotoDelVisor) => void;
  onDescargar?: (foto: FotoDelVisor) => void;
  onCompartir?: (foto: FotoDelVisor) => void;
  onEliminar?: (foto: FotoDelVisor) => void;
  /** Abrir un PDF —o lo que sea— con la app del teléfono que sepa hacerlo. */
  onAbrirArchivo?: (foto: FotoDelVisor) => void;
  /** A GIF of the chat becomes my animated sticker (pending 37); absent in a secret chat. */
  onMakeSticker?: (foto: FotoDelVisor) => void;
  /**
   * El resultado de descargar o compartir, mostrado ACÁ: un modal a pantalla
   * completa tapa cualquier aviso de la pantalla de abajo.
   */
  aviso?: string;
  /** A form's option seen here: «Elegir esta opción» (design h-03). */
  action?: { label: string; onPress: () => void };
};

export function VisorDeImagen(props: VisorProps) {
  const isOpen = props.foto !== null;
  // From the tap until the photo lands (plan 1, F0): the viewer measures its own opening.
  useEffect(() => {
    if (isOpen) beginInteraction(VIEWER_FRAME_WINDOW);
  }, [isOpen]);
  // Back plays the way out too: the body that owns it answers.
  const closeRef = useRef<(() => void) | null>(null);
  return (
    <Modal
      visible={isOpen}
      animationType="none"
      statusBarTranslucent
      fullWindow
      measured={false}
      onRequestClose={() => (closeRef.current ?? props.onCerrar)()}
      testID="visor-imagen"
    >
      {props.foto ? <ViewerBody {...props} foto={props.foto} closeRef={closeRef} /> : null}
    </Modal>
  );
}

/** Mounted with the layer: the opening starts on its first frame (in-window overlays mount a render later). */
function ViewerBody({
  foto,
  otras,
  onCerrar,
  onCambiar,
  onDescargar,
  onCompartir,
  onEliminar,
  onAbrirArchivo,
  onMakeSticker,
  aviso,
  action,
  closeRef,
}: VisorProps & { foto: FotoDelVisor; closeRef: MutableRefObject<(() => void) | null> }) {
  const margins = useMargenes();
  const { width, height } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const [barsShown, setBarsShown] = useState(true);
  const photos = otras && otras.length > 0 ? otras : [foto];
  const index = indiceDeFoto(photos, foto.seq);
  const { pager, onPageChange } = usePagerSync(index, onCambiar);
  const transition = useViewerTransition({ photo: foto, screen: { width, height }, onClosed: onCerrar });
  const { close: closeWith, drag } = transition;
  // A zoomed photo would jump back to full size before flying: it fades instead.
  const close = useCallback(() => closeWith({ fade: zoomed }), [closeWith, zoomed]);
  closeRef.current = close;
  useEffect(() => () => void (closeRef.current = null), [closeRef]);

  const renderPage = useCallback(
    ({ item, index: at }: { item: FotoDelVisor; index: number }) => (
      <Pagina
        foto={item}
        activa={at === index}
        ancho={width}
        alto={height}
        onZoom={setZoomed}
        onCerrar={close}
        onToque={() => setBarsShown((shown) => !shown)}
        onAbrirArchivo={onAbrirArchivo}
        drag={at === index ? drag : undefined}
      />
    ),
    [index, width, height, close, onAbrirArchivo, drag]
  );

  const inFlight = transition.flight !== null;
  const bars = barsShown && !inFlight;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View pointerEvents="none" style={[FILL, { backgroundColor: '#000000' }, transition.backdropStyle]} />
      <Animated.View style={[{ flex: 1 }, transition.fadeStyle]}>
        {/* While the copy flies the real pager waits underneath, already loading the full photo. */}
        <View style={{ flex: 1, opacity: inFlight ? 0 : 1 }}>
          <FlatList
            ref={pager}
            testID="visor-pager"
            data={photos}
            keyExtractor={(item) => String(item.seq)}
            renderItem={renderPage}
            horizontal
            pagingEnabled
            {...PAGER_WINDOW}
            scrollEnabled={!zoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
            onViewableItemsChanged={onPageChange}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            extraData={index}
          />
          {bars ? (
            <ViewerHeader photo={foto} position={photos.length > 1 ? `${index + 1} de ${photos.length} · ` : ''} top={margins.cabecera} onClose={close} actions={{ onMakeSticker, onDescargar, onCompartir, onEliminar }} />
          ) : null}
          <ViewerFooter photo={foto} photos={bars ? photos : []} bottom={margins.pie} notice={aviso} action={action} onPick={onCambiar} />
        </View>
      </Animated.View>
      {transition.flight ? <FlyingPhoto flight={transition.flight} progress={transition.progress} /> : null}
    </GestureHandlerRootView>
  );
}

/**
 * The pager and the strip agree on the photo in sight. A change from OUTSIDE
 * (the strip) moves the pager; one born from swiping is already in place.
 */
function usePagerSync(index: number, onPick: ((photo: FotoDelVisor) => void) | undefined) {
  const pager = useRef<FlatList<FotoDelVisor>>(null);
  const visibleIndex = useRef(index);
  useEffect(() => {
    if (index === visibleIndex.current) return;
    visibleIndex.current = index;
    pager.current?.scrollToIndex({ index, animated: false });
  }, [index]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onPageChange = useRef(({ viewableItems }: { viewableItems: ViewToken<FotoDelVisor>[] }) => {
    const visible = viewableItems[0];
    if (!visible || visible.index === null || visible.index === visibleIndex.current) return;
    visibleIndex.current = visible.index;
    onPickRef.current?.(visible.item);
  }).current;
  return { pager, onPageChange };
}

type HeaderActions = Pick<VisorProps, 'onMakeSticker' | 'onDescargar' | 'onCompartir' | 'onEliminar'>;

/** Floating header. Close never shrinks and is 44 px: a viewer with no visible way out leaves only the hardware button. */
function ViewerHeader(props: { photo: FotoDelVisor; position: string; top: number; onClose: () => void; actions: HeaderActions }) {
  const { photo, actions } = props;
  return (
    <Animated.View entering={FadeIn.duration(BARS_FADE_MS)} exiting={FadeOut.duration(BARS_FADE_MS)} style={{ paddingTop: props.top, backgroundColor: 'rgba(0,0,0,0.45)' }} className="absolute left-0 right-0 top-0 flex-row items-center gap-2 px-2 pb-2">
      <Pressable testID="btn-cerrar-visor" accessibilityLabel="Cerrar la imagen" onPress={props.onClose} className="h-11 w-11 shrink-0 items-center justify-center">
        <X size={24} color="#ffffff" />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} style={{ color: '#ffffff' }} className="text-base font-semibold" testID="visor-autor">
          {photo.autor}
        </Text>
        <Text style={{ color: '#c9c9c9' }} className="text-[11px]">
          {props.position}
          {photo.cuando}
        </Text>
      </View>
      {actions.onMakeSticker && photo.mime === 'image/gif' ? <HeaderButton testID="btn-gif-a-sticker" label="Convertir en sticker animado" onPress={() => actions.onMakeSticker?.(photo)} icon={<Sticker size={21} color="#ffffff" />} /> : null}
      {actions.onDescargar ? <HeaderButton testID="btn-descargar-foto" label="Descargar" onPress={() => actions.onDescargar?.(photo)} icon={<Download size={21} color="#ffffff" />} /> : null}
      {actions.onCompartir ? <HeaderButton testID="btn-compartir-foto" label="Compartir" onPress={() => actions.onCompartir?.(photo)} icon={<Share2 size={20} color="#ffffff" />} /> : null}
      {/* Delete ONLY when it is mine: the server refuses to delete someone else's. */}
      {photo.mia && actions.onEliminar ? <HeaderButton testID="btn-eliminar-foto" label="Eliminar" onPress={() => actions.onEliminar?.(photo)} icon={<Trash2 size={20} color="#ff6b6b" />} /> : null}
    </Animated.View>
  );
}

function HeaderButton(props: { testID: string; label: string; onPress: () => void; icon: ReactNode }) {
  return (
    <Pressable testID={props.testID} accessibilityLabel={props.label} onPress={props.onPress} className="h-11 w-11 shrink-0 items-center justify-center">
      {props.icon}
    </Pressable>
  );
}

/** The notice, the form's option and «shared in the chat» (jump between photos without closing). `photos` empty = no strip. */
function ViewerFooter(props: { photo: FotoDelVisor; photos: FotoDelVisor[]; bottom: number; notice?: string; action?: VisorProps['action']; onPick?: (photo: FotoDelVisor) => void }) {
  const { photo, action } = props;
  return (
    <View className="absolute bottom-0 left-0 right-0" style={{ paddingBottom: props.bottom }}>
      {props.notice ? (
        <View className="items-center px-4 pb-2">
          <Text testID="aviso-visor" style={{ color: '#ffffff' }} className="rounded-full bg-black/70 px-4 py-2 text-sm">
            {props.notice}
          </Text>
        </View>
      ) : null}
      {action ? (
        <View className="items-center px-4 pb-3">
          <Pressable testID="visor-accion" onPress={action.onPress} className="h-12 items-center justify-center rounded-full bg-white px-6">
            <Text style={{ color: '#000000' }} className="text-[15px] font-semibold">{action.label}</Text>
          </Pressable>
        </View>
      ) : null}
      {props.photos.length > 1 ? (
        <Animated.View entering={FadeIn.duration(BARS_FADE_MS)} exiting={FadeOut.duration(BARS_FADE_MS)} style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} className="pt-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pb-2">
            {props.photos.map((other) => (
              <Pressable key={other.seq} testID={`visor-tira-${other.seq}`} onPress={() => props.onPick?.(other)} className="mr-2 overflow-hidden rounded" style={{ opacity: other.seq === photo.seq ? 1 : 0.5 }}>
                {other.miniatura ? (
                  <Image source={{ uri: other.miniatura }} style={{ width: 52, height: 52 }} contentFit="cover" recyclingKey={String(other.seq)} />
                ) : (
                  <View style={{ width: 52, height: 52 }} className="items-center justify-center bg-white/10">
                    <FileText size={20} color="#ffffff" />
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Una página del pager: foto con gestos, video, o documento que se abre afuera. */
function Pagina(props: {
  foto: FotoDelVisor;
  activa: boolean;
  ancho: number;
  alto: number;
  onZoom: (conZoom: boolean) => void;
  onCerrar: () => void;
  onToque: () => void;
  onAbrirArchivo?: (foto: FotoDelVisor) => void;
  /** The viewer's drag, on the page in sight only: the black behind follows it. */
  drag?: SharedValue<number>;
}) {
  const { foto, ancho, alto } = props;
  if (esArchivoSuelto(foto.mime)) {
    // Un PDF no se dibuja acá: se abre con la app que lo sabe abrir. Meter un
    // motor de PDF pesaría más que toda la app (José, 30/08/2026).
    return (
      <View style={{ width: ancho, height: alto }} className="items-center justify-center px-8">
        <View className="h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
          <FileText size={36} color="#ffffff" />
        </View>
        <Text testID="visor-nombre-archivo" style={{ color: '#ffffff' }} className="mt-4 text-center text-base font-semibold" numberOfLines={3}>
          {foto.nombre ? nombreLimpio(foto.nombre) : 'Archivo'}
        </Text>
        <Text style={{ color: '#c9c9c9' }} className="mt-1 text-center text-[12px]">
          Se abre con otra app del teléfono
        </Text>
        {props.onAbrirArchivo ? (
          <Pressable testID="btn-abrir-archivo" onPress={() => props.onAbrirArchivo?.(foto)} className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-white px-8">
            <Text className="text-[15px] font-bold text-black">Abrir</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (esVideo(foto.mime)) {
    // Un solo reproductor vivo: el de la página que se ve. Las demás muestran
    // la portada; si no, deslizar dejaba videos sonando fuera de pantalla.
    return (
      <View style={{ width: ancho, height: alto }} className="justify-center">
        {props.activa ? (
          <Reproductor key={foto.url} url={foto.url} poster={foto.miniatura} author={foto.autor} />
        ) : (
          <View className="flex-1 items-center justify-center">
            {foto.miniatura ? <Image source={{ uri: foto.miniatura }} style={{ position: 'absolute', width: ancho, height: alto }} contentFit="contain" /> : null}
            <View className="h-16 w-16 items-center justify-center rounded-full bg-black/50">
              <Play size={28} color="#ffffff" />
            </View>
          </View>
        )}
      </View>
    );
  }
  return (
    <PaginaDelVisor
      // What I just sent opens from its copy on the phone (no download); the rest starts on the bubble's thumbnail.
      url={(foto.clientKey && copiaLocalDe(foto.clientKey)) || foto.url}
      placeholder={foto.miniatura}
      activa={props.activa}
      ancho={ancho}
      alto={alto}
      onZoom={props.onZoom}
      onCerrar={props.onCerrar}
      onToque={props.onToque}
      drag={props.drag}
    />
  );
}
