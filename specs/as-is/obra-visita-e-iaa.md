# As-is · Visita técnica, Área adicional (IAA) y medición con AR

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 11/11,
> `specs/INFORMES-DESDE-LILACHAT.spec.md` §14 y §20, `specs/AS-IS-0.1.170.spec.md`
> (14/11), `design/stitch/INVENTARIO.md` y `design/stitch/auditorias/lv0*.md`.

## 1. Qué es

Dos flujos de campo que nacen en Portal y se llenan desde Lilachat:

- **Visita técnica** (lv01–lv03): el ingeniero visita a un prospecto. Marca puntos con
  foto y GPS, responde la entrevista, sube fotos sueltas, termina y saca el PDF. Abre
  el croquis en el editor de Portal.
- **Área adicional (IAA)**: zonas extra medidas en obra, con área (m²) y espesor
  opcional (m³). **Solo el APK mide** (José 15/11: «se mide en el APK para reducir
  margen de error»). La web y la PWA ven y quitan; la web ancha edita en el editor 2.0.

## 2. Qué hace hoy

### 2.1 Visita técnica

**Puerta.** La enciende el admin del espacio: ítem `shortcut:visita_tecnica` de la app
Portal, en Detalle de la app → Comandos (1:1, canales y quién). Sin tocar, apagada
(todo nace apagado desde el 28/10). `visitDoorOf` usa `itemSettingOf` + `availableTo`.

**Entradas.**
- «Visita técnica» en el ⚡ y en el «+» donde el admin la encendió
  (`isSiteVisitShortcut`, shared). Abre «Datos» de una visita nueva con el GPS.
  En el ⚡ de un chat del APK abre la pantalla de la visita (`onStartVisit`).
  En el ⚡ del espacio (sin chat), web y APK abren «Datos» de una visita nueva en
  la misma hoja (`runVisitShortcut`; en el APK desde el 20/11, `app/src/spaces/visits/visitShortcut.ts`).
  Antes el APK corría el atajo de Portal y solo mostraba «La visita técnica se abre
  en su pantalla de Lilachat.». La pantalla completa no se abre sin chat: sus fotos
  con sello pasan por `/api/stamped-forward`, que exige un chat del que la persona es miembro.
- Los botones de la **tarjeta lv01** del canal de informes (`visita_*`).
- La franja «Visitas técnicas» en el chat **está oculta**:
  `SITE_VISIT_SCREENS_READY = false` en `shared/src/siteVisit.ts` (verificado en código).

**Tarjeta lv01.** La arma agentes con bloques genéricos (tema `informes`,
`kind: visita.*`, `refs.visit_id`). Hasta 5 botones (`BOT_LIMITS.visitActions`):
Marcar punto, Entrevista, Foto suelta, Terminar, Abrir croquis. Terminada: solo
«Ver PDF» y «Abrir croquis». El bloque `map` dibuja la ruta con hasta 31 puntos.
Si Portal borra la visita, agentes baja la tarjeta (`visita.deleted`,
`DELETE /api/bots/messages?idempotency_key=`).

**Pantallas.**
- Marcar punto (lv02): la cámara primero; GPS del sello o lectura fresca; 12 tipos en
  chips; medida con unidad; nota; «Guardar punto N» (72 px). Sin GPS no se habilita.
- Entrevista (lv03): una tarjeta por pregunta, chips con check, «n de m» y barra. Cada
  toque guarda solo esa respuesta (`saveVisitAnswers`). Sin preguntas lo dice (`NO_INTERVIEW`).
- Foto suelta: con `lat`, `lng`, `precisionM` y `takenAt` (`visitPhotoFields`).
- Terminar: dice el primer faltante. El PDF abre con `status: 'ready'`.
- Abrir croquis: editor de croquis de Portal (`/embed/site-visit/<id>?vista=croquis`,
  token en el `#`, 12 h, nunca se guarda ni se manda en un mensaje).
- Sin cola sin señal: la visita necesita señal y lo dice.

**Web/PWA** (`web/src/spaces/visits/`): `VisitScreenWeb.tsx`, `VisitCardBlocks.tsx`,
`VisitCardActions.tsx` (contexto `visitActionContext.ts`), `MarkPointWeb.tsx` (con mapa
y «GPS activo»), `VisitInterviewWeb.tsx`, `VisitCroquisWeb.tsx` (sobre
`PortalEmbedFrame`), `visitShortcut.ts`, `useVisit.ts`, `useVisitDoor.tsx`, `visitsApi.ts`.

