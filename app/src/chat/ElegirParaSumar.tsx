import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Modal } from '../ui/Modal';
import { ArrowLeft } from 'lucide-react-native';
import { ContactPicker } from '../contacts/ContactPicker';
import type { Credential } from '../auth/credentialStore';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { HistoryChoiceSheet } from './HistoryChoiceSheet';
import type { MemberAccess } from '@lilachat/shared';
import { JoinAccessScreen, useChannelStages, useClientAccess } from '../spaces/clients/ClientAccess';
import { useClientOfChat } from '../spaces/clients/useSpaceClients';

/**
 * Elegir a quién sumar al grupo.
 *
 * **Se usa el MISMO selector que el lápiz** (`ContactPicker`), no una lista
 * propia. La que había acá listaba solo a la gente con la que ya tenías
 * conversación abierta, así que a alguien de tu agenda que está en Lilachat y
 * con quien nunca hablaste no había forma de sumarlo: primero había que abrirle
 * un chat 1:1 que nadie quería. El selector del lápiz ya cruza la agenda del
 * teléfono contra el padrón (`POST /contacts/match`) y trae también «Invitar a
 * Lilachat» para quien todavía no entró.
 *
 * Los que ya están adentro se descuentan con `candidatosParaSumar`; se esconden
 * en vez de fallar al tocarlos, que sería hacerle descubrir la regla a los
 * golpes.
 */
export function ElegirParaSumar({
  visible,
  credential,
  yaEstan,
  spaceId,
  chatId,
  onCerrar,
  onElegir,
}: {
  visible: boolean;
  credential: Credential;
  /** The channel's space: its members are listed instead of the contacts. */
  spaceId?: string;
  yaEstan: readonly string[];
  /** The group or channel; a client's channel asks a space admin what the person sees (José 30/10 night). */
  chatId: string;
  onCerrar: () => void;
  /** `history`: whether they see the earlier messages (José 30/10, always asked). */
  onElegir: (userId: string, history: boolean, access?: MemberAccess) => void;
}) {
  const colores = useColores();
  const margenes = useMargenes();
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const client = useClientOfChat(chatId);
  // The access list answers only to a space admin: with it, adding asks what the person sees.
  const { list } = useClientAccess(visible && client && spaceId ? { jwt: credential.jwt, spaceId, clientId: client.id } : null);
  const stages = useChannelStages(credential.jwt, chatId, list !== null);
  const choose = (history: boolean, access?: MemberAccess) => {
    const person = picked;
    setPicked(null);
    if (person) onElegir(person.id, history, access);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View className="flex-1 bg-background" testID="elegir-para-sumar">
        <View
          className="flex-row items-center gap-2 border-b border-outline/10 bg-surface px-3 pb-3"
          style={{ paddingTop: margenes.cabecera }}
        >
          <Pressable
            testID="btn-cerrar-sumar"
            accessibilityLabel="Cancelar"
            onPress={onCerrar}
            className="h-11 w-11 items-center justify-center"
          >
            <ArrowLeft size={22} color={colores['on-surface']} />
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text className="text-lg font-bold text-on-surface">{spaceId ? 'Sumar al canal' : 'Sumar al grupo'}</Text>
            {/* Se DICE que al que no está se lo puede invitar: sin esta línea,
                buscar a alguien de la agenda y no encontrarlo se lee como que la
                app no lo tiene, no como que le falta instalarla. */}
            <Text className="text-[12px] text-on-surface-variant">
              {spaceId ? 'Miembros del espacio que aún no están aquí.' : 'De tus contactos. Al que no esté, invítalo y súmalo cuando entre.'}
            </Text>
          </View>
        </View>

        {/* Montado solo mientras está abierta: así cada vez que se abre lee los
            contactos de nuevo, y no muestra la lista de antes de sumar. */}
        {visible ? (
          <ContactPicker
            credential={credential}
            selected={[]}
            multiple={false}
            excluidos={yaEstan}
            vacio={spaceId ? 'Todos los miembros del espacio ya están aquí.' : 'Todos tus contactos de Lilachat ya están en este grupo.'}
            conInvitar={!spaceId}
            spaceId={spaceId}
            onToggle={(contacto) => setPicked({ id: contacto.id, name: contacto.name ?? contacto.phone })}
          />
        ) : null}
      </View>
      {list ? (
        <JoinAccessScreen name={picked?.name ?? null} askHistory stages={stages} onClose={() => setPicked(null)} onConfirm={(history, access) => choose(history, access ?? undefined)} />
      ) : (
        <HistoryChoiceSheet name={picked?.name ?? null} onClose={() => setPicked(null)} onChoose={(history) => choose(history)} />
      )}
    </Modal>
  );
}
