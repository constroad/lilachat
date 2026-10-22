import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ViewToken, useWindowDimensions } from 'react-native';
import { Modal } from '../ui/Modal';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { FlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Download, FileText, Play, Share2, Trash2, X } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';
import { nombreLimpio } from './archivoDescargado';
import { PaginaDelVisor } from './PaginaDelVisor';
import { indiceDeFoto } from './visor';
import { useEvent } from 'expo';

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
 * **Y arranca pronto** (José, 21/10: «carga y luego reproduce; WhatsApp
 * reproduce al toque»): empieza con medio segundo de búfer y no con los dos
 * que espera Android, y mientras tanto se ve la portada con un indicador, no
 * una pantalla negra.
 */
function Reproductor({ url, poster }: { url: string; poster?: string }) {
  const player = useVideoPlayer(url, (reproductor) => {
    reproductor.loop = false;
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

export function VisorDeImagen({
  foto,
  otras,
  onCerrar,
  onCambiar,
  onDescargar,
  onCompartir,
  onEliminar,
  onAbrirArchivo,
  aviso,
}: {
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
  /**
   * El resultado de descargar o compartir, mostrado ACÁ: un modal a pantalla
   * completa tapa cualquier aviso de la pantalla de abajo.
   */
  aviso?: string;
}) {
  const margenes = useMargenes();
  const { width: ancho, height: alto } = useWindowDimensions();
  const pager = useRef<FlatList<FotoDelVisor>>(null);
  const [conZoom, setConZoom] = useState(false);
  const [conBarras, setConBarras] = useState(true);
  const lista = otras && otras.length > 0 ? otras : foto ? [foto] : [];
  const indice = foto ? indiceDeFoto(lista, foto.seq) : 0;
  const indiceVisible = useRef(indice);

  // Al abrir, con las barras a la vista.
  const abierto = foto !== null;
  useEffect(() => {
    if (abierto) setConBarras(true);
  }, [abierto]);

  // Un cambio que viene de AFUERA (la tira) mueve el pager; uno que nació de
  // deslizar ya está en su lugar y no se toca.
  useEffect(() => {
    if (!foto || indice === indiceVisible.current) return;
    indiceVisible.current = indice;
    pager.current?.scrollToIndex({ index: indice, animated: false });
  }, [foto, indice]);

  const onCambiarRef = useRef(onCambiar);
  onCambiarRef.current = onCambiar;
  const alCambiarDePagina = useRef(({ viewableItems }: { viewableItems: ViewToken<FotoDelVisor>[] }) => {
    const visible = viewableItems[0];
    if (!visible || visible.index === null || visible.index === indiceVisible.current) return;
    indiceVisible.current = visible.index;
    onCambiarRef.current?.(visible.item);
  }).current;

  const dibujar = useCallback(
    ({ item, index }: { item: FotoDelVisor; index: number }) => (
      <Pagina
        foto={item}
        activa={index === indice}
        ancho={ancho}
        alto={alto}
        onZoom={setConZoom}
        onCerrar={onCerrar}
        onToque={() => setConBarras((v) => !v)}
        onAbrirArchivo={onAbrirArchivo}
      />
    ),
    [indice, ancho, alto, onCerrar, onAbrirArchivo]
  );

  return (
    <Modal visible={Boolean(foto)} animationType="fade" statusBarTranslucent onRequestClose={onCerrar} testID="visor-imagen">
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000000' }}>
        {foto ? (
          <FlatList
            ref={pager}
            testID="visor-pager"
            data={lista}
            keyExtractor={(item) => String(item.seq)}
            renderItem={dibujar}
            horizontal
            pagingEnabled
            scrollEnabled={!conZoom}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={indice}
            getItemLayout={(_, i) => ({ length: ancho, offset: ancho * i, index: i })}
            onViewableItemsChanged={alCambiarDePagina}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            windowSize={3}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            extraData={indice}
          />
        ) : null}

        {/* Cabecera flotante. El cierre NUNCA se comprime y tiene 44 px: un
            visor sin salida visible deja como única opción el botón físico. */}
        {conBarras && foto ? (
          <View style={{ paddingTop: margenes.cabecera, backgroundColor: 'rgba(0,0,0,0.45)' }} className="absolute left-0 right-0 top-0 flex-row items-center gap-2 px-2 pb-2">
            <Pressable testID="btn-cerrar-visor" accessibilityLabel="Cerrar la imagen" onPress={onCerrar} className="h-11 w-11 shrink-0 items-center justify-center">
              <X size={24} color="#ffffff" />
            </Pressable>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} style={{ color: '#ffffff' }} className="text-base font-semibold" testID="visor-autor">
                {foto.autor}
              </Text>
              <Text style={{ color: '#c9c9c9' }} className="text-[11px]">
                {lista.length > 1 ? `${indice + 1} de ${lista.length} · ${foto.cuando}` : foto.cuando}
              </Text>
            </View>
            {onDescargar ? (
              <Pressable testID="btn-descargar-foto" accessibilityLabel="Descargar" onPress={() => onDescargar(foto)} className="h-11 w-11 shrink-0 items-center justify-center">
                <Download size={21} color="#ffffff" />
              </Pressable>
            ) : null}
            {onCompartir ? (
              <Pressable testID="btn-compartir-foto" accessibilityLabel="Compartir" onPress={() => onCompartir(foto)} className="h-11 w-11 shrink-0 items-center justify-center">
                <Share2 size={20} color="#ffffff" />
              </Pressable>
            ) : null}
            {/* Eliminar SOLO si es mía: el server rechaza borrar lo ajeno. */}
            {foto.mia && onEliminar ? (
              <Pressable testID="btn-eliminar-foto" accessibilityLabel="Eliminar" onPress={() => onEliminar(foto)} className="h-11 w-11 shrink-0 items-center justify-center">
                <Trash2 size={20} color="#ff6b6b" />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View className="absolute bottom-0 left-0 right-0" style={{ paddingBottom: margenes.pie }}>
          {aviso ? (
            <View className="items-center px-4 pb-2">
              <Text testID="aviso-visor" style={{ color: '#ffffff' }} className="rounded-full bg-black/70 px-4 py-2 text-sm">
                {aviso}
              </Text>
            </View>
          ) : null}

          {/* «Compartido en el chat»: saltar entre fotos sin cerrar el visor. */}
          {conBarras && lista.length > 1 ? (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.45)' }} className="pt-2">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pb-2">
                {lista.map((otra) => (
                  <Pressable
                    key={otra.seq}
                    testID={`visor-tira-${otra.seq}`}
                    onPress={() => onCambiar?.(otra)}
                    className="mr-2 overflow-hidden rounded"
                    style={{ opacity: otra.seq === foto?.seq ? 1 : 0.5 }}
                  >
                    {otra.miniatura ? (
                      <Image source={{ uri: otra.miniatura }} style={{ width: 52, height: 52 }} contentFit="cover" recyclingKey={String(otra.seq)} />
                    ) : (
                      <View style={{ width: 52, height: 52 }} className="items-center justify-center bg-white/10">
                        <FileText size={20} color="#ffffff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
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
          <Reproductor key={foto.url} url={foto.url} poster={foto.miniatura} />
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
      url={foto.url}
      activa={props.activa}
      ancho={ancho}
      alto={alto}
      onZoom={props.onZoom}
      onCerrar={props.onCerrar}
      onToque={props.onToque}
    />
  );
}
