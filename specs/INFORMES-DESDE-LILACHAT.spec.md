# Informes de campo desde Lilachat

> Decisión de José, 05/11/2026: «la idea es que ya no se use public para
> generar informes sino que se haga desde lilachat». Empieza por Control de
> imprimación (`CTL-IMP`), sigue Área adicional (`IAA`) y Control de pista
> (`CTL-PIS`). APK y web PWA con **un solo motor**.
> As-is de Portal leído del código: `Portal/specs/modules/INFORMES-CAMPO-CREACION.as-is.md`.

## 1. Lo decidido (José, 05/11)

1. **Un miembro sin usuario de Portal crea informes.** La puerta es Lilachat:
   miembro del canal del cliente, servicio listado en el canal, acceso
   `services` (`findAskedService`). Portal guarda al autor desde el `user` que
   manda Lilachat (id, nombre, teléfono). Hoy la creación pública no guarda autor.
2. **Borrador libre; «Publicar» exige** datos generales, un tramo con sus tres
   bandejas y una foto. Portal valida al publicar; hoy deja publicar incompleto.
3. **Publicar genera el PDF** y lo manda al canal del cliente.
4. **Herramientas nuevas de Portal**, aprobadas por José en agentes.
5. **«Aprobación de adicional» sigue fuera** de la lista del miembro no admin.

## 2. Arquitectura: Lilachat captura, Portal guarda

| Quién | Qué hace | Qué no hace |
| --- | --- | --- |
| Lilachat (APK y web) | formulario por secciones, borrador local, cola offline, fotos con sello, publicar | calcular, pintar el PDF, guardar el informe |
| Portal | `createServiceReport` (único camino), fórmulas, validación al publicar, PDF, Drive, aviso al canal | ninguna pantalla nueva para el ingeniero |
| Agentes | enruta tres eventos nuevos a tres herramientas de Portal, con el `user` | lógica de informes |
| Canvas de Portal | retoque de diseño del admin en escritorio; lo pinta el PDF | se retira |

La página pública de Portal sigue viva. Se apaga por tipo cuando ese tipo corra
una obra real desde Lilachat. Su cola de servicios, Drive y notas se mueven
después, cuando tengan lugar en el canal.

## 3. Contrato con Portal (cuatro herramientas, las reglas de agentes intactas)

Lo que fija agentes (05/11, leído de `6d93702`): el único camino de escritura es
`form.submitted`, con `form_id` = nombre de la herramienta y `values` = sus
argumentos planos, cada uno visible en 200 caracteres; toda clave declarada en
`properties`; `inputSchema` ≤ 8 KB; 20 llamadas por minuto por persona; quedan
4 lugares de 50 herramientas. Lo que fija Portal: toda escritura exige el
`pending` que agentes firma al confirmar la persona; el autor sale del token;
publicar no cabe en 7 segundos.

Por eso **cada sección es un formulario real** del motor de hoy: la persona lo
ve entero y «Guardar» es su confirmación. Nada de cuerpos anidados.

| Herramienta de Portal | Tipo | Cómo la llama Lilachat | Entrada | Respuesta |
| --- | --- | --- | --- | --- |
| `informe_de_campo` | lectura, `MEMBER_TOOLS` | evento `client.report.draft.requested` (como `client.report.requested`) | `client_id`, `service_id`, `type`, `report_id?` | `{ document }` (§3.1) |
| `guardar_seccion_de_informe` | escritura | `form.submitted` con el formulario de la sección | `informeId`, `seccion`, `tramoId?`, y los campos planos de esa sección | texto + `informeId`; con `tramoId` nuevo si creó el tramo |
| `agregar_foto_de_informe` | escritura | `form.submitted`, una foto por llamada | `informeId`, `tramoId`, `foto`, `lat?`, `lng?`, `at`, `progresiva?`, `descripcion?` | texto + `fotoId` |
| `publicar_informe` | escritura | `form.submitted` | `informeId` | `generating`; el PDF se pide después con `pdf_de_informe` |

Reglas:

