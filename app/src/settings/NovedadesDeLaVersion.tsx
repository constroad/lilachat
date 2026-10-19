import { Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowDownToLine, Sparkles } from 'lucide-react-native';
import { lineasDeNotas, type Novedad } from './novedades';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';

/**
 * «Novedades» ANTES de bajar la versión nueva (José, 19/10): qué trae cada
 * versión desde la que tienes —si te salteaste varias, todas—, y recién abajo
 * el botón de descargar. Las notas se escriben al publicar (`--notes`).
 */
export function NovedadesDeLaVersion(props: { novedades: Novedad[]; visible: boolean; onCerrar: () => void; onDescargar: () => void }) {
  const colores = useColores();
  const margenes = useMargenes();
  const ultima = props.novedades[0]?.version ?? '';
  return (
    <PantallaEnModal visible={props.visible} titulo="Novedades" onCerrar={props.onCerrar} testIDCerrar="btn-cerrar-novedades">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} testID="pantalla-novedades">
        <View className="mb-4 flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles size={22} color={colores.primary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-semibold text-on-surface">Lilachat {ultima}</Text>
            <Text className="text-[13px] text-on-surface-variant">Esto es lo nuevo desde tu versión.</Text>
          </View>
        </View>
        {props.novedades.map((novedad) => (
          <View key={novedad.versionCode} className="mb-3 rounded-2xl border border-outline/10 bg-surface p-4">
            <Text className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Versión {novedad.version}</Text>
            {lineasDeNotas(novedad.notas).map((linea, indice) => (
              <View key={indice} className="mb-1.5 flex-row gap-2">
                <Text className="text-[15px] leading-[21px] text-primary">•</Text>
                <Text className="min-w-0 flex-1 text-[15px] leading-[21px] text-on-surface">{linea}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View className="border-t border-outline/10 bg-background px-4 pt-3" style={{ paddingBottom: margenes.pie + 8 }}>
        <Pressable
          testID="btn-descargar-novedades"
          onPress={props.onDescargar}
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-primary"
        >
          <ArrowDownToLine size={18} color={colores['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">Descargar e instalar</Text>
        </Pressable>
      </View>
    </PantallaEnModal>
  );
}
