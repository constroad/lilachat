import type { TutorialScript } from '@lilachat/shared';

/**
 * Tutorial 3 of the client channel (`specs/TUTORIALES-CANAL-CLIENTE.spec.md` §2): split a street
 * into stretches (o-03). It adds 0+120 to 0+191 on «Avenida Abancay», edits it and deletes it on
 * camera: Test stays as it was.
 */
const READY = '[data-testid="mapa-lienzo"][data-listo="true"]';
const STREET_ID = '6aee73fa80fb948f67e89b8c';
const WORK_ID = '6aeef89e31485f2908446b9b';
const STAGE_ID = '6af08eb85fea71709b898976';
const NEW = "xpath://li[starts-with(@data-testid,'tramo-')][contains(., '0+120 a 0+191')]";
const FIRST = "xpath:(//li[starts-with(@data-testid,'tramo-')])[1]";

export const script: TutorialScript = {
  slug: 'tramos',
  title: 'Partir la calle en tramos',
  summary: 'Abre una calle, agrega un tramo con sus metros, trabajos y etapa, y corrígelo o bórralo si hace falta.',
  startUrl: '/',
  spaceId: '6adbb02ec9d066b069307eb4',
  viewport: { width: 390, height: 844 },
  intro: { title: 'Partir la calle en tramos', subtitle: 'Mapa de obra · canal del cliente' },
  cameraNames: {
    'QA-CTLPIS — borrar': 'Pavimentación Jirón Lampa',
    'QA-MAPA calle 2 — borrar': 'Jirón Moquegua',
    'QA-MAPA calle — borrar': 'Avenida Abancay',
    'QA-CHECKLIST obra de prueba': 'Cercado de Lima',
    'Asfalto QA': 'Carpeta asfáltica',
    'Etapa QA': 'Etapa 1',
  },
  steps: [
    { say: 'Un tramo es un pedazo de la calle que lleva los mismos trabajos. Entra al canal de tu cliente para empezar.', action: { kind: 'click', selector: 'text:Consorcio Vial del Pacífico' } },
    { say: 'En la pestaña Servicios están las obras de este cliente, cada una con su propio mapa.', action: { kind: 'click', selector: 'text:Servicios' } },
    { say: 'Abre el servicio donde vas a trabajar. Sus calles, etapas y trabajos ya están en el mapa.', action: { kind: 'click', selector: 'text:Pavimentación Jirón Lampa' } },
    { say: 'Toca la pestaña Mapa. Debajo del mapa está la lista de calles de la obra, cada una con su avance.', action: { kind: 'click', selector: 'boton:Mapa' }, waitFor: READY },
    { say: 'Toca Ver tramos en la calle que vas a partir. Aquí usamos la Avenida Abancay, de ciento noventa y un metros.', action: { kind: 'click', selector: `testid:ver-tramos-${STREET_ID}` } },
    { say: 'Arriba ves la calle sola, con sus progresivas cada cien metros. La parte gris clara todavía no tiene tramo.', action: { kind: 'highlight', selector: 'testid:avance-mapa' } },
    { say: 'Cada tramo dice de dónde a dónde va, su área, su etapa y su estado: pendiente, en proceso o terminado.', action: { kind: 'highlight', selector: FIRST } },
    { say: 'Para cubrir lo que falta, toca Agregar tramo. Se abre el formulario con la calle entera como punto de partida.', action: { kind: 'click', selector: 'testid:tramo-agregar' } },
    { say: 'En Desde escribe dónde empieza, en metros desde el cero de la calle. Este tramo empieza en ciento veinte.', action: { kind: 'type', selector: 'testid:tramo-desde', text: '120' } },
    { say: 'En Hasta escribe dónde termina. Buena práctica: los tramos van uno detrás del otro, sin huecos y sin montarse.', action: { kind: 'type', selector: 'testid:tramo-hasta', text: '191' } },
    { say: 'Marca los trabajos que lleva este tramo. Puedes marcar varios, por ejemplo la base, la imprimación y la carpeta.', action: { kind: 'click', selector: `testid:tramo-trabajo-${WORK_ID}` } },
    { say: 'Elige su etapa. Así el tramo se suma al avance de esa etapa y el mapa lo agrupa solo.', action: { kind: 'click', selector: `testid:tramo-etapa-${STAGE_ID}` } },
    { say: 'Toca Guardar tramo. Portal calcula el área con el ancho de la calle y el tramo aparece en la lista.', action: { kind: 'click', selector: 'testid:tramo-guardar' }, waitFor: NEW },
    { say: 'El tramo nuevo empieza pendiente. Cuando registres avance pasa a en proceso, y al completarlo, a terminado.', action: { kind: 'highlight', selector: NEW } },
    { say: 'Con el lápiz cambias sus metros, sus trabajos o su etapa. Úsalo cuando la medición en obra corrige el plano.', action: { kind: 'click', selector: `${NEW}//button[starts-with(@data-testid,'editar-tramo-')]` } },
    { say: 'Si no vas a cambiar nada, toca Cancelar y el tramo queda como estaba, sin tocar sus datos.', action: { kind: 'click', selector: "xpath://*[@data-testid='tramo-formulario']//button[normalize-space()='Cancelar']" } },
    { say: 'Con la papelera lo borras. Antes te pregunta, y un tramo con avance aprobado no se puede borrar.', action: { kind: 'click', selector: `${NEW}//button[starts-with(@data-testid,'borrar-tramo-')]` } },
    { say: 'Confirma con Borrar. Listo: ya sabes partir la calle en tramos. Un admin puede restaurar un tramo borrado por error.', action: { kind: 'click', selector: "xpath://button[starts-with(@data-testid,'borrar-tramo-si-')]" }, waitFor: "xpath:/html[not(.//li[starts-with(@data-testid,'tramo-')][contains(., '0+120 a 0+191')])]", holdMs: 1500 },
  ],
};
