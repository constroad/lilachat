import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { formatPhoneDisplay, requestedAgo, SPACE_AREAS, type ClientWorkspaceMember } from '@lilachat/shared';
import { useColores } from '../ui/tema';
import { MemberAvatar, memberName } from './memberUi';

const TITLE_MAX = 60;

/**
 * A request to come in (design `e1-11-solicitudes`): who, with which code and
 * when, the area and title it will have, and «Rechazar» or «Aprobar».
 */
export function RequestCard(props: { request: ClientWorkspaceMember; spaceName: string; code?: string; busy: boolean; onApprove: (area: string | undefined, title: string | undefined) => void; onReject: () => void }) {
  const colors = useColores();
  const { request } = props;
  const [area, setArea] = useState<string | undefined>(request.area);
  const [title, setTitle] = useState(request.title ?? '');
  return (
    <View testID={`solicitud-${request.phone}`} className="mt-3 overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <View className="h-[3px] bg-primary" />
      <View className="p-4">
        <View className="flex-row items-center gap-3">
          <MemberAvatar member={request} size={48} online={false} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[17px] font-bold text-on-surface">{memberName(request)}</Text>
            <Text className="font-mono text-[13px] text-on-surface-variant">{formatPhoneDisplay(request.phone)}</Text>
          </View>
          <Text className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">PENDIENTE</Text>
        </View>
        {request.requestedAt ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-xl bg-background px-3 py-2.5">
            <Lock size={14} color={colors.primary} />
            <Text className="flex-1 text-[13px] text-on-surface-variant">{`Entró con el código${props.code ? ` ${props.code}` : ''} ${requestedAgo(request.requestedAt)}`}</Text>
          </View>
        ) : null}
        <Text className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">{`Área en ${props.spaceName}`}</Text>
        <View className="flex-row flex-wrap gap-2">
          {SPACE_AREAS.map((option) => (
            <Pressable key={option} testID={`solicitud-area-${option}`} onPress={() => setArea(area === option ? undefined : option)} className={`min-h-[44px] min-w-[72px] items-center justify-center rounded-xl border px-3 ${area === option ? 'border-primary bg-primary/10' : 'border-outline/20'}`}>
              <Text className={`text-[14px] font-semibold ${area === option ? 'text-primary' : 'text-on-surface'}`}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Cargo</Text>
        <TextInput testID="solicitud-cargo" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} placeholder="Chofer de volquete" placeholderTextColor={colors['on-surface-variant']} className="min-h-[48px] rounded-xl border border-outline/25 bg-background px-3 text-[15px] text-on-surface" />
        <View className="mt-4 flex-row gap-3">
          <Pressable testID="solicitud-rechazar" disabled={props.busy} onPress={props.onReject} className="min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-outline/25">
            <Text className="text-[16px] font-bold text-on-surface">Rechazar</Text>
          </Pressable>
          <Pressable testID="solicitud-aprobar" disabled={props.busy} onPress={() => props.onApprove(area, title.trim() || undefined)} className={`min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary ${props.busy ? 'opacity-50' : ''}`}>
            <Check size={18} color={colors['on-primary']} />
            <Text className="text-[16px] font-bold text-on-primary">Aprobar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
