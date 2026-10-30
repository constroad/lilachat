import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { FileText, Film, Image as ImageIcon, Play } from 'lucide-react-native';
import { mimeOf, type ViewableFile } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/**
 * A Portal file's thumbnail (José 30/10 night asked why it did not show the
 * thumbnail): the photo or its preview, a video's frame with a play mark,
 * a PDF and any other file as a tile. Decoded at its own small size.
 */
export function FileThumb(props: { file: ViewableFile; size?: number }) {
  const colors = useColores();
  const size = props.size ?? 44;
  const mime = mimeOf(props.file);
  const preview = mime.startsWith('image/') ? (props.file.thumbUrl ?? props.file.url) : props.file.thumbUrl;
  const box = { width: size, height: size, borderRadius: 8 };
  if (preview) {
    return (
      <View style={box} className="overflow-hidden bg-background">
        <Image recyclingKey={preview} source={{ uri: preview }} style={{ width: size, height: size }} contentFit="cover" />
        {mime.startsWith('video/') ? <View className="absolute inset-0 items-center justify-center bg-black/25"><Play size={16} color="white" fill="white" /></View> : null}
      </View>
    );
  }
  const isPdf = mime === 'application/pdf';
  const Icon = isPdf ? FileText : mime.startsWith('video/') ? Film : mime.startsWith('image/') ? ImageIcon : FileText;
  return (
    <View style={box} className={`items-center justify-center ${isPdf ? 'bg-error/10' : 'bg-primary/10'}`}>
      <Icon size={18} color={isPdf ? colors.error : colors.primary} />
      {isPdf ? <Text className="text-[9px] font-bold text-error">PDF</Text> : null}
    </View>
  );
}
