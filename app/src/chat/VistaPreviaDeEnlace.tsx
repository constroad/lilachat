import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Play } from 'lucide-react-native';
import { esMiniaturaCompacta } from '@lilachat/shared';
import { useVistaPrevia } from './useVistaPrevia';

/** La foto de la tarjeta: el formato de `og:image` (1.91:1), con tope de alto. */
const PROPORCION_DE_LA_IMAGEN = 1.91;
/** Ancho fijo: con un link corto la burbuja quedaba angosta y la tarjeta, apretada. */
const ANCHO_DE_LA_TARJETA = 260;
const ALTO_MAXIMO_DE_LA_IMAGEN = 160;
const LADO_DE_LA_MINIATURA = 72;
/** Imágenes que resultaron cuadradas: la próxima vez nacen en su forma, sin saltar. */
const cuadradas = new Set<string>();

/**
 * A link card inside the bubble, like WhatsApp (José, 18/10): the image, title,
 * description and site, taken by the server from the page's `og:` tags. While
 * it travels its place is reserved; if the page has none, nothing is drawn and
 * the usual tappable link stays.
 */
export function VistaPreviaDeEnlace({ url, jwt, mia }: { url: string; jwt: string; mia: boolean }) {
  const vista = useVistaPrevia(url, jwt);
  const [cuadrada, setCuadrada] = useState(false);
  // Una imagen que no carga (un `og:image` roto) no deja un hueco: la tarjeta sigue sin ella (20/10).
  const [sinImagen, setSinImagen] = useState(false);

  // While it travels, the card's place is reserved (most links have a wide image): born at 0 dp it pushed the chat when it arrived (20/10).
  if (vista === undefined) return <ReservedCard mine={mia} />;
  if (!vista) return null;
  const imagen = sinImagen ? undefined : vista.imagen;
  // Un video (YouTube, TikTok, un reel) va siempre grande, con el play encima, como WhatsApp.
  const compacta = !vista.video && (cuadrada || (imagen ? cuadradas.has(imagen) : false));
  /** Un ícono o un logo (cuadrado) va chico al costado, como WhatsApp; una foto ancha, arriba. */
  const alCargar = (evento: { source: { width: number; height: number } }) => {
    if (!imagen || !esMiniaturaCompacta({ ancho: evento.source.width, alto: evento.source.height, video: vista.video })) return;
    cuadradas.add(imagen);
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
      {imagen ? (
        <View>
          <Image
            recyclingKey={imagen}
            source={{ uri: imagen }}
            style={compacta ? { width: LADO_DE_LA_MINIATURA, height: LADO_DE_LA_MINIATURA } : { width: '100%', aspectRatio: PROPORCION_DE_LA_IMAGEN, maxHeight: ALTO_MAXIMO_DE_LA_IMAGEN }}
            contentFit="cover"
            transition={120}
            onLoad={alCargar}
            onError={() => setSinImagen(true)}
          />
          {vista.video ? (
            <View testID="play-vista-previa" pointerEvents="none" className="absolute inset-0 items-center justify-center">
              <View className="h-12 w-12 items-center justify-center rounded-full bg-black/55">
                <Play size={22} color="white" fill="white" />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
      {/* `flex-1` solo al costado de la miniatura: en columna, con base 0, el texto
          colapsaba a alto cero al relayout (tarjeta dentro de un recordatorio elegido, 20/10). */}
      <View className={`gap-0.5 px-2.5 py-2 ${compacta ? 'min-w-0 flex-1' : ''}`}>
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

/** The place of a wide card while its preview travels: same width, image and text height. */
function ReservedCard({ mine }: { mine: boolean }) {
  return (
    <View testID="vista-previa-reservada" className={`m-1 mb-0 overflow-hidden rounded-lg ${mine ? 'bg-black/15' : 'bg-primary/[0.06]'}`} style={{ width: ANCHO_DE_LA_TARJETA }}>
      <View className={mine ? 'bg-black/10' : 'bg-primary/10'} style={{ width: '100%', aspectRatio: PROPORCION_DE_LA_IMAGEN, maxHeight: ALTO_MAXIMO_DE_LA_IMAGEN }} />
      <View className="gap-1.5 px-2.5 py-2">
        <View className={`h-3.5 w-4/5 rounded ${mine ? 'bg-black/10' : 'bg-primary/10'}`} />
        <View className={`h-3 w-3/5 rounded ${mine ? 'bg-black/10' : 'bg-primary/10'}`} />
        <View className={`h-2.5 w-1/3 rounded ${mine ? 'bg-black/10' : 'bg-primary/10'}`} />
      </View>
    </View>
  );
}