- **Una lectura no crea nada** (Portal 05/11: sin `pending` ni autor, y se
  repite). Sin `report_id`, `informe_de_campo` devuelve el documento vacío con
  `id: null`, los valores sugeridos del servicio (cliente, proyecto, ubicación,
  fecha de hoy) y solo `general` habilitada (`enabled: false` en las demás). El
  borrador nace al guardar `general` por `guardar_seccion_de_informe` sin
  `informeId`, con `servicioId` y `tipo`; exige líquido y responsable. La
  respuesta trae el `informeId`; un reintento no crea otro gracias al `pending`.
- `guardar_seccion_de_informe` declara en su `inputSchema` la **unión** de los
  campos de todas las secciones (unos 50, planos, ≤ 8 KB) más `informeId?`,
  `servicioId`, `tipo`, `seccion` y `tramoId?`. Agentes valida los argumentos
  contra ese esquema, no contra `forms{}`. Nombres en `\w` para que cada error
  caiga bajo su campo. Cada sección del documento trae su `form`, subconjunto de
  ese esquema (≤ 20 campos), con los `enum`/`oneOf` ya resueltos: `forms{}` no
  pasa por `formFor`, así que no hay `x-options` ni `x-prefill`.
  `seccion` es una lista cerrada: `general`, `ubicacion`, `material`,
  `bandejas`, `camion`, `temperaturas`, `observaciones`, `firmas`.
- `tipo` va acotado por `enum` a los informes de campo que se abren desde
  Lilachat (`CTL-IMP` primero): al crear no hay informe que revisar y agentes
  solo mira el servicio; sin el `enum`, un miembro podría crear un tipo con plata.
- Los tramos van por `tramoId`, nunca por posición. Guardar `ubicacion` sin
  `tramoId` crea el tramo y Portal devuelve su id.
- **Frontera entre clientes** (Agentes 05/11): el server de Lilachat pasa por
  `findAskedService` antes de emitir y manda `service_id` **fuera** de `values`
  en `form.submitted`, con `command_id` del run. Agentes rechaza las tres
  escrituras y `informe_de_campo` sin ese `service_id`, y exige que
  `values.servicioId` sea el mismo. Portal comprueba que `informeId` pertenezca
  a `servicioId`.
- Las tres escrituras llevan `x-no-action: true` en el `inputSchema` **antes**
  de la aprobación (entra en la huella): agentes las deja fuera del ⚡. Agentes
  no mira `audience` en un formulario; la frontera real es el `service_id`.
- Después de cada guardado Lilachat vuelve a pedir el documento: la respuesta de
  una escritura no trae el documento (agentes solo lee texto, `code`, `campo`).
  Dos llamadas por sección, dentro de las 20 por minuto.
- Agentes suma `report_id` (opcional, primer nivel) a su respuesta de un
  formulario, tomado de `structured.informeId`, en la directa y en `/respond`.
  `validateFormReply` lo guarda como `reportId`. Portal responde `informeId` en
  `guardar_seccion_de_informe` **sin campos de PDF**: con un PDF en
  `generating`, agentes espera el PDF y contesta el enlace en vez de «guardado».
- Un reintento del mismo `form.submitted` no escribe dos veces, pero vuelve sin
  `report_id`. Por eso `informe_de_campo` sin `report_id` devuelve el borrador
  de esa persona (mismo servicio y tipo, `draft`, creado por ese `sub`) si
  existe; Lilachat relee con eso cuando le falte el id.
- Portal aplica sus fórmulas en cada guardado; los resultados vuelven en el
  documento. **Lilachat no calcula nada.** `observaciones` tope 200 caracteres.
- Fotos: Lilachat sube la imagen comprimida, **sin sello**, a su media y la
  manda por URL firmada (15 minutos) con `lat`, `lng` y `at` de la captura.
  **Portal la sella** (fecha, hora, lugar, mapa y dirección como en el
  navegador), la copia al Drive del servicio y la adjunta con `category` =
  tramo y `stampContext.location`. En el siguiente documento la foto vuelve con
  la URL de Portal. Una sola selladora: la de Portal.
- `publicar_informe` deja el informe publicado y responde `generating`; Portal
  valida lo obligatorio antes (§1.2) y, si falta algo, responde el texto con lo
  que falta. Lilachat pide el PDF con `pdf_de_informe` (ya reintenta con
  `generating`). El aviso al canal del PDF va como `service.record` con
  `kind: 'report_pdf'` y clave `service.record:report_pdf:<id>`: Lilachat lo
  muestra como cualquier tarjeta del bot; la clave es de agentes.