**APK** (`app/src/spaces/visits/`): `VisitScreen.tsx` (dibujada dentro del chat con
`zIndex` 10, no en un `Modal`, para que la cámara no quede detrás), `VisitCardBlocks.tsx`,
`VisitCardButtons.tsx`, `VisitMap.tsx`, `MarkPointSheet.tsx`, `VisitCroquis.tsx`
(Modal + WebView con el puente de Portal: `nativeEmbedEventOf`, `close-request` con 3 s
de espera), `useVisit.ts`, `useVisitDoor.tsx`, `visitsApi.ts`, `visitCardContext.ts`.

**Server** (`server/src/bots/siteVisitDoor.ts`, rutas en `workspaceRoutes.ts`):
- `GET /api/workspaces/:id/visits/door?chat_id=` → `{ open }` (hoy siempre `false` por
  `SITE_VISIT_SCREENS_READY`).
- `POST /api/workspaces/:id/visits/draft` → `{ document, visits }` (hasta 20 abiertas).
- `POST /api/workspaces/:id/visits/forms` → cada sección, punto, ticket de foto,
  Terminar, PDF o `kind=croquis` es un formulario de la app. Pone un `entradaId` UUID
  por formulario (`guardar_visita` lo exige en cada sección).
- Herramientas de Portal: `guardar_visita`, `marcar_punto_de_visita`,
  `subir_foto_de_visita`, `terminar_visita`, `pdf_de_visita`, `abrir_visita_en_editor`.

**Shared:** `siteVisit.ts` (lee el documento real; 15 tests con `siteVisit.fixture.ts`),
`visitFlow.ts`, `visitScreen.ts`, `visitInterview.ts`, `visitCard.ts`.

**Lo que solo hace Portal** (según as-is 0.1.170): lista con filtros y Excel, RUC y
cliente, «No se concretó», Convertir en cotización, editar puntos, calles y áreas del
mapa, «Para la ejecución». En escritorio la visita se abrirá en el editor 2.0 de Portal
(`/embed/site-visit/[id]`): no verificado que esté construido.

### 2.2 Área adicional (IAA)

**Interruptor:** `AREAS_OPEN_HERE = true` (`shared/src/additionalArea.ts`).

**APK** (`app/src/spaces/clients/areas/`):

| Pantalla | Diseño | Archivo |
| --- | --- | --- |
| Lista de zonas con totales (área, volumen, zonas), «Medir área», «Ver PDF» | la-01 | `AreasScreen.tsx`, `ZoneParts.tsx`, `useAreas.ts` |
| Medir con AR | la-02 | `ArMeasureScreen.tsx`, `ArOverlay.tsx`, `ArPlanCard.tsx` |
| Lados con wincha, diagonales y espesor | la-03 | `ZoneSides.tsx`, `TapeKeypad.tsx` |
| Medir con foto + wincha (sin AR) | la-05 | `PhotoMeasureScreen.tsx`, `PhotoCorners.tsx` |
| Editar o borrar una zona | la-06 | `ZoneEditScreen.tsx` |
| Sin cámara o sin AR | la-07 | `ArUnavailable.tsx` |
| GPS por zona | — | `useZonePlace.ts` |

- **Módulo nativo** `app/modules/ar-measure` (ARCore 1.57, opcional en el manifiesto):
  `ArMeasureView.kt`, `MeasureRenderer.kt`, `TraceOverlay.kt`, `LabelOverlay.kt`,
  `FrameShot.kt`, `ArMeasureModule.kt`. Piso punteado, mira sobre el piso, metros en
  vivo por lado, cierre por imán, foto del AR con los metros quemados.
- **Métodos:** `ar` («AR», sin wincha, desde 0.1.187), `ar-app` («AR + wincha») y foto +
  wincha. La wincha es opcional desde 0.1.186.
- **Reglas** (`shared/src/arArea.ts`): área con la normal de Newell. Más de 3 % entre
  wincha y AR avisa («manda la wincha»); más de 15 % no guarda. Bloquean: menos de 3
  esquinas, lado < 10 cm, lados cruzados, pico < 10°, esquinas fuera del plano, pisos
  distintos, área fuera de 0,05–5 000 m². Entre ×50 y ×150 avisa «¿Escribiste centímetros?».
