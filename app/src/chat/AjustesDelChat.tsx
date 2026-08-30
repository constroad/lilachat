import { Pressable, Switch, Text, View } from 'react-native';
import { Flag, Lock, LogOut } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/**
 * El bloque de ajustes del detalle: silenciar, cómo está cifrado, salir del
 * grupo y reportar.
 *
 * Está aparte de la pantalla porque no comparte nada con ella salvo lo que
 * recibe: son cuatro filas y una decisión de copy. Lo que NO es cosmético es el
 * texto del cifrado — dice cómo es de verdad, no como nos gustaría.
 */
export function AjustesDelChat({
  esGrupo,
  cifrado,
  silenciado,
  onSilenciar,
  accionando,
  onSalir,
}: {
  esGrupo: boolean;
  cifrado: boolean;
  silenciado: boolean;
  onSilenciar: (valor: boolean) => void;
  accionando: boolean;
  onSalir: () => Promise<void> | void;
}) {
  const colores = useColores();

  return (
    <>
      <Rotulo>Ajustes del chat</Rotulo>
      <View className="px-4">
        <View className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-on-surface">
              Silenciar notificaciones
            </Text>
            <Text className="text-[11px] text-on-surface-variant">
              {silenciado ? 'No te avisamos de este chat' : 'Te avisamos de cada mensaje'}
            </Text>
          </View>
          <Switch testID="sw-silenciar" value={silenciado} onValueChange={onSilenciar} />
        </View>

        {/* El cifrado se DICE como es, no como nos gustaría. Solo los chats
            secretos son de punta a punta; en los demás el servidor guarda
            el texto, y decir otra cosa acá sería mentir sobre privacidad. */}
        <View className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4">
          <Lock size={18} color={colores['on-surface-variant']} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold text-on-surface">
              {cifrado ? 'Chat secreto' : 'Chat normal'}
            </Text>
            <Text className="text-[11px] text-on-surface-variant">
              {cifrado
                ? 'Cifrado de punta a punta. El servidor no puede leerlo.'
                : 'El servidor guarda los mensajes para sincronizarlos entre tus aparatos.'}
            </Text>
          </View>
        </View>

        {esGrupo ? (
          <Pressable
            testID="btn-salir-grupo"
            disabled={accionando}
            onPress={() => void onSalir()}
            className={`mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4 ${accionando ? 'opacity-50' : ''}`}
          >
            <LogOut size={18} color={colores.error} />
            <Text className="text-sm font-semibold" style={{ color: colores.error }}>
              Salir del grupo
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="btn-reportar"
          className="min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-4 opacity-50"
          disabled
        >
          <Flag size={18} color={colores.error} />
          <Text className="text-sm font-semibold" style={{ color: colores.error }}>
            {esGrupo ? 'Reportar grupo' : 'Reportar contacto'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function Rotulo({ children }: { children: string }) {
  return (
    <Text className="mb-2 mt-6 px-4 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {children}
    </Text>
  );
}
