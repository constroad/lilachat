import { Pressable, Text, TextInput, ToastAndroid, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Copy, Link2, Search, Share2, UserPlus } from 'lucide-react-native';
import { ENLACE_DE_DESCARGA } from '@lilachat/shared';
import { useColores } from '../ui/tema';

/** El enlace como se lee: sin `https://`, que no aporta y se corta. */
const ENLACE_VISIBLE = ENLACE_DE_DESCARGA.replace(/^https?:\/\//, '');

/**
 * Lo de arriba de la lista de invitar (FL13, diseño `invitar-amigos`): qué
 * pasa al invitar, el enlace para copiar o compartir por otra app, el buscador
 * y el rótulo de la agenda. Va como cabecera de la lista para que scrollee con
 * ella y el buscador no se desmonte cuando nadie coincide.
 */
export function CabeceraDeInvitar(props: {
  /** `null` mientras la agenda no está lista: sin buscador ni cuenta. */
  porInvitar: number | null;
  consulta: string;
  onConsulta: (texto: string) => void;
  onCompartir: () => void;
}) {
  const colores = useColores();
  const copiar = () => void Clipboard.setStringAsync(ENLACE_DE_DESCARGA).then(() => ToastAndroid.show('Enlace copiado', ToastAndroid.SHORT));
  return (
    <View className="pb-2">
      <View className="items-center rounded-3xl bg-primary px-6 py-7">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-on-primary/15">
          <UserPlus size={26} color={colores['on-primary']} />
        </View>
        <Text className="mt-3 text-xl font-bold text-on-primary">Invita a tu gente</Text>
        <Text className="mt-1 text-center text-sm leading-5 text-on-primary/80">
          Se abre WhatsApp con el mensaje listo y el enlace para descargar Lilachat.
        </Text>
      </View>

      <View className="mt-3 rounded-2xl border border-outline/10 bg-surface p-4">
        <Text className="text-[13px] font-semibold text-on-surface">Comparte tu enlace</Text>
        <View className="mt-3 min-h-[48px] flex-row items-center gap-2 rounded-xl bg-surface-variant pl-3">
          <Link2 size={16} color={colores['on-surface-variant']} />
          <Text testID="enlace-de-descarga" className="min-w-0 flex-1 text-sm text-on-surface-variant" numberOfLines={1}>
            {ENLACE_VISIBLE}
          </Text>
          <Pressable testID="btn-copiar-enlace" accessibilityLabel="Copiar el enlace" onPress={copiar} className="h-12 w-12 items-center justify-center">
            <Copy size={18} color={colores.primary} />
          </Pressable>
        </View>
        <Pressable
          testID="btn-compartir-enlace"
          onPress={props.onCompartir}
          className="mt-3 min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary/10"
        >
          <Share2 size={18} color={colores.primary} />
          <Text className="text-[15px] font-semibold text-primary">Compartir por otra app</Text>
        </Pressable>
      </View>


      {props.porInvitar !== null ? (
        <>
          <View className="mt-5 min-h-[48px] flex-row items-center gap-2 rounded-full bg-surface px-4">
            <Search size={18} color={colores.primary} />
            <TextInput
              testID="buscar-contacto-telefono"
              value={props.consulta}
              onChangeText={props.onConsulta}
              placeholder="Buscar en tu agenda"
              placeholderTextColor={colores['on-surface-variant']}
              className="min-h-[48px] min-w-0 flex-1 text-[15px] text-on-surface"
            />
          </View>
          <View className="mb-2 mt-6 flex-row items-baseline justify-between">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Contactos en el teléfono</Text>
            <Text className="text-[12px] text-on-surface-variant">{props.porInvitar} por invitar</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}
