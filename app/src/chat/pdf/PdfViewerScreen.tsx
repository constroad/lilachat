import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, PixelRatio, Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, ZoomIn, ZoomOut } from 'lucide-react-native';
import { Modal } from '../../ui/Modal';
import { useColores } from '../../ui/tema';
import { useMargenes } from '../../ui/useMargenes';
import { abrirConOtraApp } from '../guardarYCompartir';
import { listOffsetAfterZoom, nextZoom, pageAtOffset, pinchScaleBounds, sidewaysCenterAfterZoom, pageCounterLabel, pageDisplayHeight, pageDisplayWidth, pageOffsets, pageRenderWidth, PDF_PAGE_GAP, PDF_SIDE_MARGIN, PDF_ZOOM_STEPS, zoomAfterDoubleTap, zoomAfterPinch, zoomLabel } from './pdfLayout';
import { PDF_FAILURE_TEXT, type ChatPdf } from './pdfSource';
import { PdfPageView } from './PdfPageView';
import { usePdfDocument } from './usePdfDocument';

/** Pages kept mounted around the visible ones: enough to scroll without blanks, few bitmaps alive. */
const WINDOW_SIZE = 5;
/** A pinch that does not land on another step eases back to the size it had, in ms. */
const PINCH_SETTLE_MS = 160;
/** The longest pause between the two taps of a double tap, in ms. */
const DOUBLE_TAP_DELAY_MS = 250;

/** Where the fingers were, from the top-left of the pages' area. */
type ZoomAnchor = { x: number; y: number };

/**
 * The PDF viewer inside the chat (pending 7, design `visor-archivos`): the
 * pages one under the other, zoom by steps (buttons, a two-finger pinch,
 * José 17/11, or a double tap, José 18/11), the «3 / 14» pill to move by page,
 * and the chat's other PDFs at the foot. «Abrir con otra app» stays as the
 * way out (a PDF with a password, or a reader that does more).
 */