- Candado entre clientes: lo pone agentes con `requireListedReport` también en
  las tres escrituras, y `informe_de_campo` solo acepta un servicio listado para
  esa persona. Es requisito antes de activarlas.
- Autor: agentes ya firma `sub`, teléfono y nombre del `user` (nombre cortado a
  80; el teléfono puede venir vacío). Portal guarda eso y tolera el vacío.
- Los borradores salen en `detalle_de_servicio` (corta en 100 informes).

### 3.1 El documento

```json
{
  "id": "<reportId o null>", "type": "CTL-IMP", "title": "Control de imprimación", "status": "draft",
  "forms": { "general": { "type": "object", "properties": {}, "required": [] }, "ubicacion": {}, "bandejas": {}, "firmas": {} },
  "sections": [
    { "id": "general", "title": "Datos generales", "required": true, "enabled": true, "state": "done",
      "summary": ["Av. Los Incas · MC-30"], "results": [], "form": "general",
      "values": { "liquido": "MC-30", "proyecto": "Av. Los Incas" } },
    { "id": "tramos", "title": "Tramos", "required": true, "state": "partial", "summary": ["1 tramo"],
      "repeat": { "itemTitle": "Tramo", "addLabel": "Agregar tramo", "min": 1,
        "template": [
          { "id": "ubicacion", "title": "Ubicación", "required": true, "form": "ubicacion" },
          { "id": "bandejas", "title": "Bandejas", "required": true, "form": "bandejas" }
        ] },
      "items": [
        { "id": "<tramoId>", "title": "Tramo 1", "summary": ["Km 12+000 a 12+350"],
          "results": [{ "label": "Tasa de riego", "value": "1.02 lt/m²", "tone": "ok" }],
          "sections": [
            { "id": "ubicacion", "state": "done", "values": { "tramo": "Km 12+000" } },
            { "id": "bandejas", "state": "empty", "values": {} }
          ] }
      ] },
    { "id": "firmas", "title": "Responsables y firmas", "required": false, "state": "empty", "form": "firmas", "values": {} }
  ],
  "publish": { "label": "Publicar informe", "missing": ["Falta una foto en Tramo 1"] }
}
```

Lo lee `shared/src/fieldDocument.ts` (`fieldDocumentOf`): cada `form` pasa por
`validateFormSpec`; un documento con una sección sin `form` conocido o un
formulario que el motor no dibuja se rechaza entero. Un tramo solo trae `state` y
`values` por sección; título, `required` y `form` salen del `template`.

- `forms` se declara una vez por clave de sección en la raíz del documento
  (`forms: { general, ubicacion, bandejas, … }`); cada sección y cada tramo la
  referencian por clave. Así un documento con muchos tramos queda chico
  (agentes corta `structuredContent` en 256 KB).
- `form` es el mismo esquema que ya dibuja el motor de formularios (hasta 20
  campos por sección, `x-input: photo`, `x-width`, `oneOf`, `x-unit`,
  `x-visible-if`). **Una sección con más de 20 campos se parte en dos.**
- `state`: `empty` · `partial` · `done` · `error`. Lo decide Portal.
- `results` son solo lectura: lo calculado por Portal con su tono
  (`ok` · `warn` · `error` · `neutral`). Se pintan arriba del formulario de la
  sección y en su tarjeta del hub.
- `summary` son una o dos líneas para la tarjeta.
- Firmas: nombre, cargo, empresa y CIP por firmante. No hay firma dibujada.

### 3.2 Secciones de `CTL-IMP` (de `INFORMES-CAMPO-CREACION.as-is.md` §3.1)

| Sección | Campos | Obligatoria al publicar |
| --- | --- | --- |
| Datos generales | líquido (MC-30 · Emulsión), fecha, cliente, proyecto, ubicación, responsable | sí |
| Tramo · Ubicación | tramo, carril, progresiva desde, progresiva hasta, hora inicio, hora final | sí (tramo) |
| Tramo · Material y equipo | ligante, gravilla, peso específico, velocidad, altura de barra, penetración, camión | no |
| Tramo · Bandejas | 3 muestras × (peso sin asfalto, peso con asfalto, área). Resultados: peso de asfalto, rango, volúmenes, galones | sí (las 3) |
| Tramo · Camión imprimador | lectura inicial, lectura final, longitud, ancho. Resultados: consumo, área, tasa corregida | no |
| Tramo · Temperaturas | ambiente, riego asfáltico, factor de corrección (nace en 1) | no |
| Tramo · Observaciones | texto | no |
| Tramo · Fotos | hasta 20 en total, con leyenda opcional | sí (una en el informe) |
| Responsables y firmas | responsable, supervisado por, cliente: nombre, cargo, empresa, CIP | no |

