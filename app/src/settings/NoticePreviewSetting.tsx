import { useCallback } from 'react';
import { EyeOff } from 'lucide-react-native';
import { readNoticePreview, saveNoticePreview } from '../api/client';
import { OwnSwitchSetting } from './OwnSwitchSetting';

/** «Vista previa en los avisos» (R31/10-B8): off, a notice says who wrote but not what. */
export function NoticePreviewSetting({ jwt }: { jwt: string }) {
  const read = useCallback(() => readNoticePreview(jwt), [jwt]);
  const save = useCallback((on: boolean) => saveNoticePreview(jwt, on), [jwt]);
  return <OwnSwitchSetting read={read} save={save} icon={EyeOff} title="Vista previa en los avisos" detail="Si la desactivas, el aviso dice quién escribió, pero no qué." testID="sw-vista-previa" />;
}
