import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { memberCountLabel, workspacesOf, type ClientWorkspace } from '@lilachat/shared';
import { incognitoSpaces } from '../spaces/spacesApi';
import { Avatar } from '../ui/Avatar';
import { PantallaEnModal } from '../ui/PantallaEnModal';
import { useColores } from '../ui/tema';

type Listing = { state: 'loading' } | { state: 'failed' } | { state: 'ready'; spaces: ClientWorkspace[] };

/** The spaces where he is hidden, read each time the screen opens (the list is short and rarely read). */
function useIncognitoList(jwt: string, visible: boolean): { listing: Listing; retry: () => void } {
  const [listing, setListing] = useState<Listing>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    setListing({ state: 'loading' });
    void incognitoSpaces(jwt).then((response) => {
      if (!alive) return;
      const spaces = response.ok ? workspacesOf(response.data) : null;
      setListing(spaces ? { state: 'ready', spaces } : { state: 'failed' });
    });
    return () => {
      alive = false;
    };
  }, [jwt, visible, attempt]);
  return { listing, retry: () => setAttempt((count) => count + 1) };
}

function SpaceRow(props: { space: ClientWorkspace; first: boolean; onEnter: (spaceId: string) => void }) {
  const { space } = props;
  return (
    <View testID={`incognito-${space.id}`} className={`min-h-[64px] flex-row items-center gap-3 px-4 py-2 ${props.first ? '' : 'border-t border-outline/10'}`}>
      <Avatar nombre={space.name} foto={space.logoUrl} tamano={40} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-medium text-on-surface" numberOfLines={1}>{space.name}</Text>
        <Text className="text-[13px] text-on-surface-variant">{memberCountLabel(space.members)} · solo lees</Text>
      </View>
      <Pressable testID={`entrar-incognito-${space.id}`} accessibilityRole="button" onPress={() => props.onEnter(space.id)} className="h-10 items-center justify-center rounded-full border border-outline/20 px-4">
        <Text className="text-[14px] font-semibold text-primary">Entrar</Text>
      </Pressable>
    </View>
  );
}

function Body(props: { listing: Listing; onRetry: () => void; onEnter: (spaceId: string) => void }) {
  const colors = useColores();
  const { listing } = props;
  if (listing.state === 'loading') return <ActivityIndicator testID="incognitos-cargando" color={colors.primary} className="mt-10" />;
  if (listing.state === 'failed') {
    return (
      <View accessibilityRole="alert" className="items-center gap-3 px-6 pt-10">
        <Text className="text-center text-[15px] text-error">No se pudo cargar la lista.</Text>
        <Pressable testID="incognitos-reintentar" onPress={props.onRetry} className="h-11 items-center justify-center rounded-full border border-outline/20 px-5">
          <Text className="text-[14px] font-semibold text-primary">Reintentar</Text>
        </Pressable>
      </View>
    );
  }
  if (listing.spaces.length === 0) return <Text testID="incognitos-vacio" className="px-6 pt-10 text-center text-[15px] text-on-surface-variant">No estás oculto en ningún espacio.</Text>;
  return (
    <View testID="lista-incognitos" className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      {listing.spaces.map((space, index) => <SpaceRow key={space.id} space={space} first={index === 0} onEnter={props.onEnter} />)}
    </View>
  );
}

/**
 * «Ver incógnitos» (José 13/11): the spaces where he is hidden. The switcher does not list them;
 * he enters one from here, and there he only reads.
 */
export function IncognitoScreen(props: { visible: boolean; jwt: string; onEnter: (spaceId: string) => void; onClose: () => void }) {
  const { listing, retry } = useIncognitoList(props.jwt, props.visible);
  return (
    <PantallaEnModal visible={props.visible} titulo="Espacios incógnitos" onCerrar={props.onClose} testIDCerrar="incognitos-volver">
      <View testID="pantalla-incognitos" className="gap-3">
        <Text className="text-[13px] text-on-surface-variant">Los espacios donde estás oculto. Nadie te ve como miembro y solo puedes leer.</Text>
        <Body listing={listing} onRetry={retry} onEnter={props.onEnter} />
      </View>
    </PantallaEnModal>
  );
}
