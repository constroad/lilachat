import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CircleCheck, CircleHelp, Eye, Info, Lock, X } from 'lucide-react-native';
import { askedNoteOf, daliFailureOf, TEACH_ANSWER_MAX, TEACH_QUESTION_MAX, teachProblemOf } from '@lilachat/shared';
import { Avatar } from '../../ui/Avatar';
import { MONO_FONT } from '../../ui/monoFont';
import { Sheet } from '../../ui/Sheet';
import { useColores } from '../../ui/tema';
import { notify, SolidButton, TextButton } from './daliParts';
import { teachDali } from './prospectsApi';

type Props = {
  visible: boolean;
  jwt: string;
  spaceId: string;
  /** A question Dali could not answer (the review): it comes fixed. Without one, the member writes it. */
  question?: string;
  asked?: number;
  onTaught: () => void;
  onClose: () => void;
};

const TAUGHT = 'Dali ya tiene esa respuesta.';
const KICKER = 'text-[12px] font-bold uppercase tracking-widest';
const DALI_AVATAR = 32;
const MONO = { fontFamily: MONO_FONT };
const SCROLL = { padding: 20, gap: 16 };

const confirmDiscard = (discard: () => void): void =>
  Alert.alert('¿Descartar la respuesta?', 'Lo que escribiste no se guarda.', [
    { text: 'Seguir escribiendo', style: 'cancel' },
    { text: 'Descartar', style: 'destructive', onPress: discard },
  ]);

/**
 * The form of one opening. The `idempotency_key` is born when the sheet opens and every resent tap keeps it: a
 * timeout that did reach agentes is never added twice. An answer that comes back after another opening is ignored.
 */
function useTeachForm(props: Props) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef('');
  useEffect(() => {
    if (!props.visible) return;
    key.current = Crypto.randomUUID();
    setQuestion(props.question ?? '');
    setAnswer('');
    setError('');
    setBusy(false);
  }, [props.visible, props.question]);

  const send = async () => {
    if (busy) return;
    const problem = teachProblemOf(question, answer);
    if (problem) return setError(problem);
    const sentKey = key.current;
    setBusy(true);
    setError('');
    const reply = await teachDali(props.jwt, props.spaceId, { question: question.trim(), answer: answer.trim(), idempotency_key: sentKey });
    if (key.current !== sentKey) return;
    setBusy(false);
    if (!reply.ok) return setError(daliFailureOf(reply, 'teach'));
    notify(TAUGHT);
    props.onTaught();
  };
  const typed = Boolean(answer.trim() || (!props.question && question.trim()));
  /** Back (or ✕) with something typed asks first: the keyboard's own back must not throw the answer away. */
  const requestClose = () => {
    if (busy) return;
    if (typed) confirmDiscard(props.onClose);
    else props.onClose();
  };
  const edit = (set: (text: string) => void) => (text: string) => {
    set(text);
    setError('');
  };
  return { question, answer, error, busy, send, requestClose, setQuestion: edit(setQuestion), setAnswer: edit(setAnswer) };
}

/**
 * «Enseñarle a Dali» (dl-13): the only thing Lilachat writes in what Dali knows. It only ADDS an answer of the
 * installation's company, with author, time and audit in agentes; it is corrected or deleted in Dali's panel. Errors
 * stay in the sheet (with the keyboard open a toast is not seen). Stitch's tone tip and «PENDIENTE» pill do not go.
 */
export function TeachDaliSheet(props: Props) {
  const colors = useColores();
  const form = useTeachForm(props);
  const fixed = Boolean(props.question);
  return (
    <Sheet visible={props.visible} onClose={props.onClose} onBack={form.requestClose} keyboard="avoid" dragArea="handle" bottomRoom={8} className="max-h-[90%] w-full max-w-[560px] self-center" testID="hoja-ensenar-dali">
      <TeachHeader onClose={form.requestClose} />
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={SCROLL} keyboardShouldPersistTaps="handled">
        {props.question ? <AskedCard question={props.question} asked={props.asked} /> : null}
        <QuestionField value={form.question} fixed={fixed} onChange={form.setQuestion} />
        <AnswerField value={form.answer} onChange={form.setAnswer} />
        {form.answer.trim() ? <DaliPreview text={form.answer.trim()} /> : null}
        <View className="flex-row gap-2">
          <View className="pt-0.5">
            <Info size={14} color={colors['on-surface-variant']} />
          </View>
          <Text className="flex-1 text-[12px] text-on-surface-variant">Solo agrega esta respuesta. Se corrige o se borra en el panel de Dali.</Text>
        </View>
      </ScrollView>
      <View className="gap-1 border-t border-outline/15 px-5 pt-3">
        {form.error ? <Text testID="error-ensenar-dali" className="text-[13px] text-error">{form.error}</Text> : null}
        <SolidButton testID="ensenar-a-dali" busy={form.busy} icon={<CircleCheck size={18} color={colors['on-primary']} />} onPress={() => void form.send()}>
          Enseñarle a Dali
        </SolidButton>
        <TextButton testID="cancelar-ensenar-dali" tone="neutral" onPress={props.onClose}>
          Cancelar
        </TextButton>
      </View>
    </Sheet>
  );
}

