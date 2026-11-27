import { CreateVideoSticker } from './CreateVideoSticker';
import { closeGifStickerEditor, useGifStickerAsk, type GifStickerAsk } from './chatGifEditor';
import { useStickers } from './useStickers';

/** Mounted once at the root: the sticker editor that a chat's GIF asks for (José 26/11), over any screen. */
export function GifStickerEditorHost() {
  const ask = useGifStickerAsk();
  if (!ask) return null;
  return <ChatGifStickerEditor key={ask.gif.uri} ask={ask} />;
}

/** The same editor as «Crear» with a GIF: «Guardar» keeps it, «Enviar» also sends it to that chat. */
function ChatGifStickerEditor(props: { ask: GifStickerAsk }) {
  const { jwt, chatId, gif } = props.ask;
  const stickers = useStickers(jwt);
  return <CreateVideoSticker visible video={gif} onClose={closeGifStickerEditor} onSave={stickers.saveFromVideo} voiceDoor={stickers.voiceDoor} onSend={(sticker) => stickers.send(chatId, sticker)} />;
}
