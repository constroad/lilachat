import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, CircleHelp, ExternalLink, Lock, TriangleAlert } from 'lucide-react-native';
import { askedTimesText, catalogByService, daliFailureOf, moneyOf, questionsOf, weekReviewOf, type DaliFaq, type DaliKnowledge, type DaliQuestion } from '@lilachat/shared';
import { ANCHO_MAXIMO_DE_CONTENIDO } from '../../ui/disposicion';
import { MONO_FONT } from '../../ui/monoFont';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import { useDisposicion } from '../../ui/useDisposicion';
import { EmptyNote, notify, OutlineButton, SkeletonRows, TextButton } from './daliParts';
import { TitledCard } from './DaliReview';
import { fetchKnowledge, type ProspectList } from './prospectsApi';
import { TeachDaliSheet } from './TeachDaliSheet';

type Props = { visible: boolean; jwt: string; spaceId: string; list: ProspectList | null; now: Date; onClose: () => void };
type Loaded = { kind: 'loading' } | { kind: 'failed'; message: string } | { kind: 'ready'; knowledge: DaliKnowledge };
type Teach = { question?: string; count?: number };
type Asked = ReturnType<typeof weekReviewOf>['questions'][number];

const KICKER = 'text-[11px] font-bold uppercase tracking-widest';
const MONO = { fontFamily: MONO_FONT };
/** On a tablet the screen covers the window: its column is centered and stops at a readable width. */
const CENTERED = { width: '100%', maxWidth: ANCHO_MAXIMO_DE_CONTENIDO, alignSelf: 'center' } as const;

const LOADING: Loaded = { kind: 'loading' };

/**
 * What Dali knows, read from agentes each time the screen opens; a 502 (agentes down) is an error, not an empty list.
 * Closing clears it: the next opening starts from the skeleton, never from the last one's answer.
 */
function useKnowledge(visible: boolean, jwt: string, spaceId: string) {
  const [loaded, setLoaded] = useState<Loaded>(LOADING);
  const [round, setRound] = useState(0);
  useEffect(() => {
    setLoaded(LOADING);
    if (!visible) return;
    let alive = true;
    void fetchKnowledge(jwt, spaceId).then((answer) => {
      if (alive) setLoaded(answer.ok ? { kind: 'ready', knowledge: answer.data.knowledge } : { kind: 'failed', message: daliFailureOf(answer, 'knowledge') });
    });
    return () => {
      alive = false;
    };
  }, [visible, jwt, spaceId, round]);
  const reload = useCallback(() => setRound((value) => value + 1), []);
  return { loaded, reload };
}

const openEditPanel = (url: string): void => {
  void Linking.openURL(url).catch(() => notify('No se pudo abrir el panel de Dali.'));
};

/**
 * «Lo que Dali sabe» (dl-12), read only: how Dali attends, what it asks (the questions every service shares once, then
 * each service's own), the catalog grouped BY SERVICE (José 16/11; prices only for the space's admins: the server
 * strips them), the FAQ and what Dali could not answer, with «Enseñarle a Dali». It is edited in Dali's panel. Stitch's
 * «ENCENDIDO» (no source in the contract) and its invented kickers do not go.
 */
export function DaliKnowledgeScreen(props: Props) {
  const { amplia } = useDisposicion();
  const { loaded, reload } = useKnowledge(props.visible, props.jwt, props.spaceId);
  const [teach, setTeach] = useState<Teach | null>(null);
  useEffect(() => {
    setTeach(null);
  }, [props.visible]);
  // Mounted behind the space and rendered every minute: the week is only read while the screen is open.
  const review = useMemo(() => (props.visible ? weekReviewOf(props.list?.prospects ?? [], props.now) : null), [props.visible, props.list, props.now]);
  const taught = () => {
    setTeach(null);
    reload();
  };
  return (
    <PantallaEnModal visible={props.visible} titulo="Lo que Dali sabe" onCerrar={props.onClose} testIDCerrar="cerrar-lo-que-sabe">
      <View testID="lo-que-sabe" className="gap-3" style={amplia ? CENTERED : undefined}>
        <ReadOnlyLine editUrl={loaded.kind === 'ready' ? loaded.knowledge.editUrl : undefined} />
        <KnowledgeState loaded={loaded} onRetry={reload} />
        {review ? <UnansweredCard label={review.week.label} questions={props.list ? review.questions : null} onTeach={setTeach} /> : null}
      </View>
      <TeachDaliSheet visible={teach !== null} jwt={props.jwt} spaceId={props.spaceId} question={teach?.question} asked={teach?.count} onTaught={taught} onClose={() => setTeach(null)} />
    </PantallaEnModal>
  );
}

