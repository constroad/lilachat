import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Pointer } from 'lucide-react-native';
import { BATCH_STAY, batchLines, batchPins, batchScreenActions, batchTotals, EMPTY_BATCH_SCREEN, workMapView, type BatchScreen, type TapFeatures, type WorkMap, type WorkMapPoint } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { useDisposicion } from '../../../ui/useDisposicion';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapSurface } from './WorkMapSurface';
import { WorkStreetEditor } from './WorkStreetEditor';
import { EditorTopBar, SwitchQuestion, useBandTone } from './WorkStreetEditorParts';
import { BatchHead, BatchRows, DoneButton, HandButton } from './WorkStreetBatchParts';
import type { StreetSend } from './workProgressSender';

const NO_STREETS: WorkMap = { streets: [], scopes: [], progress: [], works: [], stages: [] };
const SIDE_PANEL_WIDTH = 380;
/** On a phone the list stops at this share of the screen, so the map always keeps its part. */
const LIST_SHARE = 0.3;
const HINT = 'Toca las calles donde vas a trabajar';

type BatchProps = { open: boolean; title: string; map: WorkMap | null; send: StreetSend; onClose: () => void; onSaved: (message: string) => void; /** Some were saved before a failure: the map reads them again, the list stays. */ onPartial: () => void; start?: WorkMapPoint };
/** The screen's state; its handlers come from `batchScreenActions` (shared with the web). */
function useBatch(props: BatchProps) {
  const [screen, setScreen] = useState<BatchScreen>(EMPTY_BATCH_SCREEN);
  const actions = batchScreenActions(screen, setScreen, { saved: props.map?.streets ?? [], newKey: randomUUID, send: props.send, onClose: props.onClose, onSaved: props.onSaved, onPartial: props.onPartial });
  return { screen, ...actions, onTap: (_point: WorkMapPoint, roads: TapFeatures) => actions.tap(roads) };
}

/**
 * ma02 «Marcar calles del área» (José approved Portal's prototype 28/11): tap every road of the area,
 * each comes whole and numbered into the list; «Listo» saves them one by one. On a phone the list goes
 * under the map; rotated or on a tablet, to a side panel like the single-street editor.
 */
export function WorkStreetBatch(props: BatchProps) {
  const state = useBatch(props);
  const [hand, setHand] = useState(false);
  const view = useMemo(() => workMapView(props.map ?? NO_STREETS), [props.map]);
  const margins = useMargenes();
  const { amplia } = useDisposicion();
  const { height } = useWindowDimensions();
  const tone = useBandTone();
  const colors = useColores();
  const { batch, progress, problem, question } = state.screen;
  const busy = progress !== null;
  const band = (
    <View className={`${tone.band} px-4 pb-3`} style={{ paddingTop: margins.cabecera + 4 }}>
      <EditorTopBar kicker={props.title} heading="Marcar calles del área" canUndo={false} onCancel={state.cancel} />
      <View className="mt-2 flex-row items-center gap-2">
        <Pointer size={18} color={colors[tone.icon]} />
        <Text testID="lote-ayuda" className={`flex-1 text-[14px] font-semibold ${tone.text}`}>{HINT}</Text>
      </View>
      {question ? <SwitchQuestion question={question.text} yes={question.yes} no={BATCH_STAY} onYes={() => state.answer(true)} onNo={() => state.answer(false)} /> : null}
    </View>
  );
  const list: ReactNode = (
    <View className="gap-3">
      <BatchHead total={batchTotals(batch).label} />
      <BatchRows batch={batch} onEdit={state.edit} onRemove={(street) => state.remove(street.key)} />
      <HandButton disabled={busy} onPress={() => setHand(true)} />
    </View>
  );
  const footer = (
    <View className="gap-2">
      {problem ? <Text testID="lote-problema" className="text-[13px] font-semibold text-error">{problem}</Text> : null}
      <DoneButton count={batch.streets.length} progress={progress} onPress={() => void state.finish()} />
    </View>
  );
  const mapArea = (
    <View className="flex-1 overflow-hidden">
      {props.open && !hand ? <WorkMapSurface view={view} moves pins={batchPins(batch)} stretches={batchLines(batch)} onTap={state.onTap} near={props.start ?? null} /> : null}
    </View>
  );
  return (
    <>
      <Modal visible={props.open && !hand} animationType="slide" onRequestClose={state.cancel}>
        <KeyboardAvoidingView behavior="padding" className={`flex-1 bg-background ${amplia ? 'flex-row' : ''}`} testID="lote-calles">
          {amplia ? (
            <>
              {mapArea}
              <View testID="lote-panel" className="border-l border-outline/15 bg-surface" style={{ width: SIDE_PANEL_WIDTH }}>
                {band}
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12 }}>{list}</ScrollView>
                <View className="px-4 pt-2" style={{ paddingBottom: margins.pie + 8 }}>{footer}</View>
              </View>
            </>
          ) : (
            <>
              {band}
              {mapArea}
              <View className="rounded-t-2xl border-t border-outline/15 bg-surface px-4 pt-3" style={{ paddingBottom: margins.pie + 8 }}>
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * LIST_SHARE }} contentContainerStyle={{ paddingBottom: 8 }}>{list}</ScrollView>
                {footer}
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </Modal>
      {hand ? <WorkStreetEditor open title={props.title} map={props.map} send={state.addHand} mode="hand" saveLabel="Agregar a la lista" start={props.start} onClose={() => setHand(false)} onSaved={() => setHand(false)} /> : null}
    </>
  );
}
