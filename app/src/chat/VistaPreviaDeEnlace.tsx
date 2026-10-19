import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { VistaPreviaDeEnlace as Vista } from '@lilachat/shared';
import { pedirVistaPrevia } from '../api/client';

/** La foto de la tarjeta: el formato de `og:image` (1.91:1), con tope de alto. */
const PROPORCION_DE_LA_IMAGEN = 1.91;
/** Ancho fijo: con un link corto la burbuja quedaba angosta y la tarjeta, apretada. */
const ANCHO_DE_LA_TARJETA = 260;
const ALTO_MAXIMO_DE_LA_IMAGEN = 160;
/** Por debajo de esta proporción la imagen es un ícono o un logo: va chica, al costado. */
const PROPORCION_MINIMA_ANCHA = 1.3;
const LADO_DE_LA_MINIATURA = 72;
/** Imágenes que resultaron cuadradas: la próxima vez nacen en su forma, sin saltar. */
const cuadradas = new Set<string>();
/** Lo último que se supo de cada enlace: la celda reciclada no vuelve a pedir. `null` = no tiene. */
const vistas = new Map<string, Vista | null>();
const enCamino = new Map<string, Promise<Vista | null>>();

function buscar(url: string, jwt: string): Promise<Vista | null> {
  const yaVa = enCamino.get(url);
  if (yaVa) return yaVa;
  const viaje = pedirVistaPrevia(url, jwt)
    .then((respuesta) => {
      // Sin red no se recuerda nada: se vuelve a probar la próxima vez.
      if (respuesta.ok) vistas.set(url, respuesta.data.vistaPrevia);
      return respuesta.ok ? respuesta.data.vistaPrevia : null;
    })
    .finally(() => enCamino.delete(url));
  enCamino.set(url, viaje);
  return viaje;
}

/**
 * La tarjeta de un enlace dentro de la burbuja, como WhatsApp (José, 18/10):
 * la foto, el título, la descripción y el sitio, sacados del `og:` de la
 * página por el server. Mientras no llega no ocupa lugar; si la página no
 * tiene, no se dibuja nada y queda el link tocable de siempre.
 */
export function VistaPreviaDeEnlace({ url, jwt, mia }: { url: string; jwt: string; mia: boolean }) {
  const [vista, setVista] = useState<Vista | null | undefined>(() => vistas.get(url));
  const [cuadrada, setCuadrada] = useState(false);

  useEffect(() => {
    if (vistas.has(url)) return setVista(vistas.get(url));
    let vigente = true;
    void buscar(url, jwt).then((encontrada) => vigente && setVista(encontrada));
    return () => {
      vigente = false;
    };
  }, [url, jwt]);

  if (!vista) return null;
  const compacta = cuadrada || (vista.imagen ? cuadradas.has(vista.imagen) : false);
  /** Un ícono o un logo (cuadrado) va chico al costado, como WhatsApp; una foto ancha, arriba. */
  const alCargar = (evento: { source: { width: number; height: number } }) => {
    if (!vista.imagen || evento.source.width / evento.source.height >= PROPORCION_MINIMA_ANCHA) return;
    cuadradas.add(vista.imagen);
    setCuadrada(true);
  };
  return (
    <Pressable
      testID="vista-previa-enlace"
      onPress={() => void Linking.openURL(vista.url)}
      className={`m-1 mb-0 overflow-hidden rounded-lg ${mia ? 'bg-black/15' : 'bg-primary/[0.06]'}`}
      style={{ width: ANCHO_DE_LA_TARJETA }}
    >
      <View className={compacta ? 'flex-row items-center' : ''}>
      {vista.imagen ? (
        <Image
          recyclingKey={vista.imagen}
          source={{ uri: vista.imagen }}
          style={compacta ? { width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA } : { width: '100%', aspectRatio: PROPORCION_DE_LA_IMAGEN, maxHeight: ALTO_MAXIMO_DE_LA_IMAGEN }}
          contentFit="cover"
          transition={120}
          onLoad={alCargar}
        />
      ) : null}
      <View className="min-w-0 flex-1 gap-0.5 px-2.5 py-2">
        <Text className={`text-[14px] font-semibold ${mia ? 'text-on-burbuja-propia' : 'text-on-burbuja-ajena'}`} numberOfLines={2}>
          {vista.titulo}
        </Text>
        {vista.descripcion ? (
          <Text className={`text-[12px] ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`} numberOfLines={2}>
            {vista.descripcion}
          </Text>
        ) : null}
        <Text className={`text-[11px] ${mia ? 'text-on-burbuja-propia-suave' : 'text-on-surface-variant'}`} numberOfLines={1}>
          {vista.sitio}
        </Text>
      </View>
      </View>
    </Pressable>
  );
}