export function PdfViewerScreen(props: { pdf: ChatPdf | null; others: readonly ChatPdf[]; onPick: (seq: number) => void; onClose: () => void }) {
  const { pdf } = props;
  const colors = useColores();
  const margins = useMargenes();
  const screen = useWindowDimensions();
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState<number>(PDF_ZOOM_STEPS[0]);
  const [page, setPage] = useState(0);
  const [listHeight, setListHeight] = useState(screen.height);
  const [openError, setOpenError] = useState('');
  const list = useRef<FlatList<number>>(null);
  const sideways = useRef<ScrollView>(null);
  const sidewaysX = useRef(0);
  const pendingSidewaysX = useRef<number | null>(null);
  const listY = useRef(0);
  const document = usePdfDocument(pdf, attempt);
  const pages = document.status === 'ready' ? document.pages : [];
  const width = pageDisplayWidth(screen.width, zoom);
  const renderWidth = pageRenderWidth(width, PixelRatio.get());
  const offsets = useMemo(() => pageOffsets(pages, width), [pages, width]);
  const indexes = useMemo(() => pages.map((_, index) => index), [pages]);

  const pinch = usePdfPinch({ zoom, width: screen.width, height: listHeight, onPinchEnd: (scale, anchor) => applyZoom(zoomAfterPinch(zoom, scale), anchor), onDoubleTap: (anchor) => applyZoom(zoomAfterDoubleTap(zoom), anchor) });

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    listY.current = event.nativeEvent.contentOffset.y;
    const current = pageAtOffset(offsets, event.nativeEvent.contentOffset.y, listHeight);
    if (current !== page) setPage(current);
  };
  const goTo = (index: number) => {
    const target = Math.max(0, Math.min(pages.length - 1, index));
    list.current?.scrollToOffset({ offset: (offsets[target] ?? 0) - PDF_PAGE_GAP, animated: true });
    setPage(target);
  };
  /**
   * The buttons keep the current page at the top and the middle of the screen
   * on the same spot; a pinch keeps the spot under the fingers (`anchor`).
   * At 100 % there is no sideways room left.
   */
  const applyZoom = (target: number, anchor?: ZoomAnchor) => {
    if (target === zoom) {
      pinch.settle();
      return;
    }
    const ratio = target / zoom;
    const after = pageOffsets(pages, pageDisplayWidth(screen.width, target));
    const x = target === PDF_ZOOM_STEPS[0] ? 0 : sidewaysCenterAfterZoom(sidewaysX.current, screen.width, ratio, anchor?.x);
    const y = anchor ? listOffsetAfterZoom({ before: offsets, after, scrollY: listY.current, anchorY: anchor.y, ratio }) : (after[page] ?? 0) - PDF_PAGE_GAP;
    setZoom(target);
    sidewaysX.current = x;
    // Zooming in, the wider content is not laid out yet in the next frame and Android clamps the scroll to 0
    // (seen on the emulator 17/11: a pinch to 300 % showed the left edge). It is applied again once the size changes.
    pendingSidewaysX.current = x;
    listY.current = y;
    requestAnimationFrame(() => {
      list.current?.scrollToOffset({ offset: y, animated: false });
      sideways.current?.scrollTo({ x, animated: false });
      pinch.reset();
    });
  };
  const changeZoom = (direction: 1 | -1) => applyZoom(nextZoom(zoom, direction));
  const openOutside = async () => {
    if (!pdf) return;
    setOpenError('');
    const opened = await abrirConOtraApp({ url: pdf.url, cuando: new Date(pdf.at), mime: pdf.mime, seq: pdf.seq, nombre: pdf.name });
    if (!opened.ok) setOpenError(opened.motivo);
  };
  const close = () => {
    setZoom(PDF_ZOOM_STEPS[0]);
    setPage(0);
    setOpenError('');
    props.onClose();
  };
  // Each row carries the gap above its page: row i starts where page i starts minus that gap.
  const getItemLayout = useCallback((_: ArrayLike<number> | null | undefined, index: number) => ({ length: pageDisplayHeight(pages[index] ?? { width: 1, height: 1 }, width) + PDF_PAGE_GAP, offset: (offsets[index] ?? PDF_PAGE_GAP) - PDF_PAGE_GAP, index }), [offsets, pages, width]);

  return (
    <Modal visible={Boolean(pdf)} animationType="slide" onRequestClose={close}>
      {/* Its own root: if the modal falls back to a native window, the app's root does not reach it (nested, it is a plain view). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View testID="visor-pdf" className="flex-1 bg-background">
          <View className="flex-row items-center gap-1 border-b border-outline/10 bg-surface px-1" style={{ paddingTop: margins.cabecera }}>
            <Pressable testID="btn-cerrar-pdf" accessibilityLabel="Volver al chat" onPress={close} className="h-12 w-12 items-center justify-center">
              <ArrowLeft size={22} color={colors['on-surface']} />
            </Pressable>
            <View className="flex-1">
              <Text testID="pdf-nombre" numberOfLines={1} className="text-[16px] font-semibold text-on-surface">{pdf?.name ?? ''}</Text>
              {pages.length > 0 ? <Text className="text-[12px] text-on-surface-variant">{pages.length === 1 ? '1 página' : `${pages.length} páginas`}</Text> : null}
            </View>
            <Pressable testID="btn-pdf-reducir" accessibilityLabel="Reducir" disabled={zoom === PDF_ZOOM_STEPS[0]} onPress={() => changeZoom(-1)} className={`h-12 w-10 items-center justify-center ${zoom === PDF_ZOOM_STEPS[0] ? 'opacity-40' : ''}`}>
              <ZoomOut size={20} color={colors['on-surface']} />
            </Pressable>
            <Text testID="pdf-zoom" className="w-12 text-center text-[13px] font-medium text-on-surface">{zoomLabel(zoom)}</Text>
            <Pressable testID="btn-pdf-ampliar" accessibilityLabel="Ampliar" disabled={zoom === PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]} onPress={() => changeZoom(1)} className="h-12 w-10 items-center justify-center">
              <ZoomIn size={20} color={colors['on-surface']} />
            </Pressable>
            <Pressable testID="btn-pdf-otra-app" accessibilityLabel="Abrir con otra app" onPress={() => void openOutside()} className="h-12 w-12 items-center justify-center">
              <ExternalLink size={20} color={colors['on-surface']} />
            </Pressable>
          </View>
          {openError ? <Text className="bg-error/10 px-4 py-2 text-[13px] text-error">{openError}</Text> : null}

          {document.status === 'ready' && document.pages.length > 0 ? (
            <View className="flex-1" onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
              <GestureDetector gesture={pinch.outer}>
                <View collapsable={false} className="flex-1 overflow-hidden">
                  <Animated.View style={[{ flex: 1 }, pinch.previewStyle]}>
                    <GestureDetector gesture={pinch.sideways}>
                      <ScrollView
                        ref={sideways}
                        onContentSizeChange={() => {
                          if (pendingSidewaysX.current === null) return;
                          sideways.current?.scrollTo({ x: pendingSidewaysX.current, animated: false });
                          pendingSidewaysX.current = null;
                        }}
                        onScroll={(event) => {
                          sidewaysX.current = event.nativeEvent.contentOffset.x;
                        }}
                        scrollEventThrottle={64}
                        horizontal
                        scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1} contentContainerStyle={{ minWidth: screen.width }}>
                        <GestureDetector gesture={pinch.list}>
                          <FlatList
                            ref={list}
                            testID="pdf-paginas"
                            data={indexes}
                            keyExtractor={(index) => String(index)}
                            style={{ width: width + PDF_SIDE_MARGIN * 2 }}
                            contentContainerStyle={{ paddingHorizontal: PDF_SIDE_MARGIN, paddingBottom: 96 }}
                            renderItem={({ item: index }) => (
                              <View style={{ paddingTop: PDF_PAGE_GAP }}>
                                <PdfPageView documentId={document.id} index={index} width={width} height={pageDisplayHeight(document.pages[index]!, width)} renderWidth={renderWidth} />
                              </View>
                            )}
                            getItemLayout={getItemLayout}
                            onScroll={onScroll}
                            scrollEventThrottle={64}
                            initialNumToRender={2}
                            maxToRenderPerBatch={2}
                            windowSize={WINDOW_SIZE}
                            removeClippedSubviews
                            nestedScrollEnabled
                          />
                        </GestureDetector>
                      </ScrollView>
                    </GestureDetector>
                  </Animated.View>
                </View>
              </GestureDetector>
              {pages.length > 1 ? (
                <View pointerEvents="box-none" className="absolute inset-x-0 bottom-4 items-center">
                  <View className="flex-row items-center rounded-full bg-black/75 px-1">
                    <Pressable testID="btn-pdf-anterior" accessibilityLabel="Página anterior" onPress={() => goTo(page - 1)} className="h-11 w-11 items-center justify-center">
                      <ChevronLeft size={20} color="white" />
                    </Pressable>
                    <Text testID="pdf-contador" accessibilityLabel={pageCounterLabel(page, pages.length)} className="min-w-[56px] text-center text-[14px] font-semibold text-white">
                      {page + 1} / {pages.length}
                    </Text>
                    <Pressable testID="btn-pdf-siguiente" accessibilityLabel="Página siguiente" onPress={() => goTo(page + 1)} className="h-11 w-11 items-center justify-center">
                      <ChevronRight size={20} color="white" />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : document.status === 'failed' ? (
            <View testID="pdf-error" className="flex-1 items-center justify-center px-8">
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                <FileText size={30} color={colors['on-surface-variant']} />
              </View>
              <Text className="mt-4 text-center text-[15px] text-on-surface">{PDF_FAILURE_TEXT[document.failure]}</Text>
              <View className="mt-6 flex-row gap-3">
                {document.failure === 'download' || document.failure === 'generating' ? (
                  <Pressable testID="btn-pdf-reintentar" onPress={() => setAttempt((count) => count + 1)} className="min-h-[48px] items-center justify-center rounded-full border border-primary px-6">
                    <Text className="text-sm font-semibold text-primary">Reintentar</Text>
                  </Pressable>
                ) : null}
                <Pressable testID="btn-pdf-abrir-afuera" onPress={() => void openOutside()} className="min-h-[48px] items-center justify-center rounded-full bg-primary px-6">
                  <Text className="text-sm font-semibold text-on-primary">Abrir con otra app</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View testID="pdf-cargando" className="flex-1 items-center px-3 pt-3">
              <View style={{ width: pageDisplayWidth(screen.width, 1), height: pageDisplayWidth(screen.width, 1) * 1.3 }} className="items-center justify-center rounded-md bg-surface">
                <Text className="text-[13px] text-on-surface-variant">{document.status === 'ready' ? 'El PDF no tiene páginas.' : 'Abriendo el PDF…'}</Text>
              </View>
            </View>
          )}

          {props.others.length > 1 ? (
            <View className="border-t border-outline/10 bg-surface pt-2" style={{ paddingBottom: margins.pie }}>
              <Text className="px-4 text-[11px] font-semibold uppercase tracking-[1.5px] text-on-surface-variant">Compartido en el chat</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
                {props.others.map((other) => {
                  const active = other.seq === pdf?.seq;
                  return (
                    <Pressable
                      key={other.seq}
                      testID={`pdf-otro-${other.seq}`}
                      onPress={() => {
                        if (active) return;
                        setZoom(PDF_ZOOM_STEPS[0]);
                        setPage(0);
                        props.onPick(other.seq);
                      }}
                      className={`w-[112px] items-center rounded-xl border px-2 py-2 ${active ? 'border-primary bg-primary/10' : 'border-outline/15 bg-background'}`}
                    >
                      <FileText size={22} color={active ? colors.primary : colors['on-surface-variant']} />
                      <Text numberOfLines={1} className={`mt-1 text-[12px] ${active ? 'font-semibold text-primary' : 'text-on-surface'}`}>{other.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * The two-finger pinch over the pages: while the fingers move the pages grow
 * around them as a transform (nothing re-renders, the bitmaps stay), and on
 * release the screen lands on the nearest zoom step. It runs together with
 * both scrolls, so a scroll already under way never swallows it.
 */
function usePdfPinch(params: { zoom: number; width: number; height: number; onPinchEnd: (scale: number, anchor: ZoomAnchor) => void; onDoubleTap: (anchor: ZoomAnchor) => void }) {
  const { zoom, width, height } = params;
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const minScale = useSharedValue(1);
  const maxScale = useSharedValue(1);
  const latestEnd = useRef(params.onPinchEnd);
  latestEnd.current = params.onPinchEnd;
  const latestDoubleTap = useRef(params.onDoubleTap);
  latestDoubleTap.current = params.onDoubleTap;
  useEffect(() => {
    const bounds = pinchScaleBounds(zoom);
    minScale.value = bounds.min;
    maxScale.value = bounds.max;
  }, [zoom, minScale, maxScale]);
  // Only numbers cross to JS: a JS function passed as an argument of `runOnJS` does not arrive.
  const finish = useCallback((pinchScale: number, x: number, y: number) => latestEnd.current(pinchScale, { x, y }), []);
  const finishDoubleTap = useCallback((x: number, y: number) => latestDoubleTap.current({ x, y }), []);
  const gestures = useMemo(() => {
    const sideways = Gesture.Native();
    const list = Gesture.Native().simultaneousWithExternalGesture(sideways);
    const pinch = Gesture.Pinch()
      .simultaneousWithExternalGesture(sideways, list)
      .onStart((event) => {
        focalX.value = event.focalX;
        focalY.value = event.focalY;
      })
      .onUpdate((event) => {
        scale.value = Math.min(maxScale.value, Math.max(minScale.value, event.scale));
      })
      .onEnd((_event, success) => {
        if (success) runOnJS(finish)(scale.value, focalX.value, focalY.value);
        else scale.value = withTiming(1, { duration: PINCH_SETTLE_MS });
      });
    // Its spot is in the same frame as the pinch's fingers: both live on the outer detector.
    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_DELAY_MS)
      .simultaneousWithExternalGesture(sideways, list)
      .onEnd((event, success) => {
        if (success) runOnJS(finishDoubleTap)(event.x, event.y);
      });
    return { outer: Gesture.Simultaneous(pinch, doubleTap), sideways, list };
  }, [finish, finishDoubleTap, scale, focalX, focalY, minScale, maxScale]);
  // Scaled around the fingers: RN scales around the middle, the shift moves that origin.
  const previewStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (focalX.value - width / 2) * (1 - scale.value) }, { translateY: (focalY.value - height / 2) * (1 - scale.value) }, { scale: scale.value }],
  }));
  const reset = useCallback(() => {
    scale.value = 1;
  }, [scale]);
  const settle = useCallback(() => {
    scale.value = withTiming(1, { duration: PINCH_SETTLE_MS });
  }, [scale]);
  return { ...gestures, previewStyle, reset, settle };
}
