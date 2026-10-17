import { Linking, Text } from 'react-native';
import { useMemo } from 'react';
import { partirEnEnlaces } from './enlaces';
import { useColores } from '../ui/tema';

/**
 * El texto de un mensaje con sus links, correos y celulares tocables (FL9).
 * Va DENTRO del `<Text>` de la burbuja: son tramos anidados, así el texto
 * sigue fluyendo y la hora sigue cayendo al final de la última línea.
 */
export function TextoConEnlaces({ texto }: { texto: string }) {
  const colores = useColores();
  const partes = useMemo(() => partirEnEnlaces(texto), [texto]);
  if (partes.length === 1 && partes[0]?.tipo === 'texto') return <>{texto}</>;
  return (
    <>
      {partes.map((parte, indice) =>
        parte.tipo === 'texto' ? (
          parte.texto
        ) : (
          <Text
            key={indice}
            suppressHighlighting
            onPress={() => void Linking.openURL(parte.destino).catch(() => undefined)}
            style={{ color: colores.primary, textDecorationLine: 'underline' }}
          >
            {parte.texto}
          </Text>
        )
      )}
    </>
  );
}
