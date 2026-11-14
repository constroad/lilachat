import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight, MapPinned } from 'lucide-react-native';
import { watchVisitDoor } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { VisitScreen } from './VisitScreen';
import { askVisitDoor, type VisitPlaceRef } from './visitsApi';

/**
 * «Visitas técnicas» in the chat that is their door: the `visitas` channel or the 1:1 with the app
 * (contract c-visitas). Asked once per chat, and only once José turns visits on here.
 */
export function useVisitDoor(params: { jwt: string; spaceId?: string; chatId: string }): { strip: ReactNode; screen: ReactNode } {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const [showing, setShowing] = useState(false);
  const { jwt, spaceId, chatId } = params;
  const place = useMemo<VisitPlaceRef | null>(() => (spaceId ? { jwt, spaceId, chatId } : null), [jwt, spaceId, chatId]);
  useEffect(() => {
    setOpen(false);
    setShowing(false);
    return place ? watchVisitDoor(() => askVisitDoor(place), setOpen) : undefined;
  }, [place]);
  if (!open || !place) return { strip: null, screen: null };
  const strip = (
    <Pressable testID="franja-visitas" onPress={() => setShowing(true)} className="min-h-[48px] flex-row items-center gap-2 border-b border-outline/10 bg-surface px-4">
      <MapPinned size={18} color={colors.primary} />
      <View className="flex-1"><Text className="text-[14px] font-semibold text-on-surface">Visitas técnicas</Text></View>
      <ChevronRight size={18} color={colors['on-surface-variant']} />
    </Pressable>
  );
  return { strip, screen: showing ? <VisitScreen place={place} onClose={() => setShowing(false)} /> : null };
}
