import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronRight, CirclePlus, RectangleEllipsis } from 'lucide-react-native';
import { invitedByLine, membersLabel, owesItsName, spacesToOpen, type ClientWorkspace, type MyProfile, type SpaceInvitation } from '@lilachat/shared';
import type { Credential } from '../auth/credentialStore';
import { CreateUserScreen } from '../onboarding/CreateUserScreen';
import { Logo } from '../ui/Logo';
import { useColores } from '../ui/tema';
import { useMargenes } from '../ui/useMargenes';
import { CreateSpaceScreen } from './CreateSpaceScreen';
import { setCurrentSpaceId } from './currentSpace';
import { JoinSpaceScreen } from './JoinSpaceScreen';
import { SpaceLogo } from './SpaceSwitcherSheet';
import { acceptSpaceInvitation, mySpaces, spaceInvitations } from './spacesApi';
import { markWelcomeSeen } from './welcomeSeen';

type EnteredSpace = { name: string; logoUrl?: string };
type Lists = { spaces: ClientWorkspace[]; invitations: SpaceInvitation[] };
type Sheet = 'join' | 'create' | null;
type Naming = { space: EnteredSpace; next: () => void };

const LOAD_ERROR = 'No se pudieron cargar tus espacios.';

/**
 * «Tus espacios de trabajo» (design `i-03-tus-espacios`): what comes after the
 * code, like Slack. The spaces to open, the invitations with «Unirme», and a
 * code or a new space. A new account writes its name BEFORE accepting, so the
 * space hears «Ana se unió» (`welcomeToGeneral` stays quiet without a name).
 */
export function YourSpacesScreen(props: { credential: Credential; account: string; onEnter: (credential: Credential) => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const { credential, onEnter } = props;
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [naming, setNaming] = useState<Naming | null>(null);
  const ownName = useRef(credential.name);

  const load = useCallback(async () => {
    setError('');
    const [spaces, invitations] = await Promise.all([mySpaces(credential.jwt), spaceInvitations(credential.jwt)]);
    if (spaces.ok && invitations.ok) setLists({ spaces: spacesToOpen(spaces.data.workspaces), invitations: invitations.data.invitations });
    else setError(LOAD_ERROR);
  }, [credential.jwt]);
  useEffect(() => void load(), [load]);

  const leave = useCallback((spaceId: string | null) => {
    markWelcomeSeen();
    setCurrentSpaceId(spaceId);
    onEnter({ ...credential, name: ownName.current });
  }, [credential, onEnter]);

  const afterName = (space: EnteredSpace, next: () => void) => (owesItsName(credential) ? setNaming({ space, next }) : next());

  const accept = async (invitation: SpaceInvitation) => {
    setAccepting(invitation.id);
    setError('');
    const response = await acceptSpaceInvitation(credential.jwt, invitation.id);
    setAccepting(null);
    if (response.ok) return leave(response.data.workspaceId);
    setError(response.message ?? 'No se pudo aceptar la invitación.');
    void load();
  };

  if (naming) {
    const finish = (profile: MyProfile) => {
      ownName.current = profile.name;
      setNaming(null);
      naming.next();
    };
    return <CreateUserScreen credential={credential} email={props.account} space={naming.space} onDone={finish} />;
  }

  return (
    <View testID="pantalla-tus-espacios" className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: margins.cabecera + 12, paddingBottom: margins.pie + 8, paddingHorizontal: 20 }}>
        <View className="flex-row items-center gap-2">
          <Logo tamano={28} />
          <Text className="text-[15px] font-bold text-on-surface">Lilachat</Text>
        </View>
        <Text className="mt-6 text-[26px] font-bold leading-[32px] text-on-surface">Tus espacios de trabajo</Text>
        <Text className="mt-1 text-[15px] text-on-surface-variant">{props.account}</Text>

        {error ? <Text testID="error-espacios" className="mt-4 text-sm text-error" onPress={() => void load()}>{error}{error === LOAD_ERROR ? ' Toca para reintentar.' : ''}</Text> : null}
        {!lists && !error ? <ActivityIndicator testID="cargando-espacios" className="mt-10" color={colors.primary} /> : null}
        {lists?.spaces.length ? (
          <Section title="Tus espacios">
            {lists.spaces.map((space) => (
              <SpaceCard key={space.id} space={space} subtitle={membersLabel(space.members)}>
                <Pressable testID={`abrir-espacio-${space.id}`} accessibilityRole="button" onPress={() => afterName(space, () => leave(space.id))} className="min-h-[40px] items-center justify-center rounded-lg border border-outline/30 px-4">
                  <Text className="text-[14px] font-semibold text-on-surface">Abrir</Text>
                </Pressable>
              </SpaceCard>
            ))}
          </Section>
        ) : null}
        {lists?.invitations.length ? (
          <Section title="Invitaciones">
            {lists.invitations.map((invitation) => (
              <SpaceCard key={invitation.id} space={invitation.workspace} subtitle={invitedByLine(invitation)}>
                <Pressable testID={`unirme-espacio-${invitation.id}`} accessibilityRole="button" disabled={accepting !== null} onPress={() => afterName(invitation.workspace, () => void accept(invitation))} className="min-h-[40px] min-w-[76px] items-center justify-center rounded-lg bg-primary px-4">
                  {accepting === invitation.id ? <ActivityIndicator size="small" color={colors['on-primary']} /> : <Text className="text-[14px] font-bold text-on-primary">Unirme</Text>}
                </Pressable>
              </SpaceCard>
            ))}
          </Section>
        ) : null}

        <View className="mt-6 border-t border-outline/20 pt-2">
          <LinkRow testID="btn-unirme-codigo" title="Unirme con un código" Icon={RectangleEllipsis} onPress={() => setSheet('join')} />
          <LinkRow testID="btn-crear-espacio-ingreso" title="Crear un espacio" Icon={CirclePlus} onPress={() => setSheet('create')} />
        </View>

        <View className="min-h-6 flex-1" />
        <Pressable testID="btn-sin-espacio" accessibilityRole="button" onPress={() => leave(null)} className="min-h-[44px] items-center justify-center">
          <Text className="text-sm text-on-surface-variant">Usar sin espacio de trabajo</Text>
        </Pressable>
      </ScrollView>
      <JoinSpaceScreen visible={sheet === 'join'} jwt={credential.jwt} onJoined={leave} onClose={() => setSheet(null)} />
      <CreateSpaceScreen visible={sheet === 'create'} jwt={credential.jwt} onCreated={(space) => afterName(space, () => leave(space.id))} onJoinInstead={() => setSheet('join')} onClose={() => setSheet(null)} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-6 gap-3">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{title}</Text>
      {children}
    </View>
  );
}

function SpaceCard({ space, subtitle, children }: { space: EnteredSpace; subtitle: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-outline/20 bg-surface p-4">
      <SpaceLogo space={space} size={44} />
      <View className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold text-on-surface" numberOfLines={1}>{space.name}</Text>
        <Text className="text-[13px] text-on-surface-variant" numberOfLines={1}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function LinkRow(props: { testID: string; title: string; Icon: typeof ChevronRight; onPress: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} accessibilityRole="button" onPress={props.onPress} className="min-h-[52px] flex-row items-center gap-3">
      <props.Icon size={22} color={colors['on-surface-variant']} />
      <Text className="min-w-0 flex-1 text-[15px] text-on-surface">{props.title}</Text>
      <ChevronRight size={18} color={colors.outline} />
    </Pressable>
  );
}
