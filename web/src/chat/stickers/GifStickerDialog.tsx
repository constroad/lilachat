import { CreateStickerFromVideo } from './CreateStickerFromVideo';
import { useStickers } from './useStickers';

type Props = { jwt: string; me: string; chatId: string; chatName: string; gif: File; onClose: () => void };

/**
 * «Convertir en sticker animado» on a chat's GIF (José 26/11, design sc-01a):
 * the clip editor with that GIF already loaded, so a sound can go with it.
 * Loaded on demand from the conversation.
 */
export default function GifStickerDialog({ jwt, me, chatId, chatName, gif, onClose }: Props) {
  const stickers = useStickers(jwt, me);
  return <CreateStickerFromVideo chatName={chatName} initialClip={gif} onClose={onClose} onSave={stickers.saveVideo} onSend={(sticker) => stickers.send(chatId, sticker)} />;
}
