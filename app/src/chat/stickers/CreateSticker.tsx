import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Modal } from '../../ui/Modal';
import * as ImagePicker from 'expo-image-picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Bookmark, Pencil, Scissors, Send, Smile, Trash2, Undo2, X } from 'lucide-react-native';
import { editSticker, initialEditorState, layersForComposition, STICKER_SIZE, TEXT_COLORS, type LibrarySticker } from '@lilachat/shared';
import { composeSticker, subjectCutout } from '../../../modules/subject-cutout/src';
import { useMargenes } from '../../ui/useMargenes';
import { useColores } from '../../ui/tema';
import { reportarError } from '../../ui/reportarError';
import { StickerCanvas } from './StickerCanvas';
import type { ApiOutcome } from './stickersApi';

const EMOJIS = ['😂', '😍', '🔥', '👍', '🎉', '❤️', '😎', '🙏', '💯', '🥳', '😮', '😢', '🤝', '👏', '🚀', '⭐', '😅', '🤣', '😘', '🤔', '👌', '💪', '✅', '🏗️'];
/** Pencil line width, relative to the sticker side (WhatsApp's medium pen). */
const PEN_WIDTH = 0.022;
const NO_CUTOUT = 'No se pudo quitar el fondo: el sticker va con la foto entera.';
type Phase = 'picking' | 'cutting' | 'editing' | 'saving';
type Tool = 'none' | 'emoji' | 'pen';

/**
 * ML Kit's cutout. The first time Play services downloads the model (a few
 * seconds): `prepare` waits for it with a limit; if it did not arrive the
 * editor says so and «Recortar» tries again.
 */
async function removeBackground(uri: string): Promise<{ uri: string } | { reason: string }> {
  if (!subjectCutout) return { reason: NO_CUTOUT };
  try {
    if (!(await subjectCutout.prepare())) return { reason: 'El recorte automático se está descargando (solo la primera vez). Toca «Recortar» en un rato; mientras, va la foto entera.' };
    return { uri: (await subjectCutout.cutout(uri)).uri };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_NO_SUBJECT') return { reason: 'No encontré a nadie ni nada para recortar: va la foto entera.' };
    reportarError('CreateSticker.removeBackground', error);
    return { reason: NO_CUTOUT };
  }
}

/** One button of the toolbar pill (design: cut · Aa · emoji · pencil · undo). */
function ToolButton(props: { testID: string; label: string; active?: boolean; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable testID={props.testID} accessibilityLabel={props.label} disabled={props.disabled} onPress={props.onPress} className={`h-10 min-w-10 flex-row items-center justify-center gap-1.5 rounded-full px-2.5 ${props.active ? 'bg-primary' : ''}`}>
      {props.children}
    </Pressable>
  );
}

/**
 * «Crear sticker» (José, 20/10: «I upload a photo, the background goes away, I
 * add text and make the sticker, like WhatsApp»; design `s1-app-crear-sticker`).
 * Pick a photo, ML Kit removes the background on the phone, then text, emojis
 * and the pencil on top (move, pinch, rotate), white outline, and it is kept in
 * «Mis stickers» or sent to the chat.
 */
