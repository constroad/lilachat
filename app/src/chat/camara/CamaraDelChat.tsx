import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, type CameraCapturedPicture } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { Image as IconoDeImagen, RefreshCcw, X, Zap, ZapOff } from 'lucide-react-native';
import { useMargenes } from '../../ui/useMargenes';
import { reportarError } from '../../ui/reportarError';
import type { FotoAEnviar, FotoElegida } from '../envioDeFotos';
import { EnviarFotos } from '../EnviarFotos';

/** Cuántas fotos recientes muestra la tira (solo si ya hay permiso de la galería). */
const RECIENTES = 12;
const MINIATURA = 56;
const DISPARADOR = 76;
type Flash = 'off' | 'on' | 'auto';
const SIGUIENTE_FLASH: Record<Flash, Flash> = { auto: 'on', on: 'off', off: 'auto' };
const ETIQUETA_FLASH: Record<Flash, string> = { auto: 'Auto', on: 'Sí', off: 'No' };

/**
 * La cámara propia del chat (José, 20/10: «al tomar una foto demora unos
 * segundos en aparecer; en WhatsApp no»; diseño `f2-app-camara`). Antes se
 * abría la cámara del sistema: arrancarla, confirmar la foto y volver costaba
 * segundos. Acá la vista está lista al abrir, el disparo destella al instante
 * y «Enviar» se abre encima apenas se captura (`onPictureSaved`). La tira de
 * recientes aparece solo si la galería ya tiene permiso: no se pide otro más.
 */
