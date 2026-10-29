import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RTCView, type MediaStream } from 'react-native-webrtc';
import { Phone, PhoneOff, Users, Video } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { gridOf } from '@lilachat/shared';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { inicialesDe } from '../../ui/avatarMotor';
import { CallBar, CallPill, CallTopBar } from '../CallControls';
import { groupCallCaption, ringText, tilesOf, type GroupRing, type Tile } from './groupCallView';
import type { GroupCall } from './useGroupCall';

function useSecondsSince(startedAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);
  return startedAt === null ? null : Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** One person: their video, or their initials while it has not arrived or it is a voice call. */
function GroupTile(props: { tile: Tile<MediaStream>; video: boolean; cameraOn: boolean }) {
  const { tile } = props;
  const showVideo = props.video && tile.stream && (tile.mine ? props.cameraOn : tile.stream.getVideoTracks().length > 0);
  return (
    <View className="flex-1 overflow-hidden rounded-2xl bg-black/30" testID={`mosaico-${tile.mine ? 'yo' : tile.key}`}>
      {showVideo ? (
        <RTCView streamURL={tile.stream!.toURL()} objectFit="cover" mirror={tile.mine} zOrder={tile.mine ? 1 : 0} style={StyleSheet.absoluteFill} />
      ) : (
        <View className="flex-1 items-center justify-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-on-primary/20">
            <Text className="text-3xl font-semibold text-on-primary" allowFontScaling={false}>{inicialesDe(tile.name) || '?'}</Text>
          </View>
        </View>
      )}
      <View className="absolute bottom-2 left-2 rounded-full bg-black/55 px-3 py-1">
        <Text className="text-[13px] font-semibold text-white" numberOfLines={1}>{tile.mine ? 'Tú' : tile.name}</Text>
      </View>
    </View>
  );
}

/**
 * The group call (pending 56): the people in a grid of up to 2×2, with the
 * same top bar and round controls as the 1:1 call (design c-02), minus what a
 * mesh has no backend for yet (effects and switching to video mid-call).
 */
export function GroupCallScreen(props: { group: GroupCall; me: string; onMinimize: () => void }) {
  const { group } = props;
  const margins = useMargenes();
  const seconds = useSecondsSince(group.call?.startedAt ?? null);
  if (!group.call) return null;
  const { call } = group;
  const tiles = tilesOf({ me: props.me, myStream: group.localStream, participants: call.participants, streams: group.streams, nameOf: (userId) => group.names[userId] || 'Participante' });
  const { columns } = gridOf(tiles.length);
  const rows: Tile<MediaStream>[][] = [];
  for (let index = 0; index < tiles.length; index += columns) rows.push(tiles.slice(index, index + columns));
  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={props.onMinimize}>
      <StatusBar style="light" />
      <View className="flex-1 bg-primary" testID="pantalla-llamada-grupal">
        <CallTopBar peerName={call.chatName} caption={groupCallCaption(call.participants.length, seconds)} onMinimize={props.onMinimize} />
        <View className="flex-1 gap-2 px-3 py-3">
          {rows.map((row) => (
            <View key={row.map((tile) => tile.key).join('-')} className="flex-1 flex-row gap-2">
              {row.map((tile) => <GroupTile key={tile.key} tile={tile} video={call.video} cameraOn={group.cameraOn} />)}
            </View>
          ))}
        </View>
        <View className="px-4" style={{ paddingBottom: margins.pie + 24 }}>
          <CallBar
            buttons={call.video ? ['camera', 'mic', 'hangup'] : ['mic', 'hangup']}
            video={group.cameraOn}
            muted={group.muted}
            speaker
            onMore={() => undefined}
            onToggleVideo={group.toggleCamera}
            onToggleSpeaker={() => undefined}
            onToggleMute={group.toggleMute}
            onHangUp={group.leave}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Minimized, the group call goes on under the same pill as the 1:1 one. */
export function GroupCallPill(props: { group: GroupCall; onRestore: () => void }) {
  const seconds = useSecondsSince(props.group.call?.startedAt ?? null);
  if (!props.group.call) return null;
  return <CallPill peerName={props.group.call.chatName} caption={groupCallCaption(props.group.call.participants.length, seconds)} onPress={props.onRestore} />;
}

/** Someone started a call in one of my groups: join or ignore, without taking the whole screen. */
export function GroupRingCard(props: { ring: GroupRing; chatName: string; onJoin: () => void; onIgnore: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  const text = ringText(props.ring, props.chatName);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: margins.cabecera + 4, left: 12, right: 12, zIndex: 60 }}>
      <View testID="aviso-llamada-grupal" className="flex-row items-center gap-3 rounded-3xl bg-primary px-4 py-3 shadow-lg">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-on-primary/15">
          <Users size={22} color={colors['on-primary']} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] font-bold text-on-primary" numberOfLines={1}>{text.title}</Text>
          <Text className="text-[13px] text-on-primary/80" numberOfLines={2}>{text.subtitle}</Text>
        </View>
        <Pressable testID="btn-ignorar-llamada-grupal" accessibilityLabel="Ignorar la llamada" onPress={props.onIgnore} className="h-12 w-12 items-center justify-center rounded-full bg-red-600">
          <PhoneOff size={22} color="white" />
        </Pressable>
        <Pressable testID="btn-unirse-llamada-grupal" accessibilityLabel="Unirse a la llamada" onPress={props.onJoin} className="h-12 w-12 items-center justify-center rounded-full bg-en-linea">
          {props.ring.video ? <Video size={22} color="white" /> : <Phone size={22} color="white" />}
        </Pressable>
      </View>
    </View>
  );
}
