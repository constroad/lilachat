import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { ExternalLink, FileText } from 'lucide-react-native';
import type { DetailRow, DetailSheet, SheetItem } from '@lilachat/shared';
import { PantallaEnModal } from '../../ui/PantallaEnModal';
import { useColores } from '../../ui/tema';
import type { ViewableFile } from './fileViewer';
import { DETAIL_TONE } from './tones';

const Kicker = ({ children }: { children: string }) => <Text className="mt-2 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{children}</Text>;

function FileButton(props: { title: string; file: { url: string; label: string }; onOpenFile: (file: ViewableFile) => void; testID: string }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} onPress={() => props.onOpenFile({ url: props.file.url, name: `${props.title} · ${props.file.label}` })} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4">
      <FileText size={18} color={colors['on-primary']} />
      <Text className="text-[15px] font-semibold text-on-primary" numberOfLines={1}>{props.file.label === 'PDF' ? 'Ver el PDF' : `Ver ${props.file.label}`}</Text>
    </Pressable>
  );
}

/** A report with no PDF stored: asked to Portal on tap (agentes 30/10); the first one may take a few waits. */
export type PdfOnDemand = { asking: boolean; message: string | null; onAsk: () => void };

function AskPdfButton({ pdf }: { pdf: PdfOnDemand }) {
  const colors = useColores();
  return (
    <>
      <Pressable testID="pedir-pdf-ficha" disabled={pdf.asking} onPress={pdf.onAsk} className={`min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 ${pdf.asking ? 'opacity-70' : ''}`}>
        {pdf.asking ? <ActivityIndicator size="small" color={colors['on-primary']} /> : <FileText size={18} color={colors['on-primary']} />}
        <Text className="text-[15px] font-semibold text-on-primary">{pdf.asking ? 'Generando el PDF…' : 'Ver el PDF'}</Text>
      </Pressable>
      {pdf.message ? <Text testID="pdf-ficha-fallo" className="text-[14px] text-error">{pdf.message}</Text> : null}
    </>
  );
}

const ItemRow = ({ item }: { item: SheetItem }) => (
  <View className="flex-row items-start gap-3 border-t border-outline/10 py-2.5">
    <View className="min-w-0 flex-1">
      <Text className="text-[14px] font-semibold text-on-surface">{item.name}</Text>
      {item.line ? <Text className="mt-0.5 text-[12px] text-on-surface-variant">{item.line}</Text> : null}
    </View>
    {item.total ? <Text className="text-[14px] font-semibold text-on-surface">{item.total}</Text> : null}
  </View>
);

function RelatedRow(props: { row: DetailRow; onOpenFile: (file: ViewableFile) => void }) {
  const { row } = props;
  const file = row.file;
  return (
    <Pressable testID={`relacionado-${row.id}`} disabled={!file} onPress={() => file && props.onOpenFile({ url: file.url, name: `${row.title} · ${file.label}` })} className="min-h-[56px] flex-row items-center gap-3 border-t border-outline/10 py-2">
      <View className="min-w-0 flex-1">
        <Text className="text-[14px] font-semibold text-on-surface">{row.title}</Text>
        {row.line ? <Text className="mt-0.5 text-[12px] text-on-surface-variant" numberOfLines={1}>{row.line}</Text> : null}
        {file ? <Text className="mt-0.5 text-[12px] font-semibold text-primary">{`Ver ${file.label.toLowerCase()}`}</Text> : null}
      </View>
      <Text className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${DETAIL_TONE[row.status.tone]}`}>{row.status.label}</Text>
    </Pressable>
  );
}

/**
 * An order, dispatch, report or quote inside Lilachat (José 30/10: sending him
 * to Portal for every detail was not useful): its facts, its files in the
 * viewer, an order's dispatches and a quote's line items. Portal stays at the
 * foot, secondary.
 */
export function RecordSheet(props: { sheet: DetailSheet | null; onClose: () => void; onOpenFile: (file: ViewableFile) => void; pdf?: PdfOnDemand }) {
  const colors = useColores();
  const { sheet } = props;
  return (
    <PantallaEnModal visible={Boolean(sheet)} titulo={sheet?.title ?? ''} onCerrar={props.onClose} testIDCerrar="cerrar-ficha">
      {sheet ? (
        <View testID="ficha-registro" className="gap-3">
          <Text className={`self-start rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${DETAIL_TONE[sheet.status.tone]}`}>{sheet.status.label}</Text>
          {sheet.facts.length ? (
            <View className="rounded-2xl border border-outline/15 bg-surface px-4">
              {sheet.facts.map((fact, index) => (
                <View key={fact.label} className={`flex-row justify-between gap-3 py-3 ${index ? 'border-t border-outline/10' : ''}`}>
                  <Text className="text-[14px] text-on-surface-variant">{fact.label}</Text>
                  <Text className="min-w-0 flex-shrink text-right text-[14px] font-semibold text-on-surface">{fact.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {sheet.files.map((file, index) => <FileButton key={file.url} title={sheet.title} file={file} onOpenFile={props.onOpenFile} testID={index ? `ver-archivo-ficha-${index}` : 'ver-archivo-ficha'} />)}
          {sheet.pdfOnDemand && props.pdf ? <AskPdfButton pdf={props.pdf} /> : null}
          {sheet.note ? <Text testID="nota-ficha" className="text-[14px] text-on-surface-variant">{sheet.note}</Text> : null}
          {sheet.items.length ? <><Kicker>Partidas</Kicker><View className="rounded-2xl border border-outline/15 bg-surface px-4">{sheet.items.map((item, index) => <ItemRow key={`${item.name}-${index}`} item={item} />)}</View></> : null}
          {sheet.related.length ? <><Kicker>Despachos de este pedido</Kicker><View className="rounded-2xl border border-outline/15 bg-surface px-4">{sheet.related.map((row) => <RelatedRow key={row.id} row={row} onOpenFile={props.onOpenFile} />)}</View></> : null}
          {sheet.url ? (
            <Pressable testID="ficha-en-portal" onPress={() => void Linking.openURL(sheet.url!)} className="min-h-[44px] flex-row items-center gap-1.5">
              <ExternalLink size={15} color={colors['on-surface-variant']} />
              <Text className="text-[14px] text-on-surface-variant">Abrir en el Portal</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </PantallaEnModal>
  );
}
