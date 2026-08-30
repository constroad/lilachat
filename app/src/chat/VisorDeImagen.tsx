import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download, FileText, Share2, Trash2, X } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';

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
 */
function Reproductor({ url }: { url: string }) {
  const player = useVideoPlayer(url, (reproductor) => {
    reproductor.loop = false;
    reproductor.play();
  });

  return (
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
  /** El resto de fotos del chat, para la tira de abajo. */
  otras?: FotoDelVisor[];
  onCerrar: () => void;
  onCambiar?: (foto: FotoDelVisor) => void;
  onDescargar?: (foto: FotoDelVisor) => void;
  onCompartir?: (foto: FotoDelVisor) => void;
  onEliminar?: (foto: FotoDelVisor) => void;
  /** Abrir un PDF —o lo que sea— con la app del teléfono que sepa hacerlo. */
  onAbrirArchivo?: (foto: FotoDelVisor) => void;
  /**
   * El resultado de descargar o compartir, mostrado ACÁ.
   *
   * Estaba en la pantalla del chat, o sea **detrás del visor**: la acción se
   * hacía, fallaba, y la persona no veía nada. El resultado de una acción tiene
   * que verse en la superficie donde se hizo — un modal a pantalla completa tapa
   * cualquier aviso de abajo.
   */
  aviso?: string;
}) {
  const margenes = useMargenes();

  return (
    <Modal
      visible={Boolean(foto)}
      animationType="fade"
      // El botón ATRÁS de Android cierra el visor: sin esto cerraría la app.
      onRequestClose={onCerrar}
      testID="visor-imagen"
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/**
         * Cabecera. El cierre NUNCA se comprime y tiene 44 px de área táctil: un
         * visor a pantalla completa sin salida visible deja como única opción el
         * botón físico, y quien no lo piense cree que la app se colgó.
         */}
        <View
          style={{ paddingTop: margenes.cabecera }}
          className="flex-row items-center gap-2 px-2 pb-2"
        >
          <Pressable
            testID="btn-cerrar-visor"
            accessibilityLabel="Cerrar la imagen"
            onPress={onCerrar}
            className="h-11 w-11 shrink-0 items-center justify-center"
          >
            <X size={24} color="#ffffff" />
          </Pressable>

          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} style={{ color: '#ffffff' }} className="text-base font-semibold">
              {foto?.autor ?? ''}
            </Text>
            <Text style={{ color: '#c9c9c9' }} className="text-[11px]">
              {foto?.cuando ?? ''}
            </Text>
          </View>

          {/* Las acciones ceden espacio antes que el cierre, y por eso van
              después: si algo tiene que salirse de la pantalla, que sea esto. */}
          {foto && onDescargar ? (
            <Pressable
              testID="btn-descargar-foto"
              accessibilityLabel="Descargar"
              onPress={() => onDescargar(foto)}
              className="h-11 w-11 shrink-0 items-center justify-center"
            >
              <Download size={21} color="#ffffff" />
            </Pressable>
          ) : null}
          {foto && onCompartir ? (
            <Pressable
              testID="btn-compartir-foto"
              accessibilityLabel="Compartir"
              onPress={() => onCompartir(foto)}
              className="h-11 w-11 shrink-0 items-center justify-center"
            >
              <Share2 size={20} color="#ffffff" />
            </Pressable>
          ) : null}
          {/* Eliminar SOLO si es mía: el server rechaza borrar lo ajeno, así que
              ofrecerlo sería prometer algo que va a fallar. */}
          {foto?.mia && onEliminar ? (
            <Pressable
              testID="btn-eliminar-foto"
              accessibilityLabel="Eliminar"
              onPress={() => onEliminar(foto)}
              className="h-11 w-11 shrink-0 items-center justify-center"
            >
              <Trash2 size={20} color="#ff6b6b" />
            </Pressable>
          ) : null}
        </View>

        {foto && esArchivoSuelto(foto.mime) ? (
          /**
           * Un PDF no se dibuja acá: se abre con la app que lo sabe abrir.
           *
           * Antes el visor le pasaba la URL del PDF a un `<Image>` y quedaba una
           * pantalla NEGRA sin explicación (José, 30/08/2026: «toco el archivo y
           * no pasa nada»). Meter un motor de PDF pesaría más que toda la app, y
           * el teléfono ya tiene uno.
           */
          <View className="flex-1 items-center justify-center px-8">
            <View className="h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
              <FileText size={36} color="#ffffff" />
            </View>
            <Text
              testID="visor-nombre-archivo"
              style={{ color: '#ffffff' }}
              className="mt-4 text-center text-base font-semibold"
              numberOfLines={3}
            >
              {foto.nombre ?? 'Archivo'}
            </Text>
            <Text style={{ color: '#c9c9c9' }} className="mt-1 text-center text-[12px]">
              Se abre con otra app del teléfono
            </Text>
            {onAbrirArchivo ? (
              <Pressable
                testID="btn-abrir-archivo"
                onPress={() => onAbrirArchivo(foto)}
                className="mt-6 min-h-[48px] items-center justify-center rounded-xl bg-white px-8"
              >
                <Text className="text-[15px] font-bold text-black">Abrir</Text>
              </Pressable>
            ) : null}
          </View>
        ) : foto && esVideo(foto.mime) ? (
          // El visor abría el video como si fuera una foto: se veía el primer
          // cuadro congelado y no pasaba nada al tocarlo (José, 30/08/2026).
          <Reproductor key={foto.url} url={foto.url} />
        ) : foto ? (
          <Image
            source={{ uri: foto.url }}
            style={{ flex: 1 }}
            // `contain` y no `cover`: recortar una foto de obra puede dejar
            // afuera justo el dato que se fue a mirar.
            contentFit="contain"
            transition={120}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#ffffff' }}>No se pudo cargar la imagen</Text>
          </View>
        )}

        {aviso ? (
          <View className="items-center px-4 pb-2">
            <Text
              testID="aviso-visor"
              style={{ color: '#ffffff' }}
              className="rounded-full bg-black/70 px-4 py-2 text-sm"
            >
              {aviso}
            </Text>
          </View>
        ) : null}

        {/**
         * «Compartido en el chat» — la tira del diseño. Deja saltar entre fotos
         * sin cerrar el visor, que es lo que uno hace cuando busca una foto vieja
         * y no recuerda cuál era.
         */}
        {otras && otras.length > 1 ? (
          <View style={{ paddingBottom: margenes.pie }}>
            <Text style={{ color: '#c9c9c9' }} className="px-4 pb-2 text-[11px] uppercase">
              Compartido en el chat
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pb-2">
              {otras.map((otra) => (
                <Pressable
                  key={otra.seq}
                  testID={`visor-tira-${otra.seq}`}
                  onPress={() => onCambiar?.(otra)}
                  className="mr-2 overflow-hidden rounded"
                  style={{ opacity: otra.seq === foto?.seq ? 1 : 0.5 }}
                >
                  <Image
                    source={{ uri: otra.url }}
                    style={{ width: 52, height: 52 }}
                    contentFit="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
