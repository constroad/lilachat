import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Download, FileText, Film, Image as ImageIcon } from 'lucide-react-native';
import { documentSentLabelOf, type ProspectDocument, type ProspectView } from '@lilachat/shared';
import { offerFileActions } from '../../chat/fileActions';
import { useColores } from '../../ui/tema';
import { Card, Kicker } from './prospectSheetBlocks';
import { fetchProspectDocuments } from './prospectsApi';

/** «Documentos del cliente» (José 17/11): what the prospect sent in their channel; a tap opens or downloads it. */

type DocumentsState = { status: 'loading' } | { status: 'ready'; documents: ProspectDocument[] } | { status: 'failed' };
const KIND_ICON = { image: ImageIcon, video: Film, file: FileText } as const;
const ICON_SIZE = 18;

/** Refetched when the prospect writes again (lastActivityAt), never on a timer. */
function useClientDocuments(jwt: string, spaceId: string, prospect: ProspectView): DocumentsState {
  const [state, setState] = useState<DocumentsState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    void fetchProspectDocuments(jwt, spaceId, prospect.id).then((answer) => {
      if (alive) setState(answer.ok ? { status: 'ready', documents: answer.data.documents } : { status: 'failed' });
    });
    return () => { alive = false; };
  }, [jwt, spaceId, prospect.id, prospect.lastActivityAt]);
  return state;
}

const openDocument = (document: ProspectDocument) =>
  offerFileActions({ url: document.url, cuando: new Date(document.at), mime: document.mime, seq: document.seq, nombre: document.name }, (reason) => Alert.alert('Archivo', reason));

export function ClientDocumentsCard({ jwt, spaceId, prospect }: { jwt: string; spaceId: string; prospect: ProspectView }) {
  const state = useClientDocuments(jwt, spaceId, prospect);
  const colores = useColores();
  if (state.status === 'loading' || (state.status === 'ready' && !state.documents.length)) return null;
  return (
    <Card testID="ficha-documentos">
      <Kicker>Documentos del cliente</Kicker>
      {state.status === 'failed' ? <Text className="mt-2 text-[13px] text-on-surface-variant">No pudimos cargar los documentos. Ábrelos desde el chat.</Text> : (
        <View className="mt-1">
          {state.documents.map((document, index) => {
            const Icon = KIND_ICON[document.kind];
            return (
              <Pressable key={document.seq} testID={`documento-${document.seq}`} accessibilityRole="button" accessibilityLabel={`${document.name}, abrir o descargar`} onPress={() => openDocument(document)} className={`min-h-[48px] flex-row items-center gap-3 py-2 ${index > 0 ? 'border-t border-outline/10' : ''}`}>
                <Icon size={ICON_SIZE} color={colores.primary} />
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[14px] font-semibold text-on-surface">{document.name}</Text>
                  <Text className="text-[12px] text-on-surface-variant">{documentSentLabelOf(document.at)}</Text>
                </View>
                <Download size={16} color={colores['on-surface-variant']} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}
