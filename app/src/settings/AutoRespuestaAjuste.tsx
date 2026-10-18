import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { Reply } from 'lucide-react-native';
import { guardarAutoReply, leerAutoReply } from '../api/client';
import { useColores } from '../ui/tema';
import { FilaDeAjuste, SANGRIA_DEL_TEXTO } from '../ui/FilaDeAjuste';

/**
 * Ajuste de auto-respuesta de ausente (F11), en Ajustes.
 *
 * Se guarda solo: al apagar, al encender con texto, y al salir del campo. No hay
 * botón «guardar» —es un interruptor con una nota—. Encender sin texto NO se
 * guarda todavía: el server lo rechaza, así que se espera a que escriba.
 */
export function AutoRespuestaAjuste({ jwt }: { jwt: string }) {
  const colores = useColores();
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    void leerAutoReply(jwt).then((respuesta) => {
      if (respuesta.ok) {
        setEnabled(respuesta.data.autoReply.enabled);
        setText(respuesta.data.autoReply.text);
      }
    });
  }, [jwt]);

  const guardar = (activo: boolean, texto: string) => {
    void guardarAutoReply(jwt, activo, texto);
  };

  return (
    <FilaDeAjuste
      testID="ajuste-auto-respuesta"
      icono={Reply}
      titulo="Auto-respuesta"
      detalle="Si no estás conectado, contesta sola en los chats 1:1"
      derecha={
        <Interruptor
          testID="switch-auto-respuesta"
          value={enabled}
          onValueChange={(valor) => {
            setEnabled(valor);
            // Apagar guarda siempre; encender solo si ya hay texto (si no, se
            // guarda al salir del campo). Encendida sin texto la rechaza el server.
            if (!valor || text.trim()) guardar(valor, text.trim());
          }}
        />
      }
    >

      {enabled ? (
        <TextInput
          testID="texto-auto-respuesta"
          value={text}
          onChangeText={setText}
          onBlur={() => {
            if (text.trim()) guardar(true, text.trim());
          }}
          placeholder="Ej. Estoy manejando, te contesto más tarde"
          placeholderTextColor={colores['on-surface-variant']}
          multiline
          maxLength={300}
          className="mt-3 min-h-[48px] rounded-xl bg-surface-variant px-3.5 py-3 text-[15px] text-on-surface"
          style={{ marginLeft: SANGRIA_DEL_TEXTO }}
        />
      ) : null}
    </FilaDeAjuste>
  );
}
