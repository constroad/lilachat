import { Modal, Pressable, Text, View } from 'react-native';
import { BarChart3, CalendarDays, Camera, Image as ImageIcon, Paperclip } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';

/**
 * El «+» de la conversación (diseño Stitch «Multimedia y Emojis»).
 *
 * Cámara y galería son cosas DISTINTAS y se ofrecen por separado: en Portal se
 * pagó el aprendizaje de que un selector que abre la galería cuando el usuario
 * quería la cámara se lee como que la cámara no funciona.
 *
 * **Evento y encuesta se crean DESDE ACÁ**, como en WhatsApp (pedido de José).
 * Es donde uno está cuando surge el plan —«¿nos vemos el domingo?»— y obligar a
 * salir a otra pestaña para armarlo rompe justo ese momento. Al abrirse desde
 * un chat, ese chat ya viene elegido: no se vuelve a preguntar dónde.
 */
export function AttachSheet({
  visible,
  onClose,
  onPickCamera,
  onPickGallery,
  onPickFile,
  onCreateEvent,
  onCreatePoll,
}: {
  visible: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
  onPickFile: () => void;
  onCreateEvent: () => void;
  onCreatePoll: () => void;
}) {
  const margenes = useMargenes();
  const options = [
    { key: 'camara', label: 'Cámara', icon: Camera, action: onPickCamera, testID: 'attach-camara' },
    { key: 'galeria', label: 'Galería', icon: ImageIcon, action: onPickGallery, testID: 'attach-galeria' },
    { key: 'archivo', label: 'Archivo', icon: Paperclip, action: onPickFile, testID: 'attach-archivo' },
    { key: 'evento', label: 'Evento', icon: CalendarDays, action: onCreateEvent, testID: 'attach-evento' },
    { key: 'encuesta', label: 'Encuesta', icon: BarChart3, action: onCreatePoll, testID: 'attach-encuesta' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} accessibilityLabel="Cerrar" />
      <View className="rounded-t-xl bg-surface px-5 pt-3" style={{ paddingBottom: margenes.pie }} testID="attach-sheet">
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
