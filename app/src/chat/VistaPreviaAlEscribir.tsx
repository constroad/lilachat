import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Link2, X } from 'lucide-react-native';
import { primerEnlace } from '@lilachat/shared';
import { useVistaPrevia } from './useVistaPrevia';
import { useColores } from '../ui/tema';

/** Se espera a que se deje de tipear: pedir la página por cada letra del link sería absurdo. */
const ESPERA_AL_TIPEAR_MS = 600;
const LADO_DE_LA_MINIATURA = 56;

/**
 * La tarjeta del link que se está ESCRIBIENDO, arriba de la barra (José,
 * 18/10: «cuando estamos escribiendo la url en el input no se muestra»), como
 * WhatsApp. La X la esconde para ese link; al enviarlo, la burbuja dibuja la
 * suya desde la misma caché.
 */
export function VistaPreviaAlEscribir({ texto, jwt }: { texto: string; jwt?: string }) {
  const colores = useColores();
  const [url, setUrl] = useState<string | null>(null);
  const [descartada, setDescartada] = useState<string | null>(null);
  useEffect(() => {
    const espera = setTimeout(() => setUrl(primerEnlace(texto)), ESPERA_AL_TIPEAR_MS);
    return () => clearTimeout(espera);
  }, [texto]);
  const vista = useVistaPrevia(url && url !== descartada ? url : null, jwt);
  if (!vista) return null;
  return (
    <View testID="vista-previa-al-escribir" className="flex-row items-center gap-3 border-t border-outline/10 bg-surface px-3 py-2">
      {vista.imagen ? (
        <Image recyclingKey={vista.imagen} source={{ uri: vista.imagen }} style={{ width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA, borderRadius: 8 }} contentFit="cover" />
      ) : (
        <View className="items-center justify-center rounded-lg bg-primary/10" style={{ width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA }}>
          <Link2 size={22} color={colores.primary} />
        </View>
      )}
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface" numberOfLines={1}>
          {vista.titulo}
        </Text>
        {vista.descripcion ? (
          <Text className="text-[12px] text-on-surface-variant" numberOfLines={2}>
            {vista.descripcion}
          </Text>
        ) : null}
      </View>
      <Pressable testID="btn-quitar-vista-previa" accessibilityLabel="Quitar la vista previa" onPress={() => setDescartada(url)} className="h-11 w-11 items-center justify-center">
        <X size={18} color={colores['on-surface-variant']} />
      </Pressable>
    </View>
  );
}
