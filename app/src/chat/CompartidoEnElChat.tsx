import { Linking, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ExternalLink, FileText, Video } from 'lucide-react-native';
import { nombreLimpio } from './archivoDescargado';
import { useColores } from '../ui/tema';
import { Rotulo } from '../ui/Rotulo';
import type { ServerMessage } from './socketClient';

/**
 * «Compartido en el chat»: Media, Docs y Links en pestañas, como WhatsApp.
 *
 * Mezclar fotos, PDFs y enlaces en una sola tira obliga a scrollear entre cosas
 * distintas para encontrar la que se busca. Cada pestaña muestra lo suyo; la que
 * está vacía lo dice, en vez de desaparecer y dejar dudando si hubo algo.
 */
export function SeccionCompartido({
  clasificado,
  pestana,
  onPestana,
  onVerMedia,
}: {
  clasificado: {
    medias: ServerMessage[];
    docs: ServerMessage[];
    links: { seq: number; url: string }[];
  };
  pestana: 'media' | 'docs' | 'links';
  onPestana: (p: 'media' | 'docs' | 'links') => void;
  onVerMedia: (m: ServerMessage) => void;
}) {
  const colores = useColores();
  const tabs = [
    { id: 'media' as const, etiqueta: 'Media', n: clasificado.medias.length },
    { id: 'docs' as const, etiqueta: 'Docs', n: clasificado.docs.length },
    { id: 'links' as const, etiqueta: 'Links', n: clasificado.links.length },
  ];

  return (
    <>
      <Rotulo sangrado>Compartido en el chat</Rotulo>
      <View className="mx-4 mb-3 flex-row rounded-xl border border-outline/10 bg-surface p-1">
        {tabs.map((tab) => {
          const activo = pestana === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`tab-${tab.id}`}
              onPress={() => onPestana(tab.id)}
              className={`min-h-[40px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg ${activo ? 'bg-primary/[0.14]' : ''}`}
            >
              <Text
                className={`text-[13px] ${activo ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}
              >
                {tab.etiqueta}
              </Text>
              {tab.n > 0 ? (
                <Text className={`text-[11px] ${activo ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {tab.n}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {pestana === 'media' ? (
        clasificado.medias.length === 0 ? (
          <Vacio texto="Todavía no compartieron fotos ni videos." />
        ) : (
          // Cuadrícula de 3, como la galería de WhatsApp: mejor que una tira
          // horizontal para ver de un vistazo todo lo que hay.
          <View className="flex-row flex-wrap gap-1 px-4">
            {clasificado.medias.map((m) => (
              <Pressable
                key={m.seq}
                testID={`detalle-media-${m.seq}`}
                onPress={() => onVerMedia(m)}
                className="overflow-hidden rounded-md"
                style={{ width: '32.5%', aspectRatio: 1 }}
              >
                <Image
                  source={{ uri: m.media!.thumbUrl! }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {(m.media!.mime ?? '').startsWith('video/') ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-black/50">
                      <Video size={16} color="#ffffff" />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {pestana === 'docs' ? (
        clasificado.docs.length === 0 ? (
          <Vacio texto="Todavía no compartieron documentos." />
        ) : (
          <View className="px-4">
            {clasificado.docs.map((m) => (
              <Pressable
                key={m.seq}
                testID={`detalle-doc-${m.seq}`}
                onPress={() => onVerMedia(m)}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText size={20} color={colores.primary} />
                </View>
                <Text className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface" numberOfLines={2}>
                  {m.media!.fileName ? nombreLimpio(m.media!.fileName) : 'Documento'}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {pestana === 'links' ? (
        clasificado.links.length === 0 ? (
          <Vacio texto="Todavía no compartieron enlaces." />
        ) : (
          <View className="px-4">
            {clasificado.links.map((l, i) => (
              <Pressable
                key={`${l.seq}-${i}`}
                testID={`detalle-link-${l.seq}-${i}`}
                onPress={() => void Linking.openURL(l.url)}
                className="mb-2 min-h-[56px] flex-row items-center gap-3 rounded-xl border border-outline/10 bg-surface p-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ExternalLink size={18} color={colores.primary} />
                </View>
                <Text className="min-w-0 flex-1 text-[13px] text-primary" numberOfLines={2}>
                  {l.url}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <Text className="px-4 pb-2 text-sm text-on-surface-variant">{texto}</Text>;
}
