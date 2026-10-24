import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { appLinkLine, type AppLink } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { appLink, unlinkApp } from '../spacesApi';

/**
 * «Tu cuenta en <app>» (pending 59; agentes f02cb99): the account I connected
 * is per app, like Slack. «Conectado como j•••@…» with «Desconectar», or how
 * I get connected; an app that does not answer hides the row. The web's twin.
 */
export function AppAccountSection(props: { jwt: string; spaceId: string; appId: string; appName: string }) {
  const colors = useColores();
  const [link, setLink] = useState<AppLink | null>(null);
  const [status, setStatus] = useState<{ busy: boolean; error?: string }>({ busy: false });

  useEffect(() => {
    let alive = true;
    setLink(null);
    void appLink(props.jwt, props.spaceId, props.appId).then((result) => alive && setLink(result.ok ? result.data : { unknown: true }));
    return () => {
      alive = false;
    };
  }, [props.jwt, props.spaceId, props.appId]);

  if (!link) return <View testID="cuenta-app-cargando" className="mt-4 h-20 rounded-2xl bg-surface" />;
  const line = appLinkLine(link, props.appName);
  if (!line) return null;
  const linked = 'linked' in link && link.linked;
  const disconnect = async () => {
    setStatus({ busy: true });
    const result = await unlinkApp(props.jwt, props.spaceId, props.appId);
    if (!result.ok) return setStatus({ busy: false, error: result.message ?? 'No se pudo desconectar.' });
    setStatus({ busy: false });
    setLink({ linked: false });
  };
  const confirm = () =>
    Alert.alert(`¿Desconectar tu cuenta de ${props.appName}?`, `${props.appName} te volverá a pedir tu correo o número la próxima vez que la uses.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: () => void disconnect() },
    ]);
  return (
    <View testID="cuenta-de-la-app" className="mt-4 rounded-2xl border border-outline/15 bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-2 border-b border-outline/10 pb-3">
        <UserRound size={16} color={colors.primary} />
        <Text className="text-[12px] font-bold uppercase tracking-widest text-on-surface-variant">{`Tu cuenta en ${props.appName}`}</Text>
      </View>
      <Text testID="cuenta-app-linea" className={`text-[15px] ${linked ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>{line}</Text>
      {linked ? (
        <Pressable testID="app-desconectar" disabled={status.busy} onPress={confirm} className={`mt-3 min-h-[44px] items-center justify-center self-start rounded-xl border border-outline/25 px-4 ${status.busy ? 'opacity-50' : ''}`}>
          <Text className="text-[15px] font-semibold text-error">{status.busy ? 'Desconectando…' : 'Desconectar'}</Text>
        </Pressable>
      ) : null}
      {status.error ? <Text className="mt-2 text-[13px] text-error">{status.error}</Text> : null}
    </View>
  );
}
