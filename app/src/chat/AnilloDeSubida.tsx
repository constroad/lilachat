import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { CircleAlert } from 'lucide-react-native';
import { anilloDeSubida } from './progresoDeSubida';

/** El anillo y su fondo (dp). Toque cómodo aunque no se toque: se lee de lejos. */
const DIAMETRO = 48;
const GROSOR = 3;
const RADIO = (DIAMETRO - GROSOR) / 2;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

/**
 * Lo que va encima de la foto que sube (auditoría 19/10), como WhatsApp: la
 * foto se ve nítida y un anillo dice cuánto falta, sin «Enviando… 37%» escrito
 * dos veces. Gira mientras no hay medida o el server procesa. Si no se envió,
 * lo dice. Encima de una foto: blanco en los dos modos.
 */
export function AnilloDeSubida({ razon, fallido, textoDelFallo }: { razon: number; fallido: boolean; textoDelFallo: string }) {
  const { fraccion, girando } = anilloDeSubida(razon);
  return (
    <View className="absolute inset-0 items-center justify-center">
      <View className="items-center justify-center rounded-full" style={{ width: DIAMETRO, height: DIAMETRO, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        {fallido ? (
          <CircleAlert size={26} color="white" />
        ) : girando ? (
          <ActivityIndicator color="white" />
        ) : (
          <Svg width={DIAMETRO} height={DIAMETRO} style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={DIAMETRO / 2} cy={DIAMETRO / 2} r={RADIO} stroke="rgba(255,255,255,0.35)" strokeWidth={GROSOR} fill="none" />
            <Circle
              cx={DIAMETRO / 2}
              cy={DIAMETRO / 2}
              r={RADIO}
              stroke="white"
              strokeWidth={GROSOR}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUNFERENCIA} ${CIRCUNFERENCIA}`}
              strokeDashoffset={CIRCUNFERENCIA * (1 - fraccion)}
            />
          </Svg>
        )}
      </View>
      {fallido ? (
        <Text className="mt-1 text-[11px] font-semibold" style={{ color: 'white' }}>
          {textoDelFallo}
        </Text>
      ) : null}
    </View>
  );
}