Rangos aceptados en lt/m²: MC-30 0.7 a 1.5 (peso específico 0.93); Emulsión
0.2 a 0.7 (peso específico 1). Los aplica Portal; Lilachat muestra el tono.

## 4. Lilachat

### 4.1 Motor puro (`shared/src/fieldDocument.ts`, con test)

- `fieldDocumentOf(body)`: parsea y valida el documento; cada `form` pasa por
  `validateFormSpec`. Un documento que no se puede dibujar se rechaza con motivo.
- `sectionAt(document, path)`, `progressOf`, `nextSection` (la primera
  obligatoria sin terminar), `publishBlockers`.
- `applySavedSection(document, path, values)`: el borrador local avanza antes de
  que Portal conteste (optimista); la respuesta lo reemplaza.
- `pendingSaves`: cola de guardados por sección con `clientKey`; la misma
  sección reemplaza su pendiente; se drena en orden; 4xx definitivo descarta con
  motivo visible; 401 vacía la cola (regla de `rn-app-loop` §5).

### 4.2 Server (`server/src/bots/clientReports.ts`)

Dos rutas, y el resto es el motor de formularios de siempre:

- `POST /api/workspaces/:id/clients/:clientId/services/:serviceId/reports/draft`
  `{ type, report_id? }` → `client.report.draft.requested` → `{ document }`.
  Sin `report_id` Portal devuelve el borrador propio de ese tipo (o el
  documento vacío con `id: null`). El server guarda el último documento por
  persona y servicio (`ReportDraftModel`, 24 h): los formularios de las
  secciones se arman desde ahí, nunca desde lo que mande el teléfono. Un tipo
  fuera de `OPEN_REPORT_TYPES` da 400; un canal ajeno, 404.
- `POST …/reports/forms` abre UNA pieza del informe como `BotCommandRun` del
  canal del cliente (15 min, `trigger: 'shortcut'`) y responde el
  `CommandOutcome` con `outcome: 'form'`, igual que un atajo:
  - `{ kind: 'section', type, section_id, item_id, key, report_id?, forms,
    lat?, lng?, at? }`: el form es `sectionFormOf(documento, path)` (el de la
    sección con los `values` como `default`, o el `tool` del template para las
    fotos). El run lleva `context` (`servicioId`, `tipo`, `seccion`,
    `informeId?`, `tramoId?`; para la foto `servicioId`, `informeId`,
    `tramoId`, `at`, `lat?`, `lng?`) y `service { clientId, serviceId }`.
    Una foto sin `at` da 400; sin documento guardado o un path que no existe,
    409 `draft_not_open`; un `forms` menor al que pide el form, 409
    `outdated_app`.
  - `{ kind: 'publish', report_id, forms }`: form `publicar_informe` con el
    único campo `nota` (≤200) y `context { servicioId, informeId }`.
- El envío va por `POST /api/chats/:chatId/commands/:commandId/form` (y las
  fotos por `…/files`) como cualquier formulario. `submitForm` mezcla el
  `context` del run sobre los valores y manda `client_id` y `service_id` al
  lado de `values` en `form.submitted`, para que agentes sostenga la frontera
  entre clientes.
- Puerta: `findAskedService` con `need: 'services'`. Escribe quien lee el
  Detalle: miembro del canal con el servicio listado, sin marca de montos
  necesaria. Un canal ajeno da 404 (test).
- Cada escritura deja `audit_logs` en Portal como las lecturas.

### 4.3 Pantallas (APK y web, mismo motor)

