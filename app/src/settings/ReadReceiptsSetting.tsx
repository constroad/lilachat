import { useCallback } from 'react';
import { CheckCheck } from 'lucide-react-native';
import { readReadReceipts, saveReadReceipts } from '../api/client';
import { PersonalSwitchSetting } from './PersonalSwitchSetting';

/**
 * «Confirmaciones de lectura», like WhatsApp (R31/10): off, the others do not
 * see that I read their 1:1 messages, and I do not see theirs. Groups always tell it.
 */
export function ReadReceiptsSetting({ jwt }: { jwt: string }) {
  const read = useCallback(() => readReadReceipts(jwt), [jwt]);
  const save = useCallback((on: boolean) => saveReadReceipts(jwt, on), [jwt]);
  return <PersonalSwitchSetting read={read} save={save} icon={CheckCheck} title="Confirmaciones de lectura" detail="Si las desactivas, tampoco verás las de los demás. En los grupos siempre se envían." testID="sw-confirmaciones-lectura" />;
}
