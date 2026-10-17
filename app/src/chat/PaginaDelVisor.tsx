import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { debeCerrar, desplazamientoPermitido, zoomAcotado, zoomDelDobleToque } from './visor';

/** Debajo de esto el pellizco cuenta como «volvió al tamaño real». */
const UMBRAL_SIN_ZOOM = 1.1;
/** Cuánto hay que arrastrar en vertical antes de que cuente como «cerrar» (dp). */
const ARRANQUE_VERTICAL = 14;
/** Más recorrido que esto ya no es un toque (dp). */
const TOQUE_MAXIMO = 10;
/** A esta distancia la foto ya se ve a medio transparentar (dp). */
const DISTANCIA_DE_DESVANECIDO = 600;

/**
 * Una foto del visor, con los gestos de WhatsApp (17/10/2026): pellizcar para
 * acercar, doble toque para acercar donde se tocó y volver, arrastrar con zoom
 * para recorrerla, arrastrar en vertical sin zoom para cerrar, y un toque para
 * esconder o mostrar las barras. Todo corre en el hilo de UI (Reanimated); al
 * hilo de JS solo cruzan «hay zoom», «cerrar» y «toque».
 *
 * Con zoom, el pager de afuera deja de deslizar (`onZoom`): si no, recorrer
 * una foto ampliada saltaba a la siguiente.
 */
export function PaginaDelVisor({
  url,
  activa,
  ancho,
  alto,
  onZoom,
  onCerrar,
  onToque,
}: {
  url: string;
  /** Es la que se está viendo: al dejar de serlo vuelve al tamaño real. */
  activa: boolean;
  ancho: number;
  alto: number;
  onZoom: (conZoom: boolean) => void;
  onCerrar: () => void;
  onToque: () => void;
}) {
  const [conZoom, setConZoom] = useState(false);
  const zoom = useSharedValue(1);
  const zoomInicial = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xInicial = useSharedValue(0);
  const yInicial = useSharedValue(0);
  const arrastre = useSharedValue(0);

  const avisarZoom = (hay: boolean) => {
    setConZoom(hay);
    onZoom(hay);
  };

  // Al pasar a otra foto, esta vuelve a su tamaño: volver a ella después no
  // tiene que encontrarla ampliada en una esquina.
  useEffect(() => {
    if (activa) return;
    zoom.value = 1;
    x.value = 0;
    y.value = 0;
    setConZoom(false);
  }, [activa, zoom, x, y]);

  const volverAlCentro = () => {
    'worklet';
    zoom.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
  };

  const pellizco = Gesture.Pinch()
    .onStart(() => {
      zoomInicial.value = zoom.value;
    })
    .onUpdate((evento) => {
      zoom.value = zoomAcotado(zoomInicial.value * evento.scale);
    })
    .onEnd(() => {
      const hay = zoom.value > UMBRAL_SIN_ZOOM;
      if (!hay) volverAlCentro();
      runOnJS(avisarZoom)(hay);
    });

  const recorrer = Gesture.Pan()
    .enabled(conZoom)
    .onStart(() => {
      xInicial.value = x.value;
      yInicial.value = y.value;
    })
    .onUpdate((evento) => {
      x.value = desplazamientoPermitido({ desplazamiento: xInicial.value + evento.translationX, zoom: zoom.value, lado: ancho });
      y.value = desplazamientoPermitido({ desplazamiento: yInicial.value + evento.translationY, zoom: zoom.value, lado: alto });
    });

  // Sin zoom, el arrastre VERTICAL cierra; el horizontal se suelta y lo toma
  // el pager para pasar de foto.
  const cerrar = Gesture.Pan()
    .enabled(!conZoom)
    .activeOffsetY([-ARRANQUE_VERTICAL, ARRANQUE_VERTICAL])
    .failOffsetX([-ARRANQUE_VERTICAL, ARRANQUE_VERTICAL])
    .onUpdate((evento) => {
      arrastre.value = evento.translationY;
    })
    .onEnd((evento) => {
      if (debeCerrar({ dy: evento.translationY, vy: evento.velocityY })) runOnJS(onCerrar)();
      else arrastre.value = withSpring(0, { damping: 18, stiffness: 200 });
    });

  const dobleToque = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((evento) => {
      const destino = zoomDelDobleToque(zoom.value);
      if (destino === 1) volverAlCentro();
      else {
        // Acerca DONDE se tocó: el punto tocado queda en el centro.
        zoom.value = withTiming(destino);
        x.value = withTiming(desplazamientoPermitido({ desplazamiento: (ancho / 2 - evento.x) * (destino - 1), zoom: destino, lado: ancho }));
        y.value = withTiming(desplazamientoPermitido({ desplazamiento: (alto / 2 - evento.y) * (destino - 1), zoom: destino, lado: alto }));
      }
      runOnJS(avisarZoom)(destino > 1);
    });

  // Un toque es un toque: con recorrido, era el final de un arrastre y no
  // tiene que esconder las barras.
  const toque = Gesture.Tap()
    .maxDistance(TOQUE_MAXIMO)
    .onEnd(() => {
      runOnJS(onToque)();
    });

  const gesto = Gesture.Simultaneous(pellizco, recorrer, cerrar, Gesture.Exclusive(dobleToque, toque));

  const estilo = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(arrastre.value) / DISTANCIA_DE_DESVANECIDO, 0.5),
    transform: [{ translateX: x.value }, { translateY: y.value + arrastre.value }, { scale: zoom.value }],
  }));

  return (
    <GestureDetector gesture={gesto}>
      <Animated.View style={[{ width: ancho, height: alto }, estilo]} testID="visor-pagina">
        {/* `contain` y no `cover`: recortar una foto de obra puede dejar afuera
            justo el dato que se fue a mirar. */}
        <Image source={{ uri: url }} style={{ width: ancho, height: alto }} contentFit="contain" transition={120} />
      </Animated.View>
    </GestureDetector>
  );
}
