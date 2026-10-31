import { CheckCheck } from 'lucide-react';
import { PersonalSwitchChoice } from './PersonalSwitchChoice';

/**
 * «Confirmaciones de lectura», like WhatsApp (R31/10): off, the others do not
 * see that I read their 1:1 messages, and I do not see theirs. Groups always tell it.
 */
export function ReadReceiptsChoice(props: { jwt: string; onNotice: (text: string) => void }) {
  return <PersonalSwitchChoice jwt={props.jwt} route="/api/me/read-receipts" icon={CheckCheck} title="Confirmaciones de lectura" hint="Si las desactivas, tampoco verás las de los demás. En los grupos siempre se envían." testId="interruptor-confirmaciones-lectura" onNotice={props.onNotice} />;
}
