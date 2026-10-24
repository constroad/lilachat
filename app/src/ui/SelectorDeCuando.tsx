import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock } from 'lucide-react-native';
import { combinarFecha, opcionesRapidas } from '@lilachat/shared';
import { useColores } from './tema';

const DIA = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });

/**
 * Elegir día y hora EXACTOS (17/10/2026), para avisos, eventos y mensajes
 * programados. Antes cada pantalla tenía su lista de atajos relativos y no se
 * podía decir «el jueves a las 7:30»; programar un mensaje tenía su propio
 * picker aparte.
 *
 * Arriba, atajos de un toque (los de `cuando.ts`, en hora local); abajo, el día
 * y la hora como dos casillas que abren el picker del sistema —Android lo abre
 * de a un modo—. La casilla siempre muestra lo elegido: no hay un «toca para
 * cambiar» que esconda la fecha real.
 */
export function SelectorDeCuando({
  valor,
  onCambiar,
  prefijo = 'cuando',
  conAtajos = true,
}: {
  valor: Date;
  onCambiar: (fecha: Date) => void;
  /** Para los `testID`: dos selectores en la misma pantalla no chocan. */
  prefijo?: string;
  /** «En 1 hora», «Esta noche»…: cuentan desde AHORA; para una hora de fin no sirven. */
  conAtajos?: boolean;
}) {
  const colores = useColores();
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  // Los atajos se calculan al abrir, no en cada render: si no, «En 1 hora»
  // cambiaría de valor mientras uno mira la pantalla.
  const atajos = useMemo(() => opcionesRapidas(new Date()), []);
  const enElPasado = valor.getTime() < Date.now();

  const alElegir = (_evento: DateTimePickerEvent, elegido?: Date) => {
    const modo = picker;
    setPicker(null);
    if (elegido && modo) onCambiar(combinarFecha(valor, elegido, modo));
  };

  return (
    <View>
      {conAtajos ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
        {atajos.map((atajo) => {
          const elegido = atajo.fecha.getTime() === valor.getTime();
          return (
            <Pressable
              key={atajo.id}
              testID={`${prefijo}-atajo-${atajo.id}`}
              onPress={() => onCambiar(atajo.fecha)}
              className={`min-h-[40px] items-center justify-center rounded-full px-4 ${elegido ? 'bg-primary' : 'bg-primary/[0.07]'}`}
            >
              <Text className={`text-[13px] font-semibold ${elegido ? 'text-on-primary' : 'text-on-surface'}`}>{atajo.etiqueta}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      ) : null}

      <View className="flex-row gap-2">
        <Casilla
          testID={`${prefijo}-fecha`}
          icono={<CalendarDays size={18} color={colores.primary} />}
          rotulo="Día"
          valor={DIA.format(valor).replace('.', '')}
          onPress={() => setPicker('date')}
        />
        <Casilla
          testID={`${prefijo}-hora`}
          icono={<Clock size={18} color={colores.primary} />}
          rotulo="Hora"
          valor={TIME.format(valor)}
          onPress={() => setPicker('time')}
        />
      </View>

      {enElPasado ? (
        <Text testID={`${prefijo}-pasado`} className="mt-2 text-[12px] text-error">
          Esa hora ya pasó. Elige una que venga.
        </Text>
      ) : null}

      {picker ? (
        <DateTimePicker value={valor} mode={picker} onChange={alElegir} minimumDate={picker === 'date' ? new Date() : undefined} />
      ) : null}
    </View>
  );
}

/** A box that opens a picker and always shows what is chosen; `vacio` reads as a hint (the app's forms reuse it). */
export function Casilla(props: { testID: string; icono: React.ReactNode; rotulo: string; valor: string; onPress: () => void; vacio?: boolean }) {
  return (
    <Pressable
      testID={props.testID}
      onPress={props.onPress}
      className="min-h-[60px] flex-1 flex-row items-center gap-3 rounded-xl bg-primary/[0.07] px-3 py-2"
    >
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface">{props.icono}</View>
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] text-on-surface-variant">{props.rotulo}</Text>
        <Text className={`text-[15px] ${props.vacio ? 'text-on-surface-variant' : 'font-semibold text-on-surface'}`} numberOfLines={1}>
          {props.valor}
        </Text>
      </View>
    </Pressable>
  );
}
