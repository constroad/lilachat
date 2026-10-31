import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react-native';
import { FilaDeAjuste } from '../ui/FilaDeAjuste';
import { Interruptor } from '../ui/Interruptor';
import { readReadReceipts, saveReadReceipts } from '../api/client';

/**
 * «Confirmaciones de lectura», like WhatsApp (R31/10): off, the others do not
 * see that I read their 1:1 messages, and I do not see theirs. Groups always
 * tell it. Read once when the settings open; the switch waits for the server.
 */
export function ReadReceiptsSetting({ jwt }: { jwt: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void readReadReceipts(jwt).then((answer) => (answer.ok ? setOn(answer.data.on) : setFailed(true)));
  }, [jwt]);
  const change = async (next: boolean) => {
    const before = on;
    setOn(next);
    const answer = await saveReadReceipts(jwt, next);
    if (answer.ok) return setFailed(false);
    setOn(before);
    setFailed(true);
  };
  return (
    <FilaDeAjuste
      icono={CheckCheck}
      titulo="Confirmaciones de lectura"
      detalle={failed ? 'No se pudo guardar. Revisa tu conexión.' : 'Si las desactivas, tampoco verás las de los demás. En los grupos siempre se envían.'}
      derecha={<Interruptor testID="sw-confirmaciones-lectura" value={on ?? true} onValueChange={(next) => void change(next)} disabled={on === null} />}
    />
  );
}
