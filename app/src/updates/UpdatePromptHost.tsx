import { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { ArrowDownToLine, RefreshCw, X } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { useLlamadas } from '../calls/ProveedorDeLlamadas';
import { pendingFilesCount } from '../chat/colaDeArchivos';
import { pendingOutboxCount } from '../chat/outboxStore';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { restartDecision } from './applyPolicy';
import { APK_PROMPT, apkNoticeNow, DISMISS_LABEL, RESTART_BLOCKED, RESTART_PROMPT, subscribeApkNotice, updatePromptOf, type UpdatePrompt } from './updatePrompt';

/** Below the screen's own header, so the pill never covers the back arrow or the title. */
const HEADER_CLEARANCE_DP = 60;

/**
 * The update prompt over any screen, Spaces included (José 28/11): a compact pill under the
 * header. A downloaded OTA offers «Reiniciar»; a new APK, while a chat or channel covers the
 * list's band, takes the person to that band. No checks of its own: it reads what the quiet
 * updater and the list already know.
 */
export function UpdatePromptHost({ bandOnScreen, onGoToList }: { bandOnScreen: boolean; onGoToList: () => void }) {
  const { isUpdatePending } = Updates.useUpdates();
  const { hayLlamada } = useLlamadas();
  const apk = useSyncExternalStore(subscribeApkNotice, apkNoticeNow);
  const [restartDismissed, setRestartDismissed] = useState(false);
  const prompt = updatePromptOf({ otaPending: isUpdatePending, restartDismissed, inCall: hayLlamada, apk, bandOnScreen });
  if (!prompt) return null;

  const onAction = () => {
    if (prompt.kind === 'apk') {
      onGoToList();
      apkNoticeNow()?.update();
      return;
    }
    const decision = restartDecision({ updatePending: isUpdatePending, callInProgress: hayLlamada, unsentMessages: pendingOutboxCount(), unsentFiles: pendingFilesCount() });
    if (decision === 'unsent') Alert.alert(RESTART_PROMPT.text, RESTART_BLOCKED);
    else if (decision === 'apply') void Updates.reloadAsync();
  };
  const onDismiss = () => {
    if (prompt.kind === 'restart') setRestartDismissed(true);
    else apkNoticeNow()?.dismiss();
  };
  return <UpdatePill prompt={prompt} onAction={onAction} onDismiss={onDismiss} />;
}

function UpdatePill({ prompt, onAction, onDismiss }: { prompt: NonNullable<UpdatePrompt>; onAction: () => void; onDismiss: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const restart = prompt.kind === 'restart';
  const mandatory = prompt.kind === 'apk' && prompt.mandatory;
  const label = restart ? RESTART_PROMPT.text : mandatory ? APK_PROMPT.mandatory : APK_PROMPT.suggested(prompt.version);
  const Icon = restart ? RefreshCw : ArrowDownToLine;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: margins.cabecera + HEADER_CLEARANCE_DP }} className="items-center px-4">
      <View testID="aviso-actualizacion-global" className="flex-row items-center gap-2 rounded-full border border-outline/15 bg-surface py-1 pl-3 pr-1 shadow-sm">
        <Icon size={14} color={colors.primary} />
        <Text className="text-[13px] font-semibold text-on-surface" numberOfLines={1}>{label}</Text>
        <Pressable testID={restart ? 'btn-reiniciar-actualizacion' : 'btn-ver-actualizacion'} onPress={onAction} className="h-8 justify-center rounded-full bg-primary px-3">
          <Text className="text-[13px] font-bold text-on-primary">{restart ? RESTART_PROMPT.action : APK_PROMPT.action}</Text>
        </Pressable>
        {mandatory ? null : (
          <Pressable testID="btn-descartar-actualizacion-global" accessibilityLabel={DISMISS_LABEL} onPress={onDismiss} hitSlop={8} className="h-8 w-8 items-center justify-center">
            <X size={14} color={colors['on-surface-variant']} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