function TeachHeader({ onClose }: { onClose: () => void }) {
  const colors = useColores();
  return (
    <View className="flex-row items-start border-b border-outline/15 px-5 pb-3 pt-2">
      <View className="flex-1">
        <Text className={`${KICKER} text-primary`}>Enseñarle a Dali</Text>
        <Text accessibilityRole="header" className="text-[22px] font-extrabold tracking-tight text-on-surface">
          Nueva respuesta
        </Text>
      </View>
      <Pressable testID="cerrar-ensenar-dali" accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} className="h-11 w-11 items-center justify-center rounded-full">
        <X size={22} color={colors['on-surface-variant']} />
      </Pressable>
    </View>
  );
}

/** The question from the review, as the client asked it, and how often (dl-13). */
function AskedCard({ question, asked }: { question: string; asked?: number }) {
  const colors = useColores();
  return (
    <View testID="pregunta-de-la-revision" className="flex-row gap-3 rounded-xl border border-outline/15 bg-surface-variant/30 p-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
        <CircleHelp size={20} color={colors.warning} />
      </View>
      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[14px] font-bold text-on-surface">{`«${question}»`}</Text>
        <Text className="text-[13px] text-on-surface-variant">{askedNoteOf(asked)}</Text>
      </View>
    </View>
  );
}

function QuestionField({ value, fixed, onChange }: { value: string; fixed: boolean; onChange: (text: string) => void }) {
  const colors = useColores();
  return (
    <View className="gap-1.5">
      <Text className={`${KICKER} text-on-surface-variant`}>Pregunta</Text>
      <View className={`min-h-[48px] flex-row items-center gap-2 rounded-xl border border-outline/30 px-3 ${fixed ? 'bg-surface-variant/40' : 'bg-surface'}`}>
        <TextInput
          testID="pregunta-dali"
          value={value}
          editable={!fixed}
          maxLength={TEACH_QUESTION_MAX}
          onChangeText={onChange}
          placeholder="¿Trabajan los domingos?"
          placeholderTextColor={colors['on-surface-variant']}
          className="flex-1 py-2.5 text-[15px] text-on-surface"
        />
        {fixed ? <Lock size={16} color={colors['on-surface-variant']} /> : null}
      </View>
    </View>
  );
}

function AnswerField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className={`shrink ${KICKER} text-on-surface-variant`}>Lo que debe responder Dali</Text>
        <Text style={MONO} className="text-[12px] text-on-surface-variant">{`${value.length} / ${TEACH_ANSWER_MAX}`}</Text>
      </View>
      <TextInput
        testID="respuesta-dali"
        value={value}
        maxLength={TEACH_ANSWER_MAX}
        onChangeText={onChange}
        multiline
        textAlignVertical="top"
        className="min-h-[96px] rounded-xl border border-outline/30 bg-surface px-3 py-2.5 text-[15px] text-on-surface"
      />
    </View>
  );
}

/** «Así lo dirá Dali»: the answer in Dali's bubble, as the client will read it. */
function DaliPreview({ text }: { text: string }) {
  const colors = useColores();
  return (
    <View testID="vista-previa-dali" className="gap-1.5">
      <View className="flex-row items-center gap-1.5">
        <Eye size={14} color={colors.primary} />
        <Text className={`${KICKER} text-primary`}>Así lo dirá Dali</Text>
      </View>
      <View className="flex-row gap-2 rounded-xl border border-outline/15 bg-surface-variant/30 p-3">
        <Avatar nombre="Dali" tamano={DALI_AVATAR} bot />
        <View className="min-w-0 flex-1 rounded-xl border border-outline/15 bg-surface px-3 py-2">
          <Text className="text-[14px] text-on-surface">{text}</Text>
        </View>
      </View>
    </View>
  );
}
