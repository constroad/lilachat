import { Pressable, Text, View } from 'react-native';
import { publishBlockers, type FieldDocument } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';

const CHANNEL_NOTE = 'El PDF se genera y llega al canal del cliente.';

/**
 * «Publicar informe» (design j-04): what Portal says is still missing, with
 * the button off until nothing is; ready, the button opens Portal's publish
 * form (the note for the channel). Published, the hub itself shows the PDF.
 */
export function PublishSheet(props: { document: FieldDocument; visible: boolean; onClose: () => void; onPublish: () => void }) {
  const blockers = publishBlockers(props.document, []);
  const ready = blockers.length === 0;
  return (
    <Sheet visible={props.visible} onClose={props.onClose} testID="publicar-informe" dragArea="handle" maxHeight="88%" className="px-4 pt-2">
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-primary">Publicar informe</Text>
      <Text className="mt-1 text-[22px] font-bold text-on-surface">{ready ? 'Todo listo' : 'Todavía falta'}</Text>
      <View className="mt-3 gap-2">
        {blockers.map((line) => (
          <View key={line} testID="falta-publicar" className="flex-row items-center gap-3 rounded-xl border border-outline/10 bg-background px-3 py-3">
            <View className="h-3 w-3 rounded-full border-2 border-error bg-error/30" />
            <Text className="flex-1 text-[14px] font-semibold text-on-surface">{line}</Text>
          </View>
        ))}
      </View>
      <Text className="mt-3 text-[14px] text-on-surface-variant">{ready ? CHANNEL_NOTE : `Cuando lo completes, ${CHANNEL_NOTE.charAt(0).toLowerCase()}${CHANNEL_NOTE.slice(1)}`}</Text>
      <Pressable testID="confirmar-publicar" disabled={!ready} onPress={props.onPublish} className={`mt-4 min-h-[56px] items-center justify-center rounded-2xl bg-primary ${ready ? '' : 'opacity-40'}`}>
        <Text className="text-[16px] font-bold text-on-primary">{props.document.publish.label}</Text>
      </Pressable>
      <Pressable testID="seguir-llenando" onPress={props.onClose} className="mt-2 min-h-[52px] items-center justify-center rounded-2xl border border-outline/20 bg-surface">
        <Text className="text-[16px] font-semibold text-on-surface">Seguir llenando</Text>
      </Pressable>
    </Sheet>
  );
}
