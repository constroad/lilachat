import { EyeOff } from 'lucide-react';
import { OwnSwitchChoice } from './OwnSwitchChoice';

/** «Vista previa en los avisos» (R31/10-B8): off, a notice says who wrote but not what. */
export function NoticePreviewChoice(props: { jwt: string; onNotice: (text: string) => void }) {
  return <OwnSwitchChoice jwt={props.jwt} route="/api/me/notification-preview" icon={EyeOff} title="Vista previa en los avisos" hint="Si la desactivas, el aviso dice quién escribió, pero no qué." testId="interruptor-vista-previa" onNotice={props.onNotice} />;
}
