import { useState } from 'react';
import { Alert, Pressable, Text, TextInput } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { ACCOUNT_DELETION_CONFIRM_WORD, ACCOUNT_DELETION_TEXTS, confirmsAccountDeletion, deletionClosedLine } from '@lilachat/shared';
import { requestAccountDeletion } from '../api/accountDeletionApi';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';

/**
 * «Borrar mi cuenta», the last row of Ajustes (José 19/11, Google Play). Like
 * «Eliminar espacio»: what goes is said plainly and a word is typed to confirm.
 * The session dies with the answer, so the phone signs out at once and the
 * native alert (it outlives the screen) says when the account goes.
 */
export function DeleteAccountSetting(props: { jwt: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const deleted = (deadline: Date) => {
    setOpen(false);
    Alert.alert(ACCOUNT_DELETION_TEXTS.title, deletionClosedLine(deadline));
    props.onSignOut();
  };
  return (
    <>
      <FilaDeAjuste testID="btn-borrar-cuenta" icono={Trash2} tono="peligro" titulo={ACCOUNT_DELETION_TEXTS.title} derecha={false} onPress={() => setOpen(true)} />
      <PantallaEnModal visible={open} titulo={ACCOUNT_DELETION_TEXTS.title} onCerrar={() => setOpen(false)} testIDCerrar="btn-cerrar-borrar-cuenta">
        <ConfirmDeletion jwt={props.jwt} onDeleted={deleted} />
      </PantallaEnModal>
    </>
  );
}

function ConfirmDeletion(props: { jwt: string; onDeleted: (deadline: Date) => void }) {
  const colors = useColores();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = confirmsAccountDeletion(typed) && !busy;
  const confirm = async () => {
    setBusy(true);
    setError('');
    const outcome = await requestAccountDeletion(props.jwt);
    setBusy(false);
    if (outcome.ok) props.onDeleted(outcome.deadline);
    else setError(outcome.message);
  };
  return (
    <>
      <Text className="mt-2 text-[15px] font-semibold text-on-surface">Se borra:</Text>
      {ACCOUNT_DELETION_TEXTS.erased.map((line) => <Text key={line} className="mt-1.5 text-[15px] leading-5 text-on-surface-variant">{`• ${line}`}</Text>)}
      <Text className="mt-4 text-[15px] font-semibold text-on-surface">Queda:</Text>
      <Text className="mt-1.5 text-[15px] leading-5 text-on-surface-variant">{ACCOUNT_DELETION_TEXTS.kept}</Text>
      <Text className="mt-4 rounded-xl bg-error/10 p-3 text-[15px] leading-5 text-on-surface">{ACCOUNT_DELETION_TEXTS.grace}</Text>
      <Text className="mb-1.5 mt-5 text-[14px] font-semibold text-on-surface">{ACCOUNT_DELETION_TEXTS.confirmPrompt}</Text>
      <TextInput testID="input-confirmar-borrar-cuenta" value={typed} onChangeText={(text) => { setTyped(text); setError(''); }} placeholder={ACCOUNT_DELETION_CONFIRM_WORD} placeholderTextColor={colors['on-surface-variant']} autoCorrect={false} autoCapitalize="characters" className="min-h-[48px] rounded-xl border border-outline/25 bg-background px-3 text-[16px] text-on-surface" />
      {error ? <Text testID="error-borrar-cuenta" className="mt-2 text-[13px] text-error">{error}</Text> : null}
      <Pressable testID="btn-confirmar-borrar-cuenta" accessibilityRole="button" disabled={!ready} onPress={() => void confirm()} className={`mt-5 min-h-[52px] flex-row items-center justify-center gap-2 rounded-xl bg-error ${ready ? '' : 'opacity-40'}`}>
        <Trash2 size={18} color={colors.background} />
        <Text className="text-[16px] font-bold text-background">{busy ? 'Borrando…' : ACCOUNT_DELETION_TEXTS.confirmAction}</Text>
      </Pressable>
    </>
  );
}
