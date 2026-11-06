import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { PLACE_BUTTON, placeFieldValue } from '@lilachat/shared';
import { devicePlaceNow } from '../../spaces/clients/reports/devicePlace';

/** «Usar mi ubicación» under a place field (José, 06/11): it writes the link to where the device is, and the person can still type. */
export function PlaceButton({ onPick }: { onPick: (value: string) => void }) {
  const [state, setState] = useState<'idle' | 'taking' | 'failed'>('idle');
  async function take() {
    setState('taking');
    const value = placeFieldValue(await devicePlaceNow());
    if (value) onPick(value);
    setState(value ? 'idle' : 'failed');
  }
  return (
    <div className="mt-2">
      <button type="button" data-testid="btn-usar-ubicacion" disabled={state === 'taking'} onClick={() => void take()} className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-outline/25 px-4 text-[14px] font-semibold text-primary disabled:opacity-60">
        <MapPin size={16} aria-hidden />
        {state === 'taking' ? PLACE_BUTTON.taking : PLACE_BUTTON.take}
      </button>
      {state === 'failed' ? <p role="alert" className="mt-1 text-[12px] text-error">{PLACE_BUTTON.failed}</p> : null}
    </div>
  );
}
