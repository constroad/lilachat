import { Linking, Share } from 'react-native';
import { enlaceDeWhatsapp, mensajeDeInvitacion } from '@lilachat/shared';

/**
 * Manda la invitación (FL13). Con un contacto, abre WhatsApp en el chat de esa
 * persona con el mensaje escrito; sin contacto, o si WhatsApp no abre, el menú
 * de compartir del sistema. El mensaje y el enlace salen de `shared`.
 *
 * Lo de ANTES —crear la admisión en el server— lo hace quien llama: sin eso
 * la persona instala la app y nunca le llega el código.
 */
export async function compartirInvitacion(contacto: { nombre: string; telefono: string } | null): Promise<void> {
  const mensaje = mensajeDeInvitacion({ para: contacto?.nombre });
  const directo = contacto ? enlaceDeWhatsapp(contacto.telefono, mensaje) : null;
  if (directo) {
    const abrio = await Linking.openURL(directo).then(
      () => true,
      () => false
    );
    if (abrio) return;
  }
  await Share.share({ message: mensaje, title: contacto ? `Invitar a ${contacto.nombre}` : 'Invitar a Lilachat' });
}
