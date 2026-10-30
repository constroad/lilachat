import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { acceptAppScopes } from '../spacesApi';

/**
 * A newer manifest asks for more (pending 95): the app keeps working with what
 * was accepted until an admin taps «Aceptar permisos» (José, 30/10: before,
 * only reinstalling did it). The web's twin.
 */
export function NewPermissionsNotice(props: { jwt: string; spaceId: string; appId: string; lines: readonly string[]; admin: boolean }) {
  const [state, setState] = useState<{ busy: boolean; done?: boolean; error?: string }>({ busy: false });
  const accept = async () => {
    setState({ busy: true });
    const result = await acceptAppScopes(props.jwt, props.spaceId, props.appId);
    setState(result.ok ? { busy: false, done: true } : { busy: false, error: result.message ?? 'No se pudieron aceptar los permisos.' });
  };
  if (state.done) {
    return (
      <View testID="app-permisos-aceptados" className="mt-4 rounded-2xl border border-en-linea/30 bg-en-linea/10 p-3">
        <Text className="text-[14px] font-semibold text-on-surface">Permisos aceptados</Text>
      </View>
    );
  }
  return (
    <View testID="app-permisos-nuevos" className="mt-4 gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-3">
      <Text className="text-[15px] font-semibold text-on-surface">Esta app pide permisos nuevos</Text>
      {props.lines.map((line) => <Text key={line} className="text-[14px] text-on-surface">{`· ${line}`}</Text>)}
      {props.admin ? (
        <Pressable testID="app-aceptar-permisos" disabled={state.busy} onPress={() => void accept()} className={`mt-1 h-11 items-center justify-center self-start rounded-xl bg-primary px-4 ${state.busy ? 'opacity-60' : ''}`}>
          <Text className="text-[14px] font-semibold text-on-primary">{state.busy ? 'Aceptando…' : 'Aceptar permisos'}</Text>
        </Pressable>
      ) : <Text className="text-[13px] text-on-surface-variant">Un admin del espacio los acepta.</Text>}
      {state.error ? <Text accessibilityRole="alert" className="text-[13px] text-error">{state.error}</Text> : null}
    </View>
  );
}
