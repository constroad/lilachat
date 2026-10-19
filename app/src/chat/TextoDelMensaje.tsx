import { Fragment, useMemo } from 'react';
import { Text } from 'react-native';
import { partirEnMenciones, type MencionEnMensaje } from '@lilachat/shared';
import { TextoConEnlaces } from './TextoConEnlaces';
import { textoDeMencion } from './textoDelComposer';
import { useColores } from '../ui/tema';

/**
 * El texto de una burbuja con sus @menciones y sus links (18/10). Cada mención
 * se dibuja con el nombre que TÚ le tienes a esa persona —no con el que puso
 * quien escribió—, y si no se sabe, con el texto original. Tramos anidados:
 * la hora sigue cayendo al final de la última línea.
 */
export function TextoDelMensaje(props: {
  texto: string;
  menciones?: MencionEnMensaje[];
  nombres?: ReadonlyMap<string, string>;
  yo: string;
  enBurbujaPropia: boolean;
}) {
  const colores = useColores();
  const tramos = useMemo(() => partirEnMenciones(props.texto, props.menciones), [props.texto, props.menciones]);
  if (tramos.length === 1 && tramos[0]?.tipo === 'texto') return <TextoConEnlaces texto={props.texto} enBurbujaPropia={props.enBurbujaPropia} />;
  return (
    <>
      {tramos.map((tramo, indice) =>
        tramo.tipo === 'texto' ? (
          <Fragment key={indice}>
            <TextoConEnlaces texto={tramo.texto} enBurbujaPropia={props.enBurbujaPropia} />
          </Fragment>
        ) : (
          <Text
            key={indice}
            testID={`mencion-${tramo.userId}`}
            style={{ color: props.enBurbujaPropia ? colores['on-burbuja-propia'] : colores.primary, fontWeight: '600' }}
          >
            {textoDeMencion({ userId: tramo.userId, original: tramo.texto, nombres: props.nombres, yo: props.yo })}
          </Text>
        )
      )}
    </>
  );
}
