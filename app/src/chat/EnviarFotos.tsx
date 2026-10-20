import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { Image } from 'expo-image';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Send, Video, X } from 'lucide-react-native';
import { armarEnvioDeFotos, quitarFoto, type FotoAEnviar, type FotoElegida } from './envioDeFotos';
import { useMargenes } from '../ui/useMargenes';
import { useColores } from '../ui/tema';

/**
 * Antes de mandar fotos: verlas, sacar alguna y ponerle su pie a cada una,
 * como WhatsApp (FL9b; auditoría §46.2: se mandaba una sola, sin ver y sin pie).
 * El pie viaja con ella. La foto se comprime como en WhatsApp (José, 19/10);
 * «HD» la manda original.
 */
export function EnviarFotos(props: {
  fotos: FotoElegida[];
  onCancelar: () => void;
  onEnviar: (fotos: FotoAEnviar[], opciones: { hd: boolean }) => void;
  /** Dentro de la cámara (20/10): sin su propio modal, encima de la vista, como WhatsApp. */
  embebido?: boolean;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [fotos, setFotos] = useState(props.fotos);
  const [actual, setActual] = useState(0);
  const [pies, setPies] = useState<Record<string, string>>({});
  /** Mandar la original, sin achicar (como el «HD» de WhatsApp). */
  const [hd, setHd] = useState(false);

  // Cada vez que se abre con fotos nuevas, arranca de cero.
  useEffect(() => {
    setFotos(props.fotos);
    setActual(0);
    setPies({});
    setHd(false);
  }, [props.fotos]);

  const vista = fotos[actual];
  const esVideo = (foto?: FotoElegida) => Boolean(foto?.mimeType?.startsWith('video/'));

  const quitar = (indice: number) => {
    const resultado = quitarFoto(fotos, indice, actual);
    if (resultado.fotos.length === 0) return props.onCancelar();
    setFotos(resultado.fotos);
    setActual(resultado.actual);
  };

  // Con el teclado abierto el campo del pie sube con él, como en el chat.
  const contenido = (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black" testID="pantalla-enviar-fotos">
      <View className="flex-row items-center px-3 pb-2" style={{ paddingTop: margenes.cabecera }}>
        <Pressable testID="btn-cancelar-fotos" accessibilityLabel="Cancelar" onPress={props.onCancelar} className="h-11 w-11 items-center justify-center">
          <X size={24} color="white" />
        </Pressable>
        <Text className="flex-1 text-base font-semibold" style={{ color: 'white' }}>
          {fotos.length === 1 ? '1 foto' : `${fotos.length} fotos`}
        </Text>
        <Pressable
          testID="btn-hd"
          accessibilityRole="switch"
          accessibilityState={{ checked: hd }}
          accessibilityLabel={hd ? 'Calidad HD: se manda la original' : 'Calidad estándar: se manda más liviana'}
          onPress={() => setHd((antes) => !antes)}
          className="h-11 min-w-[44px] items-center justify-center px-2"
        >
          <Text
            className="rounded-md border-2 px-1.5 text-[13px] font-bold"
            style={{ color: hd ? colores.primary : 'white', borderColor: hd ? colores.primary : 'white' }}
          >
            HD
          </Text>
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center">
        {vista && !esVideo(vista) ? (
          <Image source={{ uri: vista.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <Video size={64} color="white" />
        )}
      </View>

      {fotos.length > 1 ? (
        <FlatList
          horizontal
          // Sin esto la tira horizontal se estira a todo el alto que sobra y
          // achica la foto principal (visto en el E2E).
          style={{ flexGrow: 0 }}
          data={fotos}
          keyExtractor={(foto) => foto.uri}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
          renderItem={({ item, index }) => (
            <Pressable
              testID={`miniatura-${index}`}
              onPress={() => setActual(index)}
              style={{ borderWidth: 2, borderColor: index === actual ? colores.primary : 'transparent', borderRadius: 8 }}
            >
              {esVideo(item) ? (
                <View className="h-14 w-14 items-center justify-center rounded-md bg-white/10">
                  <Video size={20} color="white" />
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={{ width: 56, height: 56, borderRadius: 6 }} contentFit="cover" />
              )}
              <Pressable
                testID={`quitar-foto-${index}`}
                // 24 dp de dibujo, 44 de toque.
                hitSlop={10}
                accessibilityLabel="Sacar esta foto"
                onPress={() => quitar(index)}
                className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-black/80"
              >
                <X size={12} color="white" />
              </Pressable>
            </Pressable>
          )}
        />
      ) : null}

      <View className="flex-row items-end gap-2 px-3 pt-2" style={{ paddingBottom: margenes.pie + 8 }}>
        <TextInput
          testID="input-pie-de-foto"
          value={vista ? (pies[vista.uri] ?? '') : ''}
          onChangeText={(texto) => vista && setPies((actuales) => ({ ...actuales, [vista.uri]: texto }))}
          placeholder="Añade un comentario…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          multiline
          className="min-h-[44px] flex-1 rounded-3xl bg-white/15 px-4 py-2.5 text-[15px]"
          style={{ color: 'white' }}
        />
        <Pressable
          testID="btn-enviar-fotos"
          accessibilityLabel="Enviar"
          onPress={() => props.onEnviar(armarEnvioDeFotos(fotos, pies), { hd })}
          className="h-12 w-12 items-center justify-center rounded-full bg-primary"
        >
          <Send size={20} color={colores['on-primary']} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
  if (props.embebido) return props.fotos.length > 0 ? <View className="absolute inset-0">{contenido}</View> : null;
  return (
    // Fundido y no deslizamiento (20/10): desde la cámara, la foto aparece en el acto.
    <Modal visible={props.fotos.length > 0} animationType="fade" onRequestClose={props.onCancelar}>
      {contenido}
    </Modal>
  );
}
