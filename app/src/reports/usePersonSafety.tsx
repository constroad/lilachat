import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ban, Flag } from 'lucide-react-native';
import { REPORT_ACTION_LABEL, blockActionLabel, blockConfirmText, watchBlockedPerson, type CardPerson } from '@lilachat/shared';
import { blockPerson, listBlockedPeople, unblockPerson } from '../settings/blockedApi';
import { useColores } from '../ui/tema';
import { ReportSheet } from './ReportSheet';

type Safety = { actions: ReactNode; sheet: ReactNode; reporting: boolean };

/**
 * Report and block on a person's card (Google Play, José 19/11): from a 1:1 and
 * from a member of a group or a channel. Never for an app. Whether they are
 * blocked is read once when the card opens; blocking asks first.
 */
export function usePersonSafety(params: { jwt: string; person: CardPerson | null; chatId?: string; onError: (text: string) => void }): Safety {
  const { jwt, person, chatId, onError } = params;
  const colors = useColores();
  const personId = person && !person.isApp ? person.userId : null; // gates-allow: duplicate (React state twin of web/app; shared has no React, logic lives in watchBlockedPerson)
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    setBlocked(false);
    setReporting(false);
    if (!personId) return;
    return watchBlockedPerson(() => listBlockedPeople(jwt), personId, setBlocked);
  }, [jwt, personId]);

  const apply = useCallback(
    async (next: boolean) => {
      if (!personId) return;
      setBusy(true);
      const outcome = next ? await blockPerson(jwt, personId) : await unblockPerson(jwt, personId);
      setBusy(false);
      if (outcome.ok) setBlocked(next);
      else onError(outcome.message);
    },
    [jwt, personId, onError]
  );
  const toggleBlock = useCallback(() => {
    if (!person) return;
    if (blocked) return void apply(false);
    Alert.alert(blockActionLabel(false, person.name), blockConfirmText(person.name), [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: () => void apply(true) },
    ]);
  }, [person, blocked, apply]);

  if (!personId || !person) return { actions: null, sheet: null, reporting: false };
  const actions = (
    <View className="mt-3 w-full flex-row gap-2">
      <Pressable testID="persona-denunciar" onPress={() => setReporting(true)} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-error/30">
        <Flag size={18} color={colors.error} />
        <Text className="text-[15px] font-semibold text-error">{REPORT_ACTION_LABEL}</Text>
      </Pressable>
      <Pressable testID="persona-bloquear" disabled={busy} onPress={toggleBlock} className={`min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl border ${blocked ? 'border-primary/30' : 'border-error/30'} ${busy ? 'opacity-60' : ''}`}>
        <Ban size={18} color={blocked ? colors.primary : colors.error} />
        <Text numberOfLines={1} className={`flex-shrink text-[15px] font-semibold ${blocked ? 'text-primary' : 'text-error'}`}>{blockActionLabel(blocked, person.name)}</Text>
      </Pressable>
    </View>
  );
  const subject = { target: 'user' as const, userId: personId, ...(chatId ? { chatId } : {}) };
  const sheet = reporting ? <ReportSheet jwt={jwt} subject={subject} personName={person.name} onClose={() => setReporting(false)} onBlocked={() => setBlocked(true)} /> : null;
  return { actions, sheet, reporting };
}
