import { useState } from 'react';
import { View } from 'react-native';
import { Interruptor } from '../ui/Interruptor';
import { Bell, BellOff, Lock, LogOut } from 'lucide-react-native';
import { NOTIFICATION_LEVEL_TEXT, type NotificationLevel } from '@lilachat/shared';
import { NotificationLevelSheet } from './NotificationLevelSheet';
import { FilaDeAjuste, GrupoDeAjustes } from '../ui/FilaDeAjuste';
import { Rotulo } from '../ui/Rotulo';

/**
 * El bloque de ajustes del detalle: silenciar, cómo está cifrado y salir del
 * grupo, en listas agrupadas como Ajustes (FL13).
 *
 * Está aparte de la pantalla porque no comparte nada con ella salvo lo que
 * recibe: son tres filas y una decisión de copy. Lo que NO es cosmético es el
 * texto del cifrado — dice cómo es de verdad, no como nos gustaría.
 */
export function AjustesDelChat({
  esGrupo,
  cifrado,
  level,
  onLevel,
  accionando,
  onSalir,
}: {
  esGrupo: boolean;
  cifrado: boolean;
  /** E3b: a group chooses everything / only mentions / nothing; a 1:1 keeps the switch. */
  level: NotificationLevel;
  onLevel: (level: NotificationLevel) => void;
  accionando: boolean;
  onSalir: () => Promise<void> | void;
}) {
  const [choosing, setChoosing] = useState(false);
  const silenced = level !== 'todo';
  return (
    <>
      <Rotulo sangrado>Ajustes del chat</Rotulo>
      <View className="gap-3 px-4">
        <GrupoDeAjustes>
          {esGrupo ? (
            <FilaDeAjuste testID="btn-avisos" icono={silenced ? BellOff : Bell} titulo="Avisos" detalle={NOTIFICATION_LEVEL_TEXT[level].title} onPress={() => setChoosing(true)} />
          ) : (
            <FilaDeAjuste
              icono={BellOff}
              titulo="Silenciar notificaciones"
              detalle={silenced ? 'No te avisamos de este chat' : 'Te avisamos de cada mensaje'}
              derecha={<Interruptor testID="sw-silenciar" value={silenced} onValueChange={(value) => onLevel(value ? 'menciones' : 'todo')} />}
            />
          )}
          {/* El cifrado se DICE como es, no como nos gustaría. Solo los chats
              secretos son de punta a punta; en los demás el servidor guarda
              el texto, y decir otra cosa acá sería mentir sobre privacidad. */}
          <FilaDeAjuste
            icono={Lock}
            titulo={cifrado ? 'Chat secreto' : 'Chat normal'}
            detalle={
              cifrado
                ? 'Cifrado de punta a punta. El servidor no puede leerlo.'
                : 'El servidor guarda los mensajes para sincronizarlos entre tus dispositivos.'
            }
          />
        </GrupoDeAjustes>

        {/* «Reportar» se fue (FL13): estaba deshabilitado y no hay a dónde
            mandar el reporte. Un botón que no hace nada enseña que la app no
            responde (la misma regla de la cámara apagada de FL3). */}
        {esGrupo ? (
          <GrupoDeAjustes>
            <FilaDeAjuste
              testID="btn-salir-grupo"
              icono={LogOut}
              tono="peligro"
              titulo="Salir del grupo"
              derecha={false}
              deshabilitada={accionando}
              onPress={() => void onSalir()}
            />
          </GrupoDeAjustes>
        ) : null}
      </View>
      <NotificationLevelSheet
        visible={choosing}
        level={level}
        onChoose={(next) => {
          setChoosing(false);
          onLevel(next);
        }}
        onClose={() => setChoosing(false)}
      />
    </>
  );
}
