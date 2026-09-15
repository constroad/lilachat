import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarClock, X } from 'lucide-react-native';
import { useColores } from '../ui/tema';

/**
 * Programar un mensaje: se elige CUÁNDO y el server lo envía solo (F11).
 *
 * Se llega con long-press en el botón de enviar. Fecha y hora se eligen por
 * separado con el picker nativo de Android (que abre de a un modo). El default
 * es «en una hora», y no deja programar en el pasado.
 */
export function ProgramarMensajeModal({
  visible,
  texto,
  onProgramar,
  onCerrar,
}: {
  visible: boolean;
  /** El texto que está en el campo, para confirmarlo antes de programar. */
  texto: string;
  onProgramar: (cuando: Date) => void;
  onCerrar: () => void;
}) {
  const colores = useColores();
  const [cuando, setCuando] = useState(() => new Date(Date.now() + 3_600_000));
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);

  // Al abrir, arrancar de nuevo en «en una hora»: si no, queda la elección del
  // programado anterior.
  useEffect(() => {
    if (visible) setCuando(new Date(Date.now() + 3_600_000));
  }, [visible]);

  const enElPasado = cuando.getTime() <= Date.now() + 30_000;

  const alCambiar = (_evento: DateTimePickerEvent, elegido?: Date) => {
    const modo = picker;
    setPicker(null);
    if (!elegido) return; // canceló el picker
    setCuando((previo) => {
      const nuevo = new Date(previo);
      if (modo === 'date') nuevo.setFullYear(elegido.getFullYear(), elegido.getMonth(), elegido.getDate());
      else nuevo.setHours(elegido.getHours(), elegido.getMinutes(), 0, 0);
      return nuevo;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onCerrar}>
        {/* El toque en la hoja no cierra: solo el fondo. */}
        <Pressable className="rounded-t-3xl bg-surface p-5" onPress={() => {}} testID="modal-programar">
          <View className="mb-3 flex-row items-center gap-2">
            <CalendarClock size={18} color={colores.primary} />
            <Text className="flex-1 text-base font-bold text-on-surface">Programar mensaje</Text>
            <Pressable onPress={onCerrar} testID="prog-cerrar" className="h-8 w-8 items-center justify-center">
              <X size={18} color={colores['on-surface-variant']} />
            </Pressable>
          </View>

          <View className="mb-4 rounded-xl bg-surface-variant p-3">
            <Text className="text-sm text-on-surface" numberOfLines={3}>
              {texto}
            </Text>
          </View>

          <View className="flex-row gap-3">
            <Pressable
              testID="prog-fecha"
              onPress={() => setPicker('date')}
              className="flex-1 rounded-xl border border-outline/20 p-3"
            >
              <Text className="text-[11px] text-on-surface-variant">Fecha</Text>
              <Text className="text-sm font-semibold text-on-surface">
                {cuando.toLocaleDateString()}
              </Text>
            </Pressable>
            <Pressable
              testID="prog-hora"
              onPress={() => setPicker('time')}
              className="flex-1 rounded-xl border border-outline/20 p-3"
            >
              <Text className="text-[11px] text-on-surface-variant">Hora</Text>
              <Text className="text-sm font-semibold text-on-surface">
                {cuando.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Pressable>
          </View>

          {enElPasado ? (
            <Text className="mt-2 text-[11px] text-error">Elegí un momento futuro.</Text>
          ) : null}

          <Pressable
            testID="btn-programar"
            disabled={enElPasado}
            onPress={() => onProgramar(cuando)}
            className={`mb-2 mt-4 min-h-[48px] items-center justify-center rounded-xl ${
              enElPasado ? 'bg-primary/40' : 'bg-primary'
            }`}
          >
            <Text className="text-sm font-bold text-on-primary">Programar</Text>
          </Pressable>

          {picker ? (
            <DateTimePicker
              value={cuando}
              mode={picker}
              onChange={alCambiar}
              minimumDate={picker === 'date' ? new Date() : undefined}
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
