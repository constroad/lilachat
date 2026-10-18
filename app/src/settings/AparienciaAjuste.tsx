import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { Rotulo } from '../ui/Rotulo';
import { useTema } from '../ui/tema';
import { Segmentado } from '../ui/Segmentado';

const OPCIONES = [
  { key: 'sistema', etiqueta: 'Sistema', Icono: SunMoon, testID: 'tema-sistema' },
  { key: 'claro', etiqueta: 'Claro', Icono: Sun, testID: 'tema-claro' },
  { key: 'oscuro', etiqueta: 'Oscuro', Icono: Moon, testID: 'tema-oscuro' },
] as const;

/**
 * Claro, oscuro o el del sistema (José, 27/08/2026: «lilachat no tiene
 * darkmode o light mode como lilastore»). Salió de `TabsShell`.
 *
 * **Tres opciones y no dos**, igual que LilaStore: sin «sistema», la primera
 * vez que alguien abre la app de noche le explota una pantalla blanca. Control
 * segmentado y no una lista: son excluyentes y se comparan entre sí.
 */
export function AparienciaAjuste() {
  const { modo, setModo } = useTema();
  return (
    <>
      <Rotulo>Apariencia</Rotulo>
      <Segmentado opciones={OPCIONES} valor={modo} onCambiar={setModo} />
    </>
  );
}
