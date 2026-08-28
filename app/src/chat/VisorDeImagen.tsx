import { Modal, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useMargenes } from '../ui/useMargenes';

/**
 * La foto a pantalla completa.
 *
 * José, 27/08/2026: «cuando toco la imagen no sale el modal ese para ver la
 * imagen en vista grande». No existía: la miniatura de 220 px era todo lo que
 * había, y en una app donde se mandan fotos de obra —una libreta con
 * coordenadas escritas a mano, como la que mandó— 220 px no alcanza para leer
 * nada.
 *
 * Sobre negro y no sobre el fondo del tema, en los dos modos: es lo que hace
 * cualquier visor, y el negro es lo que deja que la foto sea lo único que se ve.
 */
export function VisorDeImagen({ url, onCerrar }: { url: string | null; onCerrar: () => void }) {
  const margenes = useMargenes();

  return (
    <Modal
      visible={Boolean(url)}
      animationType="fade"
      transparent={false}
      // El botón ATRÁS de Android cierra el visor: sin esto cerraría la app,
      // que es el mismo defecto que se acaba de arreglar en el resto.
      onRequestClose={onCerrar}
      testID="visor-imagen"
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/**
         * El cierre NUNCA se comprime y tiene 44 px de área táctil.
         *
         * Un visor a pantalla completa sin salida visible deja como única opción
         * el botón físico de atrás, y quien no lo piense cree que la app se
         * colgó.
         */}
        <Pressable
          testID="btn-cerrar-visor"
          accessibilityLabel="Cerrar la imagen"
          onPress={onCerrar}
          style={{
            position: 'absolute',
            zIndex: 10,
            top: margenes.cabecera,
            left: 12,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Blanco fijo, no del tema: el visor es negro en los dos modos. */}
          <X size={26} color="#ffffff" />
        </Pressable>

        {url ? (
          <Image
            source={{ uri: url }}
            style={{ flex: 1 }}
            // `contain` y no `cover`: recortar una foto de obra puede dejar
            // afuera justo el dato que se fue a mirar.
            contentFit="contain"
            transition={120}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#ffffff' }}>No se pudo cargar la imagen</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