/** «Solo lectura»: what is shown here is edited in Dali's own panel (agentes), opened in the browser. */
function ReadOnlyLine({ editUrl }: { editUrl?: string }) {
  const colors = useColores();
  return (
    <View className="min-h-[44px] flex-row items-center gap-2 rounded-xl bg-surface-variant/40 pl-3">
      <Lock size={14} color={colors['on-surface-variant']} />
      <Text className="flex-1 py-2 text-[13px] text-on-surface-variant">Solo lectura. Se edita en el panel de Dali.</Text>
      {editUrl ? (
        <Pressable testID="editar-panel-dali" accessibilityRole="link" onPress={() => openEditPanel(editUrl)} className="min-h-[44px] flex-row items-center gap-1.5 px-3">
          <Text className="text-[14px] font-semibold text-primary">Editar</Text>
          <ExternalLink size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function KnowledgeState({ loaded, onRetry }: { loaded: Loaded; onRetry: () => void }) {
  if (loaded.kind === 'loading') return <SkeletonRows count={3} />;
  if (loaded.kind === 'failed') {
    return (
      <View testID="error-lo-que-sabe">
        <EmptyNote title="No se pudo leer lo que Dali sabe." action={<TextButton testID="reintentar-lo-que-sabe" onPress={onRetry}>Reintentar</TextButton>}>
          {loaded.message}
        </EmptyNote>
      </View>
    );
  }
  const { knowledge } = loaded;
  return (
    <>
      <TitledCard title="Cómo atiende">
        {knowledge.hours ? <InfoRow label="Horario" value={knowledge.hours} /> : null}
        {knowledge.zone ? <InfoRow label="Zona" value={knowledge.zone} /> : null}
        <InfoRow label="Se pausa" value="Cuando una persona del equipo le responde al cliente" />
      </TitledCard>
      <WhatItAsks knowledge={knowledge} />
      <CatalogCard knowledge={knowledge} />
      <TitledCard title={`Preguntas frecuentes · ${knowledge.faqs.length}`} testID="preguntas-frecuentes">
        {knowledge.faqs.length ? knowledge.faqs.map((faq) => <FaqRow key={faq.id} faq={faq} />) : <Quiet>Todavía no hay preguntas frecuentes.</Quiet>}
      </TitledCard>
    </>
  );
}

const Quiet = ({ children }: { children: string }) => <Text className="text-[14px] text-on-surface-variant">{children}</Text>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-3 border-t border-outline/10 py-2">
      <Text className="w-20 text-[13px] text-on-surface-variant">{label}</Text>
      <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-on-surface">{value}</Text>
    </View>
  );
}

function WhatItAsks({ knowledge }: { knowledge: DaliKnowledge }) {
  const questions = questionsOf(knowledge);
  const own = questions.services.filter((service) => service.questions.length > 0);
  return (
    <TitledCard title="Lo que pregunta">
      {questions.common.length ? <Chips label="Para todos los servicios" questions={questions.common} /> : null}
      {own.map((service) => <Chips key={service.key} label={service.name} questions={service.questions} />)}
      <Text className="text-[12px] text-on-surface-variant">Con * las que necesita antes de pasarte el prospecto.</Text>
    </TitledCard>
  );
}

/** The required ones in the accent with *: Dali needs them before handing the prospect over. */
function Chips({ label, questions }: { label: string; questions: DaliQuestion[] }) {
  return (
    <View className="gap-1.5">
      <Text className={`${KICKER} text-on-surface-variant`}>{label}</Text>
      <View className="flex-row flex-wrap gap-1.5">
        {questions.map((question) => (
          <View key={question.key ?? question.label} className={`rounded-lg border px-2.5 py-1 ${question.required ? 'border-primary/40' : 'border-outline/20 bg-surface-variant/40'}`}>
            <Text className={`text-[13px] font-semibold ${question.required ? 'text-primary' : 'text-on-surface-variant'}`}>{question.required ? `${question.label}*` : question.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CatalogCard({ knowledge }: { knowledge: DaliKnowledge }) {
  const colors = useColores();
  const groups = catalogByService(knowledge);
  return (
    <TitledCard title="Catálogo por servicio" testID="catalogo-dali">
      {groups.length ? groups.map((group) => <CatalogGroup key={group.key || group.name} group={group} />) : <Quiet>Dali todavía no tiene catálogo.</Quiet>}
      <View className="flex-row items-center gap-1.5 border-t border-outline/10 pt-2">
        <Lock size={12} color={colors['on-surface-variant']} />
        <Text className="flex-1 text-[12px] text-on-surface-variant">Los precios solo los ven los admins del espacio.</Text>
      </View>
    </TitledCard>
  );
}

function CatalogGroup({ group }: { group: ReturnType<typeof catalogByService>[number] }) {
  return (
    <View className="gap-1">
      <View className="rounded-md bg-primary/5 px-2 py-1">
        <Text className={`${KICKER} text-primary`}>{`${group.name} · ${group.items.length}`}</Text>
      </View>
      {group.items.map((product, index) => (
        <View key={`${product.name}-${index}`} className={`flex-row items-center gap-3 py-1.5 ${index ? 'border-t border-outline/10' : ''}`}>
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-semibold text-on-surface">{product.name}</Text>
            {product.unit ? <Text className="text-[12px] text-on-surface-variant">{`Unidad: ${product.unit}`}</Text> : null}
          </View>
          {product.price === undefined ? null : <Text style={MONO} className="text-[14px] text-on-surface">{moneyOf(product.price)}</Text>}
        </View>
      ))}
    </View>
  );
}

/** A question of the FAQ that opens its answer, as the web's `<details>`. */
function FaqRow({ faq }: { faq: DaliFaq }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <Pressable testID="pregunta-frecuente" accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} className="min-h-[44px] justify-center rounded-lg border border-outline/15 px-3 py-2">
      <View className="flex-row items-center gap-2">
        <CircleHelp size={16} color={colors.primary} />
        <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">{faq.question}</Text>
        <Chevron size={18} color={colors['on-surface-variant']} />
      </View>
      {open ? <Text className="mt-1.5 text-[13px] text-on-surface-variant">{faq.answer}</Text> : null}
    </Pressable>
  );
}

/** What Dali could not answer in the last whole week, each with «Enseñarle a Dali»; a new answer can be taught too. */
function UnansweredCard({ label, questions, onTeach }: { label: string; questions: Asked[] | null; onTeach: (teach: Teach) => void }) {
  const colors = useColores();
  return (
    <View testID="lo-que-no-supo" className="gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
      <View className="flex-row items-center gap-2">
        <TriangleAlert size={16} color={colors.warning} />
        <Text className={`flex-1 ${KICKER} text-warning`}>{`Dali no supo responder · ${label}`}</Text>
      </View>
      {questions === null ? <SkeletonRows count={1} /> : <UnansweredRows questions={questions} onTeach={onTeach} />}
      <TextButton testID="ensenar-respuesta-nueva" onPress={() => onTeach({})}>Enseñarle otra respuesta</TextButton>
    </View>
  );
}

function UnansweredRows({ questions, onTeach }: { questions: Asked[]; onTeach: (teach: Teach) => void }) {
  if (!questions.length) return <Quiet>Dali respondió todo lo que le preguntaron esa semana.</Quiet>;
  return (
    <>
      {questions.map((one) => (
        <View key={one.question} className="flex-row items-center gap-2 rounded-lg border border-outline/15 bg-surface px-3 py-2">
          <View className="min-w-0 flex-1">
            <Text className="text-[14px] font-semibold text-on-surface">{one.question}</Text>
            <Text className="text-[12px] text-on-surface-variant">{askedTimesText(one.count)}</Text>
          </View>
          <OutlineButton testID="lo-que-sabe-ensenar" onPress={() => onTeach(one)}>Enseñarle a Dali</OutlineButton>
        </View>
      ))}
    </>
  );
}
