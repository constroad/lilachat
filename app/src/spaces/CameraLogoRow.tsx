import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import type { ClientWorkspace } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { elegirFotoRedonda } from '../chat/fotoDeGrupo';
import { removeSpaceLogo, uploadSpaceLogo } from './spacesApi';

const PREVIEW = 56;

/**
 * «Logo de la cámara» (José 27/11: the round avatar in the app, the square logo on the photos). Optional: without it
 * the camera stamps the space's logo.
 */
export function CameraLogoRow(props: { space: ClientWorkspace; jwt: string; onSaved: (space: ClientWorkspace) => void; onError: (message: string) => void }) {
  const colors = useColores();
  const [url, setUrl] = useState(props.space.cameraLogoUrl);
  const [busy, setBusy] = useState(false);
  const change = async () => {
    const picked = await elegirFotoRedonda({ titulo: 'Logo de la cámara', mensaje: 'Va en la marca de las fotos.', nombrePorDefecto: 'logo-camara.png' });
    if (picked.tipo !== 'foto') return;
    setBusy(true);
    const sent = await uploadSpaceLogo(props.jwt, props.space.id, picked.foto, 'camera-logo');
    setBusy(false);
    if (!sent.ok) return props.onError(sent.message);
    setUrl(sent.workspace.cameraLogoUrl);
    props.onSaved(sent.workspace);
  };
  const reset = async () => {
    setBusy(true);
    const response = await removeSpaceLogo(props.jwt, props.space.id, 'camera-logo');
    setBusy(false);
    if (!response.ok) return props.onError(response.message ?? 'No se pudo quitar el logo de la cámara.');
    setUrl(undefined);
    props.onSaved(response.data.workspace);
  };
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <View className="items-center justify-center overflow-hidden rounded-xl border border-outline/20 bg-background" style={{ width: PREVIEW, height: PREVIEW }}>
        {url ? <Image testID="ajustes-logo-camara-vista" source={{ uri: url }} style={{ width: PREVIEW, height: PREVIEW }} contentFit="contain" /> : <Camera size={22} color={colors['on-surface-variant']} />}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface">Logo de la cámara</Text>
        <Text className="text-[12px] text-on-surface-variant">Va en la marca de las fotos. Si no hay, va el del espacio.</Text>
        <View className="mt-2 flex-row gap-2">
          <Pressable testID="ajustes-cambiar-logo-camara" disabled={busy} onPress={() => void change()} className="min-h-[40px] justify-center rounded-xl border border-outline/25 px-3"><Text className="text-[14px] font-semibold text-on-surface">Cambiar</Text></Pressable>
          {url ? <Pressable testID="ajustes-quitar-logo-camara" disabled={busy} onPress={() => void reset()} className="min-h-[40px] justify-center px-2"><Text className="text-[14px] font-semibold text-on-surface-variant">Restablecer</Text></Pressable> : null}
        </View>
      </View>
    </View>
  );
}
