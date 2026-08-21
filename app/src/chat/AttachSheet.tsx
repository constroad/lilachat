import { Modal, Pressable, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, Paperclip } from 'lucide-react-native';

/**
 * De dónde sale el archivo (diseño Stitch «Multimedia y Emojis»).
 *
 * Cámara y galería son cosas DISTINTAS y se ofrecen por separado: en Portal se
 * pagó el aprendizaje de que un selector que abre la galería cuando el usuario
 * quería la cámara se lee como que la cámara no funciona.
 */
export function AttachSheet({
  visible,
  onClose,
  onPickCamera,
  onPickGallery,
  onPickFile,
}: {
  visible: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickFile: () => void;
}) {
  const options = [
    { key: 'camara', label: 'Cámara', icon: Camera, action: onPickCamera, testID: 'attach-camara' },
    { key: 'galeria', label: 'Galería', icon: ImageIcon, action: onPickGallery, testID: 'attach-galeria' },
    { key: 'archivo', label: 'Archivo', icon: Paperclip, action: onPickFile, testID: 'attach-archivo' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel="Cerrar" />
      <View className="rounded-t-xl bg-surface px-5 pb-10 pt-3" testID="attach-sheet">
        <View className="mb-4 h-1.5 w-11 self-center rounded-full bg-outline/30" />
        {options.map(({ key, label, icon: Icon, action, testID }) => (
          <Pressable
            key={key}
            testID={testID}
            onPress={() => {
              onClose();
              action();
            }}
            className="min-h-[56px] flex-row items-center gap-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Icon size={20} color="#6b38d4" />
            </View>
            <Text className="text-base font-semibold text-on-surface">{label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