| Pantalla | Diseño Stitch | Qué hace |
| --- | --- | --- |
| Informes → «Crear informe» | `j-01-crear-informe` | para todo el que ve los servicios (no solo quien ve montos); selector con los 8 tipos de la página pública (`REPORT_TYPE_OPTIONS`); solo `CTL-IMP` abre aquí, los demás abren el servicio en Portal con la pastilla «En Portal» |
| Hub del informe | `j-02-informe-hub` | toma el lugar del Detalle; kicker con el tipo, título del servicio, pastilla Borrador/Publicado; progreso «N de M secciones listas»; una tarjeta por sección con punto de estado, pastilla (Lista / A medias / Falta / Opcional), resumen y resultados; la primera traba y «Publicar informe» abajo. Volver reabre el Detalle en Informes. Reabrir un borrador = volver a «Crear informe»: Portal devuelve el propio |
| Tramos | `j-03-informe-tramos` | misma pantalla, vista interna: «N tramos», «Agregar tramo» (abre la primera sección de un tramo nuevo), una tarjeta por tramo con kicker, resumen, franja de resultados y una fila por subsección |
| Sección | `AppFormSheet` / `AppFormDialog` de hoy | el formulario de la sección con `values` precargados; al responderse (`answeredSince`) se vuelve a pedir el documento |
| Fotos del tramo | fila «Fotos» del tramo → form del tool `agregar_foto_de_informe` | una foto por llamada; el cliente manda `at` (y `lat`/`lng` si el dispositivo los da) al abrir el form; Portal sella. Leyenda y varias fotos seguidas: F2 |
| Publicar | `j-04-informe-publicar` | hoja/diálogo con lo que falta (botón apagado) o «Todo listo» → form `publicar_informe` (nota); publicado, el pie del hub muestra «Informe publicado», «Ver PDF» (`pdf_de_informe` de siempre) y «Volver al servicio» |

Código: motor `shared/src/reportCreation.ts` (tipos, rutas, requests,
pastillas; con test); app `app/src/spaces/clients/reports/*`; web
`web/src/spaces/clients/reports/*` (con test de la página). El `chatId` del
canal del cliente llega al Detalle porque los runs viven en ese chat.

Reglas de UI: `constroad-premium-ui`; acento del espacio; estados cargando,
vacío y error en cada pantalla; toque mínimo 44 px; sin hex.

### 4.4 Offline

- El documento vive en el teléfono (SQLite) y en la web (Dexie) por
  `reportId`. Se abre sin red con lo último guardado.
- Un guardado sin red queda en `pendingSaves`; la tarjeta dice «Pendiente de
  enviar». Al volver la red se drena y el hub se actualiza con Portal.
- Una foto sin red queda con su archivo local en los `values`; se sube antes de
  drenar el guardado de su sección (`colaDeArchivosMotor` como patrón).
- «Publicar» exige red: Portal valida y genera el PDF.

## 5. Fases

| Fase | Lilachat | Portal | Sale como |
| --- | --- | --- | --- |
| F1 | motor + rutas del server + hub + tramos + secciones con el formulario de hoy | `informe_de_campo`, `guardar_seccion_de_informe`, autor, fórmulas en el guardado | OTA + web |
| F2 | fotos con leyenda y sello, cola offline de guardados y fotos | adjuntar fotos al Drive con `category` y `stampContext` | OTA + web |
| F3 | publicar con faltantes y PDF, E2E en Test y en obra | `publicar_informe`, validación, PDF, aviso con PDF | OTA + web |
| F4 | `IAA`: zonas y m² por foto (medición sobre foto, pantalla propia) | zonas y numeración | OTA + web |
| F5 | `CTL-PIS`: una foto por volquete, pedidos y despachos, aviso WhatsApp | sincronía con pedidos | OTA + web |

Cada fase: test primero, gates, push, OTA, E2E en el emulador y en la web,
spec al día. Las herramientas nuevas las aprueba José en agentes al publicarse.

## 6. Lo que no se hace

- No se porta el canvas ni se pinta el PDF en Lilachat.
- No hay firma dibujada: Portal no la tiene.
- No se calcula en Lilachat; Portal devuelve los resultados.
- No se apaga la página pública en estas fases.

## 7. Abierto

- Agentes: el evento `client.report.draft.requested` con su parser de lista
  blanca; firmar teléfono y nombre; `requireListedReport` en las escrituras;
  ocultar del ⚡ las tres escrituras. Pedido el 05/11.
- Portal: si el sello con mapa y dirección cabe en el server dentro del tiempo.
  Si no, Portal dice qué queda del sello.
