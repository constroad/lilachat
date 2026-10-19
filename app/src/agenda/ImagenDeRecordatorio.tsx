import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ImagePlus, X } from 'lucide-react-native';
import { elegirFotoRedonda, type FotoElegida } from '../chat/fotoDeGrupo';
import { useColores } from '../ui/tema';

/** La imagen de un recordatorio del grupo (19/10): 16:9, como una portada. */
const PROPORCION = 16 / 9;

/** Elegir (o quitar) la imagen del recordatorio del grupo. Se sube al guardar. */
export function ImagenDeRecordatorio(props: { foto: FotoElegida | null; onCambiar: (foto: FotoElegida | null) => void }) {
  const colores = useColores();
  const elegir = async () => {
    const r = await elegirFotoRedonda({ titulo: 'Imagen del recordatorio', mensaje: 'Una foto que acompañe el aviso.', nombrePorDefecto: 'recordatorio.jpg', aspecto: [16, 9] });
    if (r.tipo === 'foto') props.onCambiar(r.foto);
  };
  if (props.foto) {
    return (
      <View testID="imagen-recordatorio" className="overflow-hidden rounded-xl">
        <Image source={{ uri: props.foto.uri }} style={{ width: '100%', aspectRatio: PROPORCION }} contentFit="cover" />
        <Pressable
          testID="btn-quitar-imagen-recordatorio"
          accessibilityLabel="Quitar la imagen"
          onPress={() => props.onCambiar(null)}
          className="absolute right-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-black/50"
        >
          <X size={18} color="white" />
        </Pressable>
      </View>
    );
  }
  return (
    <Pressable
      testID="btn-imagen-recordatorio"
      onPress={() => void elegir()}
      className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-outline/40"
    >
      <ImagePlus size={20} color={colores.primary} />
      <Text className="text-[14px] font-semibold text-primary">Agregar una imagen</Text>
    </Pressable>
  );
}