- **Lados con candado** (16/11, `shared/src/zoneAdjust.ts`): mínimos cuadrados con el
  error real del AR (σ 5 cm por esquina; wincha σ 2 mm + 0,05 %). Avisos `tape-bends`,
  `tape-short`; `tape-contradicts` no guarda.
- **Corregir después de guardar:** la zona manda `geometria` (`shared/src/zoneGeometry.ts`:
  `esquinas`, `lados`, `diagonales`). «Editar zona» recalcula con `zoneCorrectionOf`. La
  foto conserva los metros del AR quemados (propuesta de Lilachat, José aún no confirma).
- Espesor: lecturas en chips, promedio entre 1 y 50 cm. Opcional: la zona es m² por defecto.

**Web/PWA** (`web/src/spaces/clients/areas/AreasWeb.tsx`):
- Banner la-11 «Se mide en el APK». «Abrir en el APK» es un `intent:` de Android que abre
  la app en su inicio; si no está, va a LilaStore (`measureInApkLinks`). En un iPhone dice
  «Mide desde un teléfono Android con el APK de Lilachat» y no ofrece instalar.
- Debajo: total, áreas y fotos, que se ven y se quitan. Se borró `AreaMeasureWeb`.
- Web ancha: IAA nace en el editor 2.0 de Portal (desde 15/11).

**Server:** `server/src/bots/areaForms.ts`, kinds `area_create`, `area_remove`,
`area_edit` → `registrar_area_adicional` (`crear`, `quitar`, `editar`). `ar-app` solo con
`source: 'apk'`. Las fotos van con el ticket que Portal devuelve en `data.upload` (30 min).
La foto del AR se reenvía con sus rótulos (el único caso que quema rótulos).

**Shared:** `additionalArea.ts`, `areaMeasure.ts`, `arArea.ts`, `photoArea.ts`,
`zoneAdjust.ts`, `zoneGeometry.ts`, `formFilesWrite.ts`.

**Dependencias:** Portal (herramientas, PDF «INFORME DE AREA ADICIONAL», método `ar`
desde 6d1a71f6, geometría desde 30792e53). Agentes: `geometria` admite hasta 4 096
caracteres (7916351), la única excepción al tope de 200.

### 2.3 Versiones del APK de esta etapa

| Versión | Fecha | Qué trajo |
| --- | --- | --- |
| 0.1.184 (185) | 15/11 | AR + wincha (la-02, la-03, la-07) |
| 0.1.185–0.1.186 | 15/11 | AR v2 tras la prueba de José; wincha opcional |
| 0.1.187 (188) | 15/11 | AR como la app de referencia (ARPlan 3D); método `ar` |
| 0.1.188 (189) | 15/11 | Esquinas de la foto del AR del mismo cuadro |
| 0.1.189 (190) | 16/11 | Versión actual de `app/app.json` (cambio de push) |

## 3. Diferencias APK vs web

| Tema | Web ancha | PWA angosta | APK |
| --- | --- | --- | --- |
| Medir una zona IAA | No: editor 2.0 de Portal | No: banner la-11 | AR, AR + wincha o foto + wincha |
| Editar zona con geometría | No | No | Sí (la-06) |
| Visita: Marcar punto | Con mapa y «GPS activo» | Igual que la web | Sin mapa ni pastilla «GPS activo» (verificado: `MarkPointSheet.tsx`) |
| Visita: Entrevista | lv03 propia | lv03 propia | Formulario genérico de la sección (`openSection('entrevista')`) |
| Croquis | `iframe` | `iframe` | WebView en Modal |

## 4. Historia reciente

- **11/11** IAA en iPhone con Medición de Apple, guiado (opción B, apagado hasta Portal).
- **12/11** IAA abre en la web con «Quitar área».
- **14/11** Visita técnica: motor puro, puerta del server, lv01–lv03 en web y APK,
  tarjeta lv01 auditada dos veces, croquis en web y APK, `visita.deleted`. Estudio de
  IAA (§20) y diseños la-01…la-10.
- **15/11** La PWA ya no mide (la-11). APK mide con foto + wincha (la-01, la-05) y con AR
  (la-02, la-03, la-07). Cinco APK en el día tras las pruebas de José en su teléfono.
  Editar y borrar zona (la-06). «Ver PDF» del IAA publicado.
- **16/11** Geometría a Portal; lados con candado y diagonales; corregir una zona AR
  guardada con la wincha (E2E en el emulador, OTA 5a18adca).