- Portal: con 50 de 50 herramientas no queda lugar para otra. La quinta pide
  subir `MAX_TOOLS` en agentes.
- E2E real: una persona no admin con iPhone en Test (pendiente de José).

## 8. Estado

- 05/11/2026: decisión tomada, as-is de Portal recibido, contrato cerrado con
  Portal y Agentes. Motor `shared/src/fieldDocument.ts` con 16 tests. Portal
  escribe las cuatro herramientas; Agentes espera la aprobación de José.
- 05/11/2026 (noche), F1 escrita: server (`clientReports.ts`, 11 tests),
  motor de pantallas (`reportCreation.ts`, 11 tests), pantallas APK y web
  (j-01…j-04; test de la página web, 6). Portal publicó las herramientas en
  `7841b285` (apagadas hasta que José las apruebe en agentes). **Sin
  verificar de punta a punta** en esa fecha (ver el E2E de abajo): el camino
  por agentes, el sello de la foto, publicar de verdad, el PDF y el aviso al
  canal. Guion del E2E (en Test,
  Consorcio Vial del Pacífico, APK y web): crear → general → tramo
  (ubicación, bandejas, foto) → publicar con nota → PDF en el canal →
  releer el publicado. F1 no tiene cola offline (§4.4 es F2) ni `report_id`
  en la respuesta del form: el cliente vuelve a pedir el borrador sin id y
  Portal devuelve el propio. **Cuidado (Portal 05/11):** sin `informeId`
  Portal solo busca `draft`; después de publicar, releer sin id devuelve el
  documento vacío y guardar `general` crearía un segundo informe. Por eso el
  cliente guarda el id apenas lo aprende (`useFieldDocument`) y relee con él;
  el publicado vuelve con `status: completed` (el motor lo lee como
  `published`) y `publish.label: 'Republicar informe'` (sin botón en F1).
  La foto sin GPS pasa: `lat` y `lng` van juntas o ninguna; sin punto el
  sello dice «Ubicacion no disponible».
- 05/11/2026 (noche), **E2E en Test con las cuatro herramientas aprobadas**,
  Consorcio Vial del Pacífico, servicio Pachacútec, web en el Chrome de José y
  APK 0.1.180 con OTA en `lilafotos-qa`. Recorrido en los dos: crear, datos
  generales, tramo (ubicación, bandejas, foto), publicar, PDF y aviso en el
  canal. Web con nota y MC-30 (1,47 lt/m², dentro de rango); APK sin nota,
  con Emulsión y foto de la cámara (1,36 lt/m², «Riego pasado (máx. 0.7)» en
  tono de aviso). Ambos PDF traen datos, cálculo y panel fotográfico. Cada
  formulario responde en 3 a 7 s. La validación del formulario y el «Atrás» de
  Android (de tramos al hub) funcionan.
  Defectos y arreglos:
  1. El hub decía «No se pudo abrir el informe»: Portal manda el `repeat`
     plano junto a `kind`, no anidado. El motor lee las dos formas.
  2. Con el teclado abierto, al cerrarse el formulario Android lo pasaba al
     compositor del chat, oculto bajo el informe: lo que se tecleaba iba ahí.
     `useAppFormState` cierra el teclado al enviar. Sin test unitario (la app
     solo prueba módulos puros). Verificado en el emulador con el OTA
     `19c3f02a`: teclado abierto antes de enviar, cerrado después, y el
     compositor vacío y sin foco.
  3. Las confirmaciones se apilaban sobre las secciones. `staleAnswerIds`
     deja solo la última respuesta. Verificado en el emulador.
  4. La fila y el título del informe decían «4 de noviembre» con `fecha` y PDF
     en 05/11 (fecha sin hora leída en UTC). Portal lo arregló en `86dc0eb9`;
     además, cambiar `fecha` en `general` ahora mueve la fila. Verificado en
     vivo: un informe nuevo nació con el 5 y siguió al 3 al cambiarla.
  Publicado: web y server `a44638c`, OTA `19c3f02a` (runtime `79221c17`).
  Datos QA: tres informes en TEST COMPANY, que limpia Portal; sus avisos en el
  canal del cliente quedan para que José los borre.
  Sin verificar en vivo: el rechazo de un servicio ajeno (solo test del
  server), un miembro sin usuario de Portal (el E2E usó al admin) y la foto con
  GPS real.