export function CamaraDelChat(props: { visible: boolean; nombreDelChat: string; onEnviar: (fotos: FotoAEnviar[], opciones: { hd: boolean }) => void; onGaleria: () => void; onCerrar: () => void }) {
  const margenes = useMargenes();
  const camara = useRef<CameraView>(null);
  const destello = useRef(new Animated.Value(0)).current;
  const [frontal, setFrontal] = useState(false);
  const [flash, setFlash] = useState<Flash>('auto');
  const [disparando, setDisparando] = useState(false);
  const [recientes, setRecientes] = useState<MediaLibrary.Asset[]>([]);
  /** La foto recién tomada: «Enviar» se abre ENCIMA, en esta misma pantalla (dos modales no se apilan bien en Android). */
  const [tomada, setTomada] = useState<FotoElegida | null>(null);
  const alTomar = (foto: FotoElegida) => {
    setTomada(foto);
  };

  useEffect(() => {
    if (!props.visible) return;
    setDisparando(false);
    setTomada(null);
    void cargarRecientes().then(setRecientes);
  }, [props.visible]);

  const disparar = async () => {
    if (disparando || !camara.current) return;
    setDisparando(true);
    Animated.sequence([Animated.timing(destello, { toValue: 1, duration: 60, useNativeDriver: true }), Animated.timing(destello, { toValue: 0, duration: 180, useNativeDriver: true })]).start();
    try {
      await camara.current.takePictureAsync({ quality: 0.9, onPictureSaved: (foto: CameraCapturedPicture) => alTomar(aFotoElegida(foto)) });
    } catch (error) {
      reportarError('CamaraDelChat.disparar', error);
      setDisparando(false);
    }
  };

  return (
    <Modal visible={props.visible} animationType="fade" onRequestClose={() => (tomada ? (setTomada(null), setDisparando(false)) : props.onCerrar())} statusBarTranslucent>
      <View testID="camara-del-chat" className="flex-1 bg-black">
        {props.visible ? <CameraView ref={camara} style={{ flex: 1 }} facing={frontal ? 'front' : 'back'} flash={flash} active={!tomada} /> : null}
        {/* Mientras captura, la vista de la cámara se vuelve transparente (deja ver el chat de atrás): negro hasta que entra «Enviar». */}
        {disparando || tomada ? <View pointerEvents="none" className="absolute inset-0 bg-black" /> : null}
        <Animated.View pointerEvents="none" className="absolute inset-0 bg-white" style={{ opacity: destello }} />

        <View className="absolute left-0 right-0 top-0 items-center" style={{ paddingTop: margenes.cabecera }}>
          <View className="w-full flex-row items-center justify-between px-3">
            <Pressable testID="btn-cerrar-camara" accessibilityLabel="Cerrar la cámara" onPress={props.onCerrar} className="h-11 w-11 items-center justify-center rounded-full bg-black/40">
              <X size={24} color="white" />
            </Pressable>
            <Pressable testID="btn-flash" accessibilityLabel={`Flash: ${ETIQUETA_FLASH[flash]}`} onPress={() => setFlash((antes) => SIGUIENTE_FLASH[antes])} className="h-11 flex-row items-center gap-1.5 rounded-full bg-black/40 px-3">
              {flash === 'off' ? <ZapOff size={20} color="white" /> : <Zap size={20} color="white" />}
              <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>{ETIQUETA_FLASH[flash]}</Text>
            </Pressable>
          </View>
          <Text className="mt-2 rounded-full bg-black/40 px-3 py-1 text-[13px]" style={{ color: 'white' }} numberOfLines={1}>
            Para: {props.nombreDelChat}
          </Text>
        </View>

        <View className="absolute bottom-0 left-0 right-0 bg-black/55 pt-3" style={{ paddingBottom: margenes.pie + 12 }}>
          {recientes.length ? (
            <FlatList
              horizontal
              data={recientes}
              keyExtractor={(foto) => foto.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
              renderItem={({ item }) => (
                <Pressable testID={`reciente-${item.id}`} onPress={() => alTomar({ uri: item.uri, fileName: item.filename, mimeType: 'image/jpeg', width: item.width, height: item.height })}>
                  <Image source={{ uri: item.uri }} style={{ width: MINIATURA, height: MINIATURA, borderRadius: 10 }} contentFit="cover" />
                </Pressable>
              )}
            />
          ) : null}
          <View className="flex-row items-center justify-around">
            <Pressable testID="btn-galeria-camara" accessibilityLabel="Elegir de la galería" onPress={props.onGaleria} className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <IconoDeImagen size={22} color="white" />
            </Pressable>
            <Pressable testID="btn-disparar" accessibilityLabel="Tomar la foto" disabled={disparando} onPress={() => void disparar()} className="items-center justify-center rounded-full border-4 border-white" style={{ width: DISPARADOR, height: DISPARADOR }}>
              <View className={`rounded-full bg-white ${disparando ? 'opacity-60' : ''}`} style={{ width: DISPARADOR - 16, height: DISPARADOR - 16 }} />
            </Pressable>
            <Pressable testID="btn-girar-camara" accessibilityLabel="Girar la cámara" onPress={() => setFrontal((antes) => !antes)} className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <RefreshCcw size={22} color="white" />
            </Pressable>
          </View>
          <Text className="mt-3 text-center text-[13px]" style={{ color: 'white' }}>Toca para foto</Text>
        </View>
        <EnviarFotos
          embebido
          fotos={tomada ? [tomada] : []}
          onCancelar={() => {
            setTomada(null);
            setDisparando(false);
          }}
          onEnviar={(fotos, opciones) => {
            props.onEnviar(fotos, opciones);
            props.onCerrar();
          }}
        />
      </View>
    </Modal>
  );
}

function aFotoElegida(foto: CameraCapturedPicture): FotoElegida {
  return { uri: foto.uri, fileName: `foto-${Date.now()}.jpg`, mimeType: 'image/jpeg', width: foto.width, height: foto.height };
}

/** Las últimas fotos de la galería, SOLO si ya hay permiso (la cámara no pide otro). */
async function cargarRecientes(): Promise<MediaLibrary.Asset[]> {
  try {
    const permiso = await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (!permiso.granted) return [];
    const pagina = await MediaLibrary.getAssetsAsync({ first: RECIENTES, mediaType: MediaLibrary.MediaType.photo, sortBy: [[MediaLibrary.SortBy.creationTime, false]] });
    return pagina.assets;
  } catch (error) {
    reportarError('CamaraDelChat.recientes', error);
    return [];
  }
}