export function CreateSticker(props: { visible: boolean; chatName: string; onClose: () => void; onSave: (file: { uri: string; width: number; height: number }) => Promise<ApiOutcome<LibrarySticker>>; onSend: (sticker: LibrarySticker) => Promise<boolean> }) {
  const colors = useColores();
  const margins = useMargenes();
  const [phase, setPhase] = useState<Phase>('picking');
  const [original, setOriginal] = useState<string | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [tool, setTool] = useState<Tool>('none');
  const [penColor, setPenColor] = useState<string>(TEXT_COLORS[0]);
  const [typing, setTyping] = useState<{ id: string | null; text: string } | null>(null);
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [state, dispatch] = useReducer(editSticker, undefined, initialEditorState);
  const image = state.cutout && cutout ? cutout : original;
  const { visible, onClose } = props;
  // Opening depends ONLY on `visible`: with `onClose` (a new function on each
  // panel render) saving the sticker used to reopen the gallery (E2E, 20/10).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    let current = true;
    setPhase('picking');
    setOriginal(null);
    setCutout(null);
    setPreview(null);
    setNotice('');
    setTool('none');
    void (async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!current) return;
      if (picked.canceled || !picked.assets[0]) return closeRef.current();
      setOriginal(picked.assets[0].uri);
      setPhase('cutting');
      const result = await removeBackground(picked.assets[0].uri);
      if (!current) return;
      if ('uri' in result) setCutout(result.uri);
      else setNotice(result.reason);
      setPhase('editing');
    })();
    return () => {
      current = false;
    };
  }, [visible]);

  // The image with its outline (the same composition as the final sticker, without layers).
  useEffect(() => {
    if (!image) return;
    let current = true;
    composeSticker({ image, outline: state.outline, layers: [] })
      .then((result) => current && setPreview(result.uri))
      .catch(() => current && setPreview(image));
    return () => {
      current = false;
    };
  }, [image, state.outline]);

  /** «Recortar»: toggles the cutout; if there is none yet (the model was downloading), tries again. */
  const pressCutout = async () => {
    if (cutout) return dispatch({ type: 'toggle-cutout' });
    if (!original || phase !== 'editing') return;
    setPhase('cutting');
    const result = await removeBackground(original);
    if ('uri' in result) {
      setCutout(result.uri);
      setNotice('');
    } else setNotice(result.reason);
    setPhase('editing');
  };

  const finish = async (send: boolean) => {
    if (!image || phase === 'saving') return;
    setPhase('saving');
    try {
      const built = await composeSticker({ image, outline: state.outline, layers: layersForComposition(state) });
      const saved = await props.onSave({ uri: built.uri, width: STICKER_SIZE, height: STICKER_SIZE });
      if (!saved.ok) throw new Error(saved.reason);
      if (send && !(await props.onSend(saved.data))) throw new Error('Se guardó en Mis stickers, pero no se pudo mandar.');
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo armar el sticker.');
      setPhase('editing');
    }
  };

  const saveText = () => {
    if (!typing) return;
    if (typing.id) dispatch({ type: 'set-text', id: typing.id, text: typing.text });
    else dispatch({ type: 'add-text', text: typing.text });
    setTyping(null);
  };

  const selected = state.layers.find((layer) => layer.id === state.selection);
  const drawing = tool === 'pen';
  const activeColor = drawing ? penColor : selected?.color;
  const pickColor = (color: string) => (drawing ? setPenColor(color) : dispatch({ type: 'set-color', color }));
  const ready = phase === 'editing';
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View testID="crear-sticker" className="flex-1" style={{ backgroundColor: 'black', paddingTop: margins.cabecera, paddingBottom: margins.pie }}>
          <View className="flex-row items-center justify-between px-3">
            <Pressable testID="btn-cerrar-sticker" accessibilityLabel="Cerrar" onPress={onClose} className="h-11 w-11 items-center justify-center">
              <X size={24} color="white" />
            </Pressable>
            <View className="flex-row items-center gap-0.5 rounded-full p-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <ToolButton testID="btn-recortar" label="Quitar el fondo" active={state.cutout && Boolean(cutout)} disabled={!ready} onPress={() => void pressCutout()}>
                <Scissors size={18} color="white" />
                <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>Recortar</Text>
              </ToolButton>
              <ToolButton testID="btn-texto-sticker" label="Agregar texto" disabled={!ready} onPress={() => { setTool('none'); setTyping({ id: null, text: '' }); }}>
                <Text className="text-[17px] font-bold" style={{ color: 'white' }}>Aa</Text>
              </ToolButton>
              <ToolButton testID="btn-emoji-sticker" label="Agregar emoji" active={tool === 'emoji'} disabled={!ready} onPress={() => setTool((before) => (before === 'emoji' ? 'none' : 'emoji'))}>
                <Smile size={20} color="white" />
              </ToolButton>
              <ToolButton testID="btn-lapiz-sticker" label="Dibujar" active={drawing} disabled={!ready} onPress={() => { dispatch({ type: 'select', id: null }); setTool((before) => (before === 'pen' ? 'none' : 'pen')); }}>
                <Pencil size={19} color="white" />
              </ToolButton>
              <ToolButton testID="btn-deshacer-sticker" label="Deshacer" disabled={!ready} onPress={() => dispatch({ type: 'undo' })}>
                <Undo2 size={19} color="white" />
              </ToolButton>
            </View>
          </View>

          <View className="flex-1 px-4 py-4" onLayout={(event) => setArea({ width: event.nativeEvent.layout.width - 32, height: event.nativeEvent.layout.height - 32 })}>
            {phase === 'picking' || phase === 'cutting' || area.width === 0 ? (
              <View className="flex-1 items-center justify-center gap-3">
                <ActivityIndicator color="white" />
                <Text style={{ color: 'white' }}>{phase === 'cutting' ? 'Quitando el fondo…' : 'Elige una foto'}</Text>
              </View>
            ) : (
              <StickerCanvas
                width={area.width}
                height={area.height}
                image={preview}
                layers={state.layers}
                selection={state.selection}
                cutoutBadge={state.cutout && Boolean(cutout)}
                pen={drawing ? { color: penColor, width: PEN_WIDTH } : null}
                onSelect={(id) => dispatch({ type: 'select', id })}
                onEditText={(id) => setTyping({ id, text: state.layers.find((layer) => layer.id === id)?.text ?? '' })}
                onTransform={(id, change) => dispatch({ type: 'transform', id, ...change })}
                onStroke={(points) => dispatch({ type: 'add-stroke', points, color: penColor, width: PEN_WIDTH })}
              />
            )}
            {notice ? <Text testID="aviso-sticker" className="absolute bottom-6 left-8 right-8 rounded-xl px-3 py-2 text-center text-[13px]" style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.65)' }}>{notice}</Text> : null}
          </View>

          {tool === 'emoji' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2, paddingHorizontal: 12 }} style={{ flexGrow: 0 }}>
              {EMOJIS.map((emoji) => (
                <Pressable key={emoji} testID={`emoji-sticker-${emoji}`} onPress={() => { dispatch({ type: 'add-emoji', emoji }); setTool('none'); }} className="h-12 w-12 items-center justify-center"><Text className="text-[28px]">{emoji}</Text></Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View className="flex-row items-center justify-between gap-2 border-t px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <View className="flex-row items-center gap-0.5 rounded-full px-1.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              {TEXT_COLORS.map((color) => (
                <Pressable key={color} testID={`color-sticker-${color}`} accessibilityLabel={`Color ${color}`} onPress={() => pickColor(color)} hitSlop={4} className="h-8 w-8 items-center justify-center rounded-full" style={{ borderWidth: activeColor === color ? 2.5 : 0, borderColor: colors.primary }}>
                  <View className="h-5 w-5 rounded-full" style={{ backgroundColor: color, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }} />
                </Pressable>
              ))}
            </View>
            {selected ? (
              <Pressable testID="btn-borrar-capa" accessibilityLabel="Borrar" onPress={() => dispatch({ type: 'remove', id: selected.id })} className="h-10 w-10 items-center justify-center"><Trash2 size={20} color="white" /></Pressable>
            ) : (
              <Pressable testID="btn-borde-sticker" onPress={() => dispatch({ type: 'toggle-outline' })} className="h-10 flex-row items-center gap-2 rounded-full border px-3" style={{ borderColor: state.outline ? colors.primary : 'rgba(255,255,255,0.3)' }}>
                <View className="h-4 w-4 items-center justify-center rounded-full border-2" style={{ borderColor: state.outline ? colors.primary : 'white' }}>{state.outline ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</View>
                <Text className="text-[13px] font-semibold" style={{ color: 'white' }}>Borde</Text>
                <Text className="rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ color: 'white', backgroundColor: state.outline ? colors.primary : 'rgba(255,255,255,0.15)' }}>{state.outline ? 'ON' : 'OFF'}</Text>
              </Pressable>
            )}
          </View>

          <View className="px-4">
            <View className="flex-row items-center justify-between">
              <Text numberOfLines={1} className="min-w-0 flex-1 text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>Para: <Text style={{ color: 'white', fontWeight: '600' }}>{props.chatName}</Text></Text>
              <Text className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>Sticker personal</Text>
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Pressable testID="btn-guardar-sticker" disabled={!ready} onPress={() => void finish(false)} className="min-h-[44px] flex-row items-center gap-2">
                <Bookmark size={18} color="white" />
                <Text className="text-[14px] font-semibold" style={{ color: 'white' }}>Guardar en Mis stickers</Text>
              </Pressable>
              <Pressable testID="btn-mandar-sticker" accessibilityLabel="Enviar el sticker" disabled={!ready} onPress={() => void finish(true)} className="h-16 w-16 items-center justify-center rounded-full bg-primary">
                {phase === 'saving' ? <ActivityIndicator color="white" /> : <Send size={24} color="white" />}
              </Pressable>
            </View>
          </View>

          {typing ? (
            <View className="absolute inset-0 justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
              <TextInput testID="input-texto-sticker" autoFocus value={typing.text} onChangeText={(text) => setTyping({ ...typing, text })} placeholder="Escribe algo" placeholderTextColor="rgba(255,255,255,0.5)" maxLength={40} className="text-center text-[32px] font-bold" style={{ color: 'white' }} onSubmitEditing={saveText} />
              <Pressable testID="btn-listo-texto" onPress={saveText} className="mt-6 h-12 items-center justify-center self-center rounded-full bg-primary px-8">
                <Text className="font-semibold" style={{ color: 'white' }}>Listo</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
