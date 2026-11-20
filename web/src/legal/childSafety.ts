import { LEGAL_PAGE_PATHS, type LegalDocument } from '@lilachat/shared';
import { CONTACT_EMAIL } from './privacyPolicy';

/**
 * The child sexual abuse and exploitation (CSAE) standards at
 * `/seguridad-infantil`, which Google Play requires from social apps
 * (spec PLAY-STORE §1). The in-app path to report («Denunciar» → «Abuso
 * infantil») is the one the report-and-block change adds.
 */
/** ConstRoad's contact point for child safety: the same mailbox as privacy (José 19/11/2026). */
const CHILD_SAFETY_CONTACT = CONTACT_EMAIL;

export const CHILD_SAFETY_STANDARDS: LegalDocument = {
  title: 'Normas de seguridad infantil de Lilachat',
  updatedOn: '19 de noviembre de 2026',
  intro: 'Normas de ConstRoad contra el abuso y la explotación sexual infantil (CSAE) en Lilachat. Se aplican a todas las cuentas, espacios, canales y chats.',
  sections: [
    {
      title: '1. Tolerancia cero',
      paragraphs: [
        'En Lilachat está prohibido todo contenido o conducta que abuse, explote o ponga en riesgo sexual a menores de edad. Esto incluye:',
      ],
      bullets: [
        'Material de abuso sexual infantil (CSAM) de cualquier tipo, incluido el creado o alterado con inteligencia artificial.',
        'Contactar a un menor con fines sexuales (grooming), pedirle imágenes o proponerle un encuentro.',
        'Sexualizar a menores en textos, fotos, videos, audios, stickers o enlaces.',
        'La sextorsión y la trata de menores.',
        'Compartir enlaces o indicaciones para conseguir ese material.',
      ],
    },
    {
      title: '2. Cómo denunciar dentro de la app',
      bullets: [
        'Abre el menú del mensaje o del chat y toca «Denunciar».',
        'Elige «Abuso infantil». También puedes bloquear a la persona.',
        'No reenvíes, no descargues ni guardes el material, ni siquiera como prueba: la denuncia ya nos lo deja revisar.',
        'Si un menor está en peligro inmediato, llama a la policía (en el Perú, 105) además de denunciar.',
      ],
    },
    {
      title: '3. Qué hace ConstRoad',
      bullets: [
        'Revisamos cada denuncia de abuso infantil con prioridad.',
        'Retiramos el contenido y cerramos las cuentas involucradas, sin aviso previo.',
        'Guardamos lo necesario y lo entregamos a las autoridades competentes, como exige la ley.',
        'Reportamos el material de abuso sexual infantil a las autoridades del Perú y, cuando corresponde, al NCMEC (National Center for Missing & Exploited Children).',
        'Colaboramos con las investigaciones que nos pidan las autoridades.',
      ],
    },
    {
      title: '4. Punto de contacto',
      paragraphs: [
        `Para temas de seguridad infantil, escríbenos a ${CHILD_SAFETY_CONTACT}. Este contacto responde sobre nuestras prácticas contra el abuso y la explotación sexual infantil, y atiende a las autoridades.`,
      ],
    },
    {
      title: '5. Edad y cumplimiento de la ley',
      paragraphs: [
        'Lilachat es una herramienta de trabajo para mayores de 18 años. Cumplimos las leyes de protección de menores que nos aplican, entre ellas las del Perú, y las políticas de Google Play sobre seguridad infantil.',
      ],
      links: [{ label: 'Política de privacidad', href: LEGAL_PAGE_PATHS.privacy }],
    },
  ],
};
