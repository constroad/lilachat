import { useEffect, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { Reply } from 'lucide-react-native';
import { guardarAutoReply, leerAutoReply } from '../api/client';
import { useColores } from '../ui/tema';

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
    <View className="mt-2 rounded-xl border border-outline/10 bg-surface p-4" testID="ajuste-auto-respuesta">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Reply size={18} color={colores.primary} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-on-surface">Auto-respuesta</Text>
          <Text className="text-[11px] text-on-surface-variant">
            Cuando no estés conectado, contesta sola en los chats 1:1.
          </Text>
        </View>
        <Switch
          testID="switch-auto-respuesta"
          value={enabled}
          onValueChange={(valor) => {
            setEnabled(valor);
            // Apagar guarda siempre; encender solo si ya hay texto (si no, se
            // guarda al salir del campo). Encendida sin texto la rechaza el server.
            if (!valor || text.trim()) guardar(valor, text.trim());
          }}
        />
      </View>

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
          className="mt-3 min-h-[44px] rounded-lg bg-surface-variant px-3 py-2 text-sm text-on-surface"
        />
      ) : null}
    </View>
  );
}
