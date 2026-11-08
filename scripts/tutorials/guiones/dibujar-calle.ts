import type { TutorialScript } from '@lilachat/shared';

/**
 * Tutorial 1 of the client channel (`specs/TUTORIALES-CANAL-CLIENTE.spec.md` §2): draw the street
 * of the work. Good practices 1–4 of §3 are said on camera. Recorded on the phone, in Test.
 */
export const script: TutorialScript = {
  slug: 'dibujar-calle',
  title: 'Dibujar la calle de la obra',
  summary: 'Busca el lugar o pega el enlace del cliente, toca la calle, recorta sus extremos, pon el ancho y guarda.',
  startUrl: '/',
  spaceId: '6adbb02ec9d066b069307eb4',
  viewport: { width: 390, height: 844 },
  intro: { title: 'Dibujar la calle de la obra', subtitle: 'Mapa de obra · canal del cliente' },
  cameraNames: {
    'QA-CTLPIS — borrar': 'Pavimentación Jirón Lampa',
    'QA-MAPA calle 2 — borrar': 'Jirón Moquegua',
    'QA-MAPA calle — borrar': 'Avenida Abancay',
    'QA-CHECKLIST obra de prueba': 'Cercado de Lima',
    'Asfalto QA': 'Carpeta asfáltica',
    'Etapa QA': 'Etapa 1',
  },
  steps: [
    { say: 'El mapa de la obra vive en cada servicio del canal del cliente. Entra al canal de tu cliente para empezar.', action: { kind: 'click', selector: 'text:Consorcio Vial del Pacífico' } },
    { say: 'En la pestaña Servicios están las obras de este cliente, cada una con su avance, sus pedidos y sus informes.', action: { kind: 'click', selector: 'text:Servicios' } },
    { say: 'Abre el servicio donde vas a trabajar. El mapa que dibujes queda guardado solo para este servicio.', action: { kind: 'click', selector: 'text:Pavimentación Jirón Lampa' } },
    { say: 'Toca la pestaña Mapa. Aquí ves las calles de la obra sobre el mapa real, con el avance de cada trabajo.', action: { kind: 'click', selector: 'boton:Mapa' } },
    { say: 'Para agregar una calle de la obra, toca Nueva calle. Se abre el editor sobre el mismo mapa.', action: { kind: 'click', selector: 'testid:mapa-nueva-calle' } },
    { say: 'Primero el lugar, después la calle. Escribe la dirección, o pega el enlace de Google Maps que te mandó el cliente.', action: { kind: 'type', selector: 'testid:editor-buscar-lugar', text: 'Jr. Lampa, Lima' } },
    { say: 'Toca Buscar. Puedes escribir Jirón o Jr., Avenida o Av., y el buscador lo entiende igual.', action: { kind: 'click', selector: 'testid:editor-buscar-ir' } },
    { say: 'Elige el resultado correcto y el mapa vuela hasta ese lugar, listo para marcar la calle.', action: { kind: 'click', selector: 'testid:editor-lugar-0' } },
    { say: 'Ahora toca la calle sobre el mapa. Lilachat sigue el eje real de la vía y le pone su nombre.', action: { kind: 'click', selector: '[data-testid="mapa-lienzo"]' } },
    { say: 'La calle se marca entera, con un extremo de inicio y otro de fin. Tu obra casi nunca ocupa la calle completa.', action: { kind: 'highlight', selector: 'testid:editor-extremo-end' } },
    { say: 'Recorta, no inventes: arrastra el extremo de fin hasta donde termina tu obra. El largo se calcula solo.', action: { kind: 'dragToward', selector: 'testid:editor-extremo-end', toward: 'testid:editor-extremo-start', share: 0.3 } },
    { say: 'Para el ajuste fino usa menos diez y más diez metros. El cero más cero cero cero es tu inicio, no el de la vía.', action: { kind: 'click', selector: 'testid:editor-fin-menos' } },
    { say: 'El ancho va siempre. Sin ancho no hay metros cuadrados ni volumen, y no se puede calcular el metrado.', action: { kind: 'type', selector: 'testid:editor-calle-ancho', text: '7.2' } },
    { say: 'Con el largo y el ancho, Lilachat calcula el área neta de la calle. Revisa que coincida con tu plano.', action: { kind: 'highlight', selector: 'testid:editor-calle-area' } },
    { say: 'Toca Guardar calle. La calle queda en el mapa del servicio y la ven todos los miembros del canal.', action: { kind: 'click', selector: 'testid:editor-calle-guardar' } },
    { say: 'Listo, la calle ya está en el mapa de la obra. El siguiente paso es partirla en etapas y en trabajos.', action: { kind: 'highlight', selector: 'testid:mapa-aviso' }, holdMs: 1500 },
  ],
};
