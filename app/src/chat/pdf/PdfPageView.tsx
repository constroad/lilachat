import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { pdfPages } from '../../../modules/pdf-pages/src';

/**
 * One page of the PDF viewer (pending 7): a white sheet of the page's size
 * that asks the native renderer for its image only while the list keeps it
 * mounted (the visible pages and a few around them).
 */
export const PdfPageView = memo(function PdfPageView(props: { documentId: string; index: number; width: number; height: number; renderWidth: number }) {
  const { documentId, index, renderWidth } = props;
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!pdfPages) return;
    let alive = true;
    setFailed(false);
    pdfPages
      .renderPage(documentId, index, renderWidth)
      .then((page) => alive && setUri(page.uri))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [documentId, index, renderWidth, attempt]);

  return (
    <View testID={`pdf-pagina-${index + 1}`} style={{ width: props.width, height: props.height }} className="overflow-hidden rounded-md bg-white">
      {uri ? <Image source={{ uri }} recyclingKey={uri} contentFit="contain" transition={120} style={{ width: props.width, height: props.height }} /> : null}
      {!uri && !failed ? (
        <View className="absolute inset-0 items-center justify-center">
          <Text className="text-[13px] text-on-surface-variant">Página {index + 1}</Text>
        </View>
      ) : null}
      {failed ? (
        <Pressable onPress={() => setAttempt((count) => count + 1)} className="absolute inset-0 items-center justify-center px-6">
          <Text className="text-center text-[13px] text-on-surface-variant">No se pudo mostrar la página {index + 1}. Toca para reintentar.</Text>
        </Pressable>
      ) : null}
    </View>
  );
});
