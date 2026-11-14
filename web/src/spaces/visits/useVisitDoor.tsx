import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, MapPinned } from 'lucide-react';
import { watchVisitDoor } from '@lilachat/shared';
import { VisitScreenWeb } from './VisitScreenWeb';
import { askVisitDoor, type VisitPlaceRef } from './visitsApi';

/**
 * «Visitas técnicas» in the chat that is their door: the `visitas` channel or the 1:1 with the app
 * (contract c-visitas). Asked once per chat, and only once José turns visits on here.
 */
export function useVisitDoor({ jwt, spaceId, chatId }: { jwt: string; spaceId?: string; chatId: string }): { strip: ReactNode; screen: ReactNode } {
  // The door is per chat: a new chat starts closed and is asked again.
  const [door, setDoor] = useState<{ chatId: string; open: boolean; showing: boolean }>({ chatId, open: false, showing: false });
  const place = useMemo<VisitPlaceRef | null>(() => (spaceId ? { jwt, spaceId, chatId } : null), [jwt, spaceId, chatId]);
  useEffect(() => {
    setDoor({ chatId, open: false, showing: false });
    if (!place) return undefined;
    return watchVisitDoor(() => askVisitDoor(place), (open) => setDoor((now) => ({ ...now, open })));
  }, [place, chatId]);
  const open = door.open && door.chatId === chatId;
  const setShowing = (showing: boolean) => setDoor((now) => ({ ...now, showing }));
  const showing = door.showing;
  if (!open || !place) return { strip: null, screen: null };
  const strip = (
    <button type="button" data-testid="franja-visitas" onClick={() => setShowing(true)} className="flex min-h-[48px] w-full items-center gap-2 border-b border-outline/10 bg-surface px-4 text-left">
      <MapPinned size={18} className="text-primary" />
      <span className="flex-1 text-[14px] font-semibold text-on-surface">Visitas técnicas</span>
      <ChevronRight size={18} className="text-on-surface-variant" />
    </button>
  );
  return { strip, screen: showing ? <VisitScreenWeb place={place} onClose={() => setShowing(false)} /> : null };
}
