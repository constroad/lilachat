import { Linking, Pressable, Text, View } from 'react-native';
import { ChevronRight, ClipboardCheck, Droplets, FileSignature, Hammer, Layers, Square, Truck, UserCheck, type LucideIcon } from 'lucide-react-native';
import { REPORT_TYPE_OPTIONS, type ReportTypeOption } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';

const ICONS: Record<string, LucideIcon> = { 'CTL-IMP': Droplets, IAA: Square, 'CTL-PIS': Truck, 'CON-CAP': Layers, 'RCP-CAM': UserCheck, 'LEV-OBS': ClipboardCheck, 'FRE-PAV': Hammer, 'SOL-IMP': FileSignature };

function TypeRow({ option, portalUrl, onPick }: { option: ReportTypeOption; portalUrl?: string; onPick: (code: string) => void }) {
  const colors = useColores();
  const Icon = ICONS[option.code] ?? Droplets;
  const press = () => (option.opensHere ? onPick(option.code) : portalUrl ? void Linking.openURL(portalUrl) : undefined);
  const enabled = option.opensHere || Boolean(portalUrl);
  return (
    <Pressable testID={`tipo-informe-${option.code}`} onPress={press} disabled={!enabled} className={`min-h-[72px] flex-row items-center gap-3 rounded-2xl border bg-surface px-3 py-3 ${option.opensHere ? 'border-primary/40' : 'border-outline/15'} ${enabled ? '' : 'opacity-50'}`}>
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Icon size={20} color={colors.primary} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{option.label}</Text>
        <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{option.caption}</Text>
      </View>
      {!option.opensHere ? <Text className="rounded-md bg-surface-variant px-2 py-1 text-[10px] font-bold uppercase tracking-[1px] text-on-surface-variant">En Portal</Text> : null}
      <ChevronRight size={18} color={colors.primary} />
    </Pressable>
  );
}

/**
 * «Crear informe» (design j-01): the eight types of Portal's public page.
 * Only the ones Lilachat fills open here; the rest open the service in Portal
 * until their turn comes (spec INFORMES-DESDE-LILACHAT §5).
 */
export function CreateReportSheet(props: { visible: boolean; portalUrl?: string; onPick: (code: string) => void; onClose: () => void }) {
  return (
    <Sheet visible={props.visible} onClose={props.onClose} testID="crear-informe" dragArea="handle" maxHeight="88%" tone="background" className="px-4 pt-2">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Nuevo informe</Text>
      <Text className="mt-1 text-[22px] font-bold text-on-surface">¿Qué informe vas a hacer?</Text>
      <Text className="mb-3 mt-1 text-[14px] text-on-surface-variant">Se guarda como borrador mientras lo llenas</Text>
      <View className="gap-2">
        {REPORT_TYPE_OPTIONS.map((option) => <TypeRow key={option.code} option={option} portalUrl={props.portalUrl} onPick={props.onPick} />)}
      </View>
      <Pressable testID="cancelar-crear-informe" onPress={props.onClose} className="mt-3 min-h-[52px] items-center justify-center rounded-2xl border border-outline/20 bg-surface">
        <Text className="text-[16px] font-semibold text-on-surface">Cancelar</Text>
      </Pressable>
    </Sheet>
  );
}
