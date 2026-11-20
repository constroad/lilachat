import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, CheckSquare, Circle, CircleDot, Square } from 'lucide-react-native';
import {
  REPORT_NOTE_MAX,
  REPORT_NOTE_PLACEHOLDER,
  REPORT_REASONS,
  REPORT_SEND_LABEL,
  REPORT_SENT_TITLE,
  REPORT_SHEET_HINT,
  alsoBlockLabel,
  canSendReport,
  reportSentBody,
  reportSheetTitle,
  type ReportReason,
  type ReportSubject,
} from '@lilachat/shared';
import { Sheet } from '../ui/Sheet';
import { useColores } from '../ui/tema';
import { sendReport } from './reportApi';

const SHEET_MAX_HEIGHT = '90%';

/**
 * The report sheet (Google Play, José 19/11): reasons, an optional note and an
 * also-block box, then the confirmation. The same sheet for a message (from the
 * selection bar) and for a person (from their card).
 */
export function ReportSheet(props: { jwt: string; subject: ReportSubject; personName: string; onClose: () => void; onBlocked?: () => void }) {
  const colors = useColores();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ blocked: boolean } | null>(null);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    const result = await sendReport(props.jwt, { ...props.subject, reason, note: note.trim(), alsoBlock });
    setBusy(false);
    if (!result.ok) return setError(result.message ?? 'No se pudo enviar la denuncia.');
    if (result.data.blocked) props.onBlocked?.();
    setSent({ blocked: result.data.blocked });
  };

  if (sent) return <ReportSent blocked={sent.blocked} onClose={props.onClose} />;
  const ready = canSendReport(reason, note) && !busy;
  return (
    <Sheet visible onClose={props.onClose} testID="hoja-denuncia" className="px-5 pt-2" keyboard="avoid" maxHeight={SHEET_MAX_HEIGHT} dragArea="handle">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text className="text-[18px] font-bold text-on-surface">{reportSheetTitle(props.subject.target, props.personName)}</Text>
        <Text className="mt-1 text-[13px] text-on-surface-variant">{REPORT_SHEET_HINT}</Text>
        <ReasonList reason={reason} onReason={setReason} />
        <TextInput testID="denuncia-nota" value={note} onChangeText={setNote} maxLength={REPORT_NOTE_MAX} multiline placeholder={REPORT_NOTE_PLACEHOLDER} placeholderTextColor={colors['on-surface-variant']} className="mt-2 min-h-[80px] rounded-xl border border-outline/20 p-3 text-[15px] text-on-surface" textAlignVertical="top" />
        <Pressable testID="denuncia-bloquear" accessibilityRole="checkbox" accessibilityState={{ checked: alsoBlock }} onPress={() => setAlsoBlock(!alsoBlock)} className="mt-2 min-h-[48px] flex-row items-center gap-3">
          {alsoBlock ? <CheckSquare size={20} color={colors.primary} /> : <Square size={20} color={colors['on-surface-variant']} />}
          <Text className="flex-1 text-[15px] text-on-surface">{alsoBlockLabel(props.personName)}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" className="mt-1 text-[13px] text-error">{error}</Text> : null}
        <Pressable testID="denuncia-enviar" disabled={!ready} onPress={() => void submit()} className={`mt-3 min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-error ${ready ? '' : 'opacity-50'}`}>
          {busy ? <ActivityIndicator color={colors['on-primary']} /> : null}
          <Text className="text-[16px] font-semibold text-on-primary">{REPORT_SEND_LABEL}</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

function ReasonList(props: { reason: ReportReason | null; onReason: (reason: ReportReason) => void }) {
  const colors = useColores();
  return (
    <View className="mt-2" accessibilityRole="radiogroup">
      {REPORT_REASONS.map((option) => (
        <Pressable key={option.id} testID={`denuncia-motivo-${option.id}`} accessibilityRole="radio" accessibilityState={{ checked: props.reason === option.id }} onPress={() => props.onReason(option.id)} className="min-h-[48px] flex-row items-center gap-3">
          {props.reason === option.id ? <CircleDot size={20} color={colors.primary} /> : <Circle size={20} color={colors['on-surface-variant']} />}
          <Text className="text-[15px] text-on-surface">{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ReportSent(props: { blocked: boolean; onClose: () => void }) {
  const colors = useColores();
  return (
    <Sheet visible onClose={props.onClose} testID="hoja-denuncia-recibida" className="items-center px-6 pt-4">
      <CheckCircle2 size={44} color={colors.primary} />
      <Text className="mt-3 text-[18px] font-bold text-on-surface">{REPORT_SENT_TITLE}</Text>
      <Text className="mt-1 text-center text-[14px] text-on-surface-variant">{reportSentBody(props.blocked)}</Text>
      <Pressable testID="denuncia-listo" onPress={props.onClose} className="mt-5 min-h-[52px] w-full items-center justify-center rounded-2xl bg-primary">
        <Text className="text-[16px] font-semibold text-on-primary">Listo</Text>
      </Pressable>
    </Sheet>
  );
}
