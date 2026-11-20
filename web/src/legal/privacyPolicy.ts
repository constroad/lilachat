import { ACCOUNT_DELETION_PATH, LEGAL_PAGE_PATHS, type LegalDocument } from '@lilachat/shared';

/**
 * The privacy policy at `/privacidad` (Google Play, spec PLAY-STORE §2).
 *
 * Every line comes from the code as of 19/11/2026, not from a template: what is
 * written here is what the APK, the web and the server do. A change in what the
 * app collects or who receives it changes this text in the same commit.
 * The `TODO(José)` markers are facts the code cannot know (legal name, tax id,
 * contact email, address, servers' country, AI providers).
 */
// TODO(José): legal name, RUC (tax id), address and contact email of the controller.
const CONTROLLER = 'ConstRoad';
const CONTACT_EMAIL = 'TODO(José): correo de privacidad';

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Política de privacidad de Lilachat',
  updatedOn: '19 de noviembre de 2026',
  intro: `Lilachat es el chat de trabajo de ${CONTROLLER}: espacios por empresa, chats, llamadas, informes de campo y mapa de obra. Aquí explicamos qué datos usa la app (Android y web), para qué, con quién se comparten y cómo puedes borrarlos.`,
  sections: [
    {
      title: '1. Responsable',
      paragraphs: [
        `${CONTROLLER} es responsable de tus datos en Lilachat. Dirección: TODO(José). Contacto: ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: '2. Qué datos recogemos',
      bullets: [
        'Cuenta: tu número de teléfono o tu correo, con el que entras con un código. Un correo verificado sirve también para tus respaldos.',
        'Perfil: tu nombre, tu cumpleaños (día y mes), tu foto si la subes, tu estado (en línea, ausente, ocupado, invisible) y tu respuesta automática.',
        'Contactos: si das permiso, la app lee tu agenda en el teléfono y envía los números al servidor para saber cuáles ya usan Lilachat. No guardamos tu agenda: los números se comparan y se descartan. Si invitas a alguien, guardamos su número para dejarlo entrar.',
        'Mensajes y contenido: textos, fotos, videos, notas de voz, archivos, encuestas, eventos, checklists, reacciones y lo que publicas en espacios y canales.',
        'Ubicación: solo cuando eliges compartirla en un chat (una vez o en tiempo real, con un plazo que tú eliges), cuando la cámara pone el sello con la dirección y el GPS en una foto o video, y cuando la usas en un informe de campo, una visita técnica o el mapa de obra.',
        'Llamadas: quién llamó a quién, cuándo y cuánto duró. El audio y el video no se graban.',
        'Dispositivos y sesiones: un identificador del dispositivo, el nombre del navegador o equipo vinculado, la última conexión («últ. vez») y los tokens de avisos (push).',
        'Diagnóstico del APK: errores y tiempos de la app (pantalla, versión, mensaje del error), con un identificador de instalación al azar. No incluye tus mensajes.',
      ],
    },
    {
      title: '3. Para qué los usamos',
      bullets: [
        'Darte el servicio: entrar, mostrar tus chats, entregar mensajes y llamadas, y avisarte.',
        'Que te encuentren tus contactos y tus compañeros de espacio.',
        'Las funciones de obra que usas: informes, visitas, mapa, gastos y Drive del servicio.',
        'Seguridad: limitar intentos de ingreso, revisar denuncias y proteger a los usuarios.',
        'Arreglar fallas y que la app vaya fluida.',
        'No vendemos tus datos ni los usamos para publicidad.',
      ],
    },
    {
      title: '4. Con quién se comparten',
      paragraphs: ['Solo con lo necesario para que la función que usas funcione:'],
      bullets: [
        'Las personas de tus chats y espacios ven tus mensajes, tu nombre, tu foto y, según tus ajustes, tu estado y tus confirmaciones de lectura.',
        'Servicio de acceso de ConstRoad (auth.constroad.com): envía tu código de ingreso por WhatsApp o por correo.',
        'Portal y Agentes de ConstRoad: si tu espacio tiene instaladas apps (por ejemplo Lila o Dali), reciben los mensajes, formularios e informes de ese espacio para responder, guardar informes y armar PDF. Lo que escribes a Lila puede procesarse con un proveedor de inteligencia artificial elegido por Agentes (TODO(José): nombrar los proveedores).',
        'Google Firebase Cloud Messaging (APK) y el servicio de avisos de tu navegador (web): llevan los avisos. Si dejas encendida la vista previa, el aviso incluye parte del mensaje; puedes apagarla en Ajustes › Privacidad.',
        'Cloudflare: cuando la conexión directa no es posible, la llamada pasa cifrada por su servidor de retransmisión (TURN). Cloudflare no puede ver ni oír la llamada.',
        'Mapas: OpenFreeMap entrega las teselas del mapa y OpenStreetMap (Nominatim) convierte coordenadas en direcciones y busca lugares. En Android, la dirección del sello la calcula primero el propio teléfono.',
        'GIPHY, si buscas un GIF: recibe lo que buscas.',
        'Vistas previas de enlaces: nuestro servidor abre la página que compartes para mostrar su título e imagen.',
        'Autoridades, cuando la ley lo exige o para proteger a una persona (ver Normas de seguridad infantil).',
      ],
      links: [{ label: 'Normas de seguridad infantil', href: LEGAL_PAGE_PATHS.childSafety }],
    },
    {
      title: '5. Dónde se guardan',
      paragraphs: [
        'En servidores administrados por ConstRoad: la base de datos y el disco de archivos de Lilachat. TODO(José): país donde están los servidores.',
        'En tu teléfono, los mensajes se guardan en una base cifrada. En la web, en el almacenamiento de tu navegador.',
      ],
    },
    {
      title: '6. Cuánto tiempo',
      bullets: [
        'Tus mensajes y archivos quedan mientras tu cuenta exista, salvo que los borres o actives los mensajes temporales (24 horas, 7 días o 90 días).',
        'Copias de seguridad del servidor: 30 días.',
        'Respaldo de tu teléfono: se guardan los 2 últimos, cifrados en tu teléfono antes de subir; nosotros no podemos abrirlos.',
        'Al borrar tu cuenta, ver el punto 7.',
      ],
    },
    {
      title: '7. Borrar tu cuenta y tus datos',
      paragraphs: [
        'Puedes borrar tu cuenta desde la app o desde la página de borrado. La cuenta se cierra al instante y se borra a los 30 días; si vuelves a entrar antes con tu código, el borrado se cancela.',
        'Se borran tu nombre, teléfono, correo, cumpleaños y foto; tus sesiones, dispositivos y avisos; tus chats 1:1, tus bloqueados, tu respuesta automática, tus stickers, destacados, recordatorios y respaldos.',
        'Tus mensajes en grupos, canales y canales de cliente quedan para el resto, firmados como «Cuenta eliminada». Las copias de seguridad del servidor se renuevan en 30 días.',
      ],
      links: [{ label: 'Borrar mi cuenta', href: ACCOUNT_DELETION_PATH }],
    },
    {
      title: '8. Seguridad',
      bullets: [
        'Todo viaja cifrado (HTTPS y WebRTC cifrado).',
        'Los chats secretos van cifrados de punta a punta: el servidor no puede leerlos.',
        'El ingreso es con un código de un solo uso, con límite de intentos.',
        'Puedes bloquear la app con la huella (Android) o con una contraseña (web), y bloquear o denunciar a una persona.',
      ],
    },
    {
      title: '9. Tus permisos',
      bullets: [
        'Cámara: fotos y videos del chat, informes y visitas, videollamadas y el código QR para vincular la computadora.',
        'Micrófono: notas de voz, videos y llamadas.',
        'Ubicación (nunca en segundo plano sin que lo sepas): compartir ubicación, sello de las fotos, informes, visitas y mapa de obra. La ubicación en tiempo real sigue con la app cerrada solo mientras se ve el aviso «Compartiendo tu ubicación en tiempo real».',
        'Pantalla: compartir tu pantalla en una llamada, solo cuando lo eliges.',
        'Contactos: encontrar a tus contactos que usan Lilachat.',
        'Fotos y videos: elegir lo que quieres enviar y guardar lo que recibes.',
        'Avisos: mensajes y llamadas.',
        'Puedes quitar cualquier permiso en los ajustes de tu teléfono; solo deja de funcionar lo que lo usa.',
      ],
    },
    {
      title: '10. Menores de edad',
      paragraphs: [
        'Lilachat es una herramienta de trabajo para mayores de 18 años. No está dirigida a menores ni recogemos a sabiendas datos de menores. Si sabes de una cuenta de un menor, escríbenos y la cerramos.',
      ],
    },
    {
      title: '11. Tus derechos',
      paragraphs: [
        `Puedes pedir acceso, corrección o borrado de tus datos, u oponerte a su uso, escribiendo a ${CONTACT_EMAIL}. En el Perú, estos derechos los reconoce la Ley 29733 de Protección de Datos Personales.`,
      ],
    },
    {
      title: '12. Cambios',
      paragraphs: ['Si cambiamos esta política, publicamos la nueva versión en esta página con su fecha.'],
    },
  ],
};