- **20/11** El ⚡ del espacio en el APK abre «Datos» de la visita nueva, como la web.

## 5. Diseños de Stitch relacionados

El inventario dice «sin implementar» en todas las la-*: está desactualizado (escrito el
14/11). Estado según el código:

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| lv01 tarjeta de la visita | Implementado web y APK | `VisitCardBlocks.tsx` (los dos), auditoría `lv01-visita-chat.md` |
| lv02 marcar punto | Web implementado; APK **parcial** (sin mapa, sin «Mover») | `MarkPointWeb.tsx`, `MarkPointSheet.tsx` |
| lv03 entrevista | Web implementado; APK **parcial** (formulario genérico) | `VisitInterviewWeb.tsx`; no existe `VisitInterview.tsx` en el APK |
| lv04 | No implementado; la franja sigue oculta | `SITE_VISIT_SCREENS_READY = false` |
| la-01 lista IAA | Implementado APK | `AreasScreen.tsx` |
| la-02 medir con AR | Implementado APK | `ArMeasureScreen.tsx` |
| la-03 wincha y espesor | Implementado APK | `ZoneSides.tsx`, `TapeKeypad.tsx` |
| la-04 PWA con lienzo | Reemplazado por la-11 | `AreasWeb.tsx` |
| la-05 foto + wincha | Implementado APK | `PhotoMeasureScreen.tsx` |
| la-06 editar zona | Implementado APK | `ZoneEditScreen.tsx` |
| la-07 sin cámara o sin AR | Implementado APK | `ArUnavailable.tsx` |
| la-08 revisar y enviar | **No implementado** | sin referencia en código |
| la-09 zonas en el mapa de obra | **No implementado** | sin referencia en código |
| la-10 editor de croquis del IAA | **No implementado** en Lilachat | sin referencia en código |
| la-11 «Se mide en el APK» | Implementado web | `AreasWeb.tsx` |

## 6. Pendientes y deuda conocida

- **AR sin verificar en un teléfono** contra una wincha real, la pantalla de diagonales
  y que los rótulos caigan sobre el lado (según spec §14). El emulador ARM no corre
  ARCore (SIGILL en `libarcore_c.so`).
- **Reaprobación:** cambiar la entrada de `registrar_area_adicional` da 502 hasta que
  José reaprueba en Agentes (según spec, 16/11).
- **Portal:** quitar el espesor vacía `volumen` pero deja otro dato (según spec §14);
  si Portal corrige el área de una zona AR, la foto conserva el área vieja.
- **IAA sin hacer** (según spec §20): publicar desde Lilachat (Portal responde
  `unsupported`), `observaciones` por zona, textos, firmas, cola sin red, fotos después
  de que vence el boleto.
- **Visita:** el APK no tiene lv02 al día ni lv03 propia (verificado en código). La
  franja del chat sigue oculta. Un error de un campo que el formulario no muestra no se ve.
- **Visita en escritorio** por el editor 2.0 de Portal: no verificado.
- Aviso global «Tienes un área a medio guardar» si iOS reinicia Lilachat: no hecho
  (según spec §14, opción B ya retirada).

## 7. Pruebas

- **Shared:** `siteVisit.test.ts`, `visitFlow.test.ts`, `visitScreen.test.ts`,
  `visitInterview.test.ts`, `visitCard.test.ts`, `additionalArea.test.ts`,
  `areaMeasure.test.ts`, `arArea.test.ts`, `photoArea.test.ts`, `zoneAdjust.test.ts`
  (simulación de ~20 000 zonas por caso), `zoneGeometry.test.ts`.
- **Server:** `bots/siteVisitDoor.test.ts` (11), `bots/areaForms.test.ts`.
- **Web:** `VisitScreenWeb.test.tsx`, `VisitInterviewWeb.test.tsx`,
  `clients/areas/AreasWeb.test.tsx`.
- **APK:** sin tests de render de visitas ni de áreas (verificado: no hay `*.test.*` en
  `app/src/spaces/visits/` ni en `app/src/spaces/clients/areas/`).
- **Maestro:** no hay flujo de visita ni de IAA (verificado).
- **E2E documentados:** web VIS-2026-0073, APK VIS-2026-0075/0077/0078 (14/11); IAA en
  el emulador solo por foto + wincha y por «Editar zona» (TES-IAA, 16/11).
