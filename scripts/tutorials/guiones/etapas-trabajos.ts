import type { TutorialScript } from '@lilachat/shared';

/**
 * Tutorial 2 of the client channel (`specs/TUTORIALES-CANAL-CLIENTE.spec.md` §2): stages and works
 * (o-04, o-05) and the layers on the map. It creates «Etapa 2» and «Bacheo», paints them on a
 * street with the brush and deletes both at the end, on camera: Test stays as it was.
 */
const READY = '[data-testid="mapa-lienzo"][data-listo="true"]';
const STAGE = 'Etapa 2';
const WORK = 'Bacheo';
/** «Avenida Abancay» on camera: its middle, below the brush band. */
const STREET = { lat: -12.0468412, lng: -77.04179227 };
/** The brush band once Portal answered the tap. */
const SAVED = "xpath://*[@data-testid='mapa-brocha'][not(contains(., 'Guardando'))]";
const stageCard = (name: string) => `xpath://li[starts-with(@data-testid,'etapa-')][.//p[normalize-space()='${name}']]`;
const workRow = (name: string) => `xpath://li[starts-with(@data-testid,'trabajo-fila-')][.//p[normalize-space()='${name}']]`;

export const script: TutorialScript = {
  slug: 'etapas-trabajos',
  title: 'Etapas, trabajos y capas del mapa',
  summary: 'Crea las etapas y los trabajos de la obra, píntalos sobre las calles con la brocha y filtra el mapa por capa.',
  startUrl: '/',
  spaceId: '6adbb02ec9d066b069307eb4',
  viewport: { width: 390, height: 844 },
  intro: { title: 'Etapas, trabajos y capas', subtitle: 'Mapa de obra · canal del cliente' },
  cameraNames: {
    'QA-CTLPIS — borrar': 'Pavimentación Jirón Lampa',
    'QA-MAPA calle 2 — borrar': 'Jirón Moquegua',
    'QA-MAPA calle — borrar': 'Avenida Abancay',
    'QA-CHECKLIST obra de prueba': 'Cercado de Lima',
    'Asfalto QA': 'Carpeta asfáltica',
    'Etapa QA': 'Etapa 1',
  },
  steps: [
    { say: 'Las etapas y los trabajos ordenan la obra sobre el mapa. Entra al canal de tu cliente para empezar.', action: { kind: 'click', selector: 'text:Consorcio Vial del Pacífico' } },
    { say: 'En la pestaña Servicios están las obras de este cliente, cada una con su propio mapa.', action: { kind: 'click', selector: 'text:Servicios' } },
    { say: 'Abre el servicio. Sus calles ya están dibujadas, como viste en el video anterior.', action: { kind: 'click', selector: 'text:Pavimentación Jirón Lampa' } },
    { say: 'Toca la pestaña Mapa. Ahora vas a decir en qué etapa va cada calle y qué trabajos lleva.', action: { kind: 'click', selector: 'boton:Mapa' }, waitFor: READY },
    { say: 'Toca Etapas. Una etapa es un frente o una fase de la obra, por ejemplo las primeras cuadras o el frente norte.', action: { kind: 'click', selector: 'testid:mapa-etapas-abrir' } },
    { say: 'Para crear otra etapa, toca Nueva etapa. Usa nombres cortos que tu equipo y el cliente reconozcan.', action: { kind: 'click', selector: 'testid:etapa-nueva' } },
    { say: 'Escribe el nombre de la etapa. Aquí la llamamos Etapa 2, el frente que sigue después del primero.', action: { kind: 'type', selector: 'testid:etapa-nombre', text: STAGE } },
    { say: 'Toca Crear. La etapa aparece sin calles todavía. Ahora hay que decirle qué calles le tocan.', action: { kind: 'click', selector: 'testid:etapa-crear' }, waitFor: stageCard(STAGE) },
    { say: 'Toca Tocar calles. Se enciende la brocha: cada calle que toques en el mapa pasa a esta etapa.', action: { kind: 'click', selector: `${stageCard(STAGE)}//button[starts-with(@data-testid,'etapa-brocha-')]` } },
    { say: 'Toca la Avenida Abancay en el mapa. Se pinta más gruesa: esa calle ya es parte de la etapa dos.', action: { kind: 'tapMap', ...STREET }, waitFor: SAVED },
    { say: 'Si tocaste una calle por error, Deshacer la devuelve como estaba. Tocarla otra vez también la quita de la etapa.', action: { kind: 'highlight', selector: 'testid:brocha-deshacer' } },
    { say: 'Toca Listo para apagar la brocha. Buena práctica: cada calle va en una sola etapa, y ninguna calle queda suelta.', action: { kind: 'click', selector: 'testid:brocha-listo' } },
    { say: 'La tarjeta de la etapa ya suma su calle: los metros, los metros cuadrados y, cuando haya avance, el porcentaje y las jornadas.', action: { kind: 'highlight', selector: stageCard(STAGE) } },
    { say: 'Ahora los trabajos. Un trabajo es una capa de la obra: la base, la imprimación, la carpeta asfáltica o el bacheo.', action: { kind: 'click', selector: 'testid:mapa-trabajos-abrir' } },
    { say: 'Cada fila dice en cuántas calles y en cuántos metros va ese trabajo. Su color es el mismo que ves en el mapa.', action: { kind: 'highlight', selector: workRow('Carpeta asfáltica') } },
    { say: 'Toca Agregar trabajo para crear una capa nueva. Escribe su nombre tal como lo dice el expediente.', action: { kind: 'click', selector: 'testid:trabajo-nueva' } },
    { say: 'Aquí escribimos Bacheo. Un trabajo nuevo vale para todas las calles del servicio, no solo para una.', action: { kind: 'type', selector: 'testid:trabajo-nombre', text: WORK } },
    { say: 'Elige un color que se distinga de los demás. Así en el mapa se lee qué trabajo va en cada calle.', action: { kind: 'click', selector: "xpath:(//button[starts-with(@data-testid,'trabajo-color-')])[3]" } },
    { say: 'Toca Crear. El trabajo aparece en la lista con cero calles, listo para pintarlo sobre el mapa.', action: { kind: 'click', selector: 'testid:trabajo-crear' }, waitFor: workRow(WORK) },
    { say: 'Toca Pintar en el bacheo. Es la misma brocha de las etapas: toca las calles que llevan este trabajo.', action: { kind: 'click', selector: `${workRow(WORK)}//button[starts-with(@data-testid,'trabajo-brocha-')]` } },
    { say: 'Toca la Avenida Abancay. Una calle puede llevar varios trabajos, uno encima del otro, como capas.', action: { kind: 'tapMap', ...STREET }, waitFor: SAVED },
    { say: 'Toca Listo. Buena práctica: crea las capas en el orden en que se ejecutan, primero la base, después la imprimación y al final el asfalto.', action: { kind: 'click', selector: 'testid:brocha-listo' } },
    { say: 'Arriba del mapa puedes filtrar por trabajo. Así ves una sola capa y su avance, sin las demás encima.', action: { kind: 'click', selector: 'testid:mapa-trabajo-6aeef89e31485f2908446b9b' } },
    { say: 'Toca Todos para volver a ver la obra completa, con todas sus capas y todas sus etapas.', action: { kind: 'click', selector: 'testid:mapa-trabajo-todos' } },
    { say: 'Si te equivocas, cada trabajo tiene un lápiz para cambiarle el nombre y una papelera para borrarlo.', action: { kind: 'click', selector: `${workRow(WORK)}//button[starts-with(@data-testid,'borrar-trabajo-')]` } },
    { say: 'Al borrarlo, sus calles quedan sin él. Un trabajo con avance registrado no se borra, y un admin lo puede restaurar.', action: { kind: 'click', selector: "xpath://button[starts-with(@data-testid,'borrar-si-trabajo-')]" }, waitFor: 'xpath:/html[not(.//p[normalize-space()=\'Bacheo\'])]' },
    { say: 'Lo mismo con las etapas. Abre Etapas y toca la papelera de la etapa que ya no necesitas.', action: { kind: 'click', selector: 'testid:mapa-etapas-abrir' } },
    { say: 'Primero te pregunta qué pasa con sus calles. La calle vuelve a quedar sin etapa y tú decides dónde va.', action: { kind: 'click', selector: `${stageCard(STAGE)}//button[starts-with(@data-testid,'borrar-etapa-')]` } },
    { say: 'Confirma con Borrar. Listo: ya sabes crear etapas y trabajos, pintarlos sobre las calles y ver el mapa por capas.', action: { kind: 'click', selector: "xpath://button[starts-with(@data-testid,'borrar-si-etapa-')]" }, waitFor: 'xpath:/html[not(.//p[normalize-space()=\'Etapa 2\'])]', holdMs: 1500 },
  ],
};
