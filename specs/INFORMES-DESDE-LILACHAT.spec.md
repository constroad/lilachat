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

### 3.3 `CTL-PIS` · lo que pidió José (06/11/2026), antes del diseño

Pendiente del análisis de Portal (pedido el 06/11, once puntos con archivo y
línea) y de las restricciones de agentes. Nada de esto está diseñado todavía.

1. **Estado nuevo por despacho**: si la unidad terminó su trabajo en pista o
   no. Hoy el despacho pasa por `progreso`, `despachado` y la llegada
   (`arrival`); no existe «terminó en pista».
2. **Tres fotos obligatorias por unidad**: ingreso de la unidad, la temperatura
   y la unidad vacía. Hoy la galería por unidad (`unitPhotos_<dispatchId>`) no
   distingue tipos de foto.
3. **Ubicación del dispositivo en cada foto**, guardada por unidad: para saber
   qué unidad trabajó en qué parte de la obra, estimar avance y promediar.
   Lilachat ya manda `lat`, `lng` y `at`; falta que quede consultable por
   unidad y decidir si es obligatoria.
4. **Control de escantillón por unidad**: «el espesor del planchero», en
   palabras de José. Decidido el 06/11: **espesor en centímetros** más la
   **foto de la wincha** que lo muestra. En asfalto se habla en pulgadas, pero
   el dato se guarda en cm.
5. **Rediseño con Stitch** si hace falta, y **coordinación con agentes** desde
   el inicio.

Decisiones de José del 06/11:

- **Sin GPS no hay foto** en CTL-PIS: la app bloquea la captura hasta tener la
  posición del dispositivo. Vale para las cuatro fotos de la unidad: ingreso,
  temperatura, unidad vacía y wincha del escantillón.

Análisis de Portal: `Portal/specs/modules/CONTROL-PISTA-LILACHAT.analisis.md`
(06/11, 751 líneas, con archivo y línea). Hallazgos que cambian el diseño: el
resumen cuenta un vacío como 0; la sincronía con despachos vive solo en el
navegador; `control.fecha` nace vacía y sin ella la llegada no sube al
despacho; el operador no puede corregir su llegada; cada guardado relee todas
las filas (200 son 5 s). Portal recomienda la opción a sin escribir al leer:
un despacho `despachado` sin fila sale como unidad vacía con `id` =
`dispatchId`, y la fila nace al guardar la unidad.

Decisiones de José (06/11, sobre el §12 del análisis de Portal): hora de
inicio de colocación opcional en la unidad y la final desde la foto de vacía;
el checklist de 5 bloquea publicar, con botón «marcar los 5»; un miembro sin
usuario de Portal no mueve pedidos entre servicios; **el WhatsApp al grupo del
cliente sigue saliendo por cada foto, sin cambios**; el operador corrige su
llegada; «terminó» es solo la hora, sin resultado de devuelta o rechazada por
ahora; la página pública exige lo mismo (4 fotos, GPS, escantillón); el PDF
lleva todas las fotos, una fila por unidad con sus 4; el cliente ve que la
unidad terminó. OK explícito a: corregir los resúmenes guardados, leer conteos
de producción, y los dos índices nuevos (único por pedido en CTL-PIS, y
`{ companyId, 'metadata.dispatchId' }` en `media`). El tope de agentes por
empresa sube a 120.

#### El documento de CTL-PIS (contrato, 06/11)

Opción a de Portal: una lectura no escribe. Las unidades son los despachos
`despachado` del pedido; la fila nace al guardar la unidad.

| Sección | Tipo | Formulario y campos | Obligatoria |
| --- | --- | --- | --- |
| `general` | form | `pedido` (`oneOf`, solo pedidos del servicio o sin servicio, con ventana de fechas), `responsable`, `fecha` | sí; crea el informe |
| `control` | form | `tramo`, `frente`, `turno`, `clima`, `supervisor` | `tramo` |
| `unidades` | repeat, sin «Agregar» | ítem por despacho, `id` = `dispatchId`, `title` «Unidad N · placa»; `summary` con guía, salida, m³ y temperatura de salida; `results` del informe: carros, m³, promedios, escantillón promedio, terminadas N de M | al menos una unidad guardada |
| `unidades › datos` | form `unidad` | `horaLlegada`, `tempLlegada`, `tempRodilloLiso`, `tempRodilloNeumatico`, `horaInicio`, `horaFinal`, `escantillonCm`, `observaciones` | llegada, temperatura de llegada y escantillón |
| `unidades › foto-ingreso`, `foto-temperatura`, `foto-vacia`, `foto-escantillon` | tool `agregar_foto_de_informe` con `photoKind` y `requireLocation: true` | una foto de ese tipo, con `lat` y `lng` | sí, las cuatro |
| `checklist` | form, `x-check-all` | los 5 del esquema | sí |
| `observaciones` | form | texto | no |
| `firmas` | form | elaborado por y aprobado por: nombre, cargo, CIP | no |

- Novedades del documento que el motor debe leer: `page: { current, total }`
  (ventana de 50 unidades, `publish` y `results` sobre todas); en un `repeat`,
  `addLabel` vacío o `canAdd: false` oculta el botón; en el `template`,
  `photoKind` fija el `tipoFoto` que manda la app y `requireLocation` bloquea
  la captura sin posición; `publish.warnings` se muestran sin bloquear
  (despachos del pedido sin fila).
- Portal marca `dispatch.fieldWork` al recibir la foto `vacia`; la unidad
  muestra «Terminó HH:MM» en su resumen. La hora de llegada la sugiere Portal
  (chofer u hora actual) y la confirma la persona al guardar `datos`.
- Un ítem cuyo despacho ya no existe llega con `state: 'error'` y un resumen
  que lo dice.
- Despliegue: agentes primero; Portal en un solo deploy con todo opcional, a la
  hora que José fije, y él reaprueba tres herramientas; Lilachat publica
  CTL-PIS en el selector recién cuando Portal esté en producción.

Contrato con agentes y Portal (06/11):

- **Sin herramienta nueva**: Portal está en 50 de 50 en agentes. Despachos y
  pedidos viajan dentro del documento de `informe_de_campo`.
- **Páginas**: `page` entero desde 1 en `client.report.draft.requested`,
  agentes lo pasa como `pagina`. Ventana de 50 unidades por `unitNumber`; el
  resto del documento completo, con `page: { current, total }`. `publish` y el
  resumen se calculan sobre todas las unidades, no sobre la ventana.
- **Fotos**: `tipoFoto` (`ingreso`, `temperatura`, `vacia`, `escantillon`),
  `clientKey` y `precisionM`, opcionales en `agregar_foto_de_informe`. En
  CTL-PIS Portal rechaza la foto sin `tipoFoto`, `lat` o `lng`, y deduplica
  por `informeId` + `tramoId` + `tipoFoto` + `clientKey`. `tramoId` lleva el
  `dispatchId`.
- **Escantillón**: `escantillonCm` en el formulario `unidad` y columna de
  `controlPista`; publicar lo exige con su foto.
- **Estado por unidad**: Portal guarda `dispatch.fieldWork`; en los avisos va
  un solo campo, `fieldWorkFinishedAt` (ISO o `null`), también en
  `order.dispatched` y `order.delivered`. Agentes agrega el `kind`
  `order.field_work_finished`, clave `order.field_work_finished:<dispatchId>`,
  que no crea tarjeta: redibuja la del pedido con «Terminó HH:MM» en la fila
  de la unidad y una barra de unidades terminadas. Ese `kind` no deduplica;
  la clave es `order.field_work_finished:<dispatchId>:<occurredAt>`. Portal
  manda `data.dispatch.occurredAt` (hora del último cambio del despacho) en
  `order.dispatched`, `order.delivered` y este `kind`; el hilo descarta el
  aviso más viejo que lo guardado. Deshacer: mismo `kind` con `null`.
  Agentes despliega primero.
- **Reaprobación**: cambiar el `inputSchema` deja la herramienta sin aprobar
  hasta que José reaprueba, y CTL-IMP se corta mientras tanto. Portal sale en
  un solo deploy con todo opcional, a una hora acordada con José, y él
  reaprueba `informe_de_campo`, `guardar_seccion_de_informe` y
  `agregar_foto_de_informe`. `guardar_seccion_de_informe` queda cerca de
  4 780 de 8 192 bytes reutilizando `horaInicio`, `horaFinal`,
  `responsable*` y `supervisadoPor*`.
- **Tope por minuto**: 20 por persona; 60 por empresa, que José sube a 120.
  Al superarlo agentes responde HTTP 200 con `errors._` y sumará
  `code: 'rate_limited'` y `retry_after_s`. La cola de Lilachat vacía a una
  llamada cada 4 s, respeta `retry_after_s`, y lo que la persona guarda pasa
  antes que el atraso de fotos. La escritura por unidad con sus 4 fotos queda
  como mejora posterior, si la obra la pide.

Lo que ya se sabe del código (leído de `origin/main` el 06/11):

- Portal arma el documento de Lilachat solo para CTL-IMP
  (`portalFieldReportTools.ts`, `imprimacionDocumentOf`); las reglas de
  publicar (`fieldReportPublishRules.ts`) solo cubren CTL-IMP.
- El esquema de lila (`control-pista.schema.ts`): obra, contratista,
  subcontratista, ubicación; fecha, tramo, frente, turno, clima, supervisor;
  tabla de hasta 200 unidades con 13 columnas; `resumenControl` calculado;
  `controlPistaColumns`; checklist de 5; fotos hasta 100; observaciones; dos
  firmas con CIP.
- La página pública liga filas a despachos en estado `despachado`
  (`DispatchPickSheet`), sincroniza placa, guía, hora de salida, volumen y
  temperatura de salida desde el despacho, y la persona completa llegada,
  temperatura de llegada, rodillos, observaciones y fotos. La unidad cuenta
  completa con hora y temperatura de llegada (`CtlPisUnitsSection.tsx`).
- La llegada del operador se copia al despacho sin pisar la del chofer
  (`controlPistaArrivals.ts`, UTC-5 fijo, gana la primera hora).
- El WhatsApp sale por cada foto, con el texto «Nueva foto de control de
  pista» (`whatsAppAlerts.ts`).

#### Hecho en Lilachat (06/11; Portal en producción desde las 13:57 UTC, commit 68ce06a7)

Diseños: `design/stitch/j-05-pista-unidades*.png` y `j-06-pista-unidad*.png`
(v2). La v1 era de oficinista y José la descartó el 06/11: «es para un personal
en campo, intuitivo y muy fácil, la menor cantidad de pasos». La v2 tiene placa
enorme, un botón «Llegó» por volquete, cuatro recuadros de cámara de 72 px,
hora y GPS solos, un solo «Guardar». José también pidió la pantalla donde se
elige qué volquete llegó, porque el orden de salida de planta no es el de
entrada a la pista: es el grupo «Salieron de planta · toca la que llega» sobre
«En obra · por orden de llegada», en la misma pantalla de Unidades.

Motor (`shared`, tests primero, 2 173 verdes):

- `fieldDocument`: `RepeatSection.canAdd` (falso con `canAdd: false` o
  `addLabel` vacío; sin «Agregar» y sin deber el primer ítem), `page`
  (`{ current, total }`, se descarta fuera de rango), `SectionTemplate` y
  `FormSection` con `photoKind` y `requireLocation`, `publish.warnings`,
  `photoKindOf`, `requiresLocation`, `publishFooterLine` («Falta: … · 2
  volquetes por llegar»). `sectionFormOf` pasa `checkAll` cuando el esquema
  trae `x-check-all`.
- `reportUnits` (nuevo): `isUnitsRepeat`, `unitStateOf` (por llegar / en
  pista / terminó, terminó = foto `vacia` hecha aunque Portal no haya
  respondido), `unitGroupsOf` (por llegar; en obra con las que trabajan
  primero), `unitTitleOf` («Unidad 3 · QAP-102» = kicker y placa; la placa
  sola es un despacho sin fila), `unitBadgeOf` («Terminó HH:MM» del
  `summary[0]`), `photoSlotsOf`, `dataSectionOf`, `unitLineOf`.
- `reportSaves`: `nextSave` manda lo que la persona guarda antes que el
  atraso de fotos; `judgeReply` lee `code: 'rate_limited'` y espera
  `retryAfterS` (5 s si no viene) sin rechazar; `SaveVerdict.retry.afterMs`.
- `reportQueue`: ritmo de una escritura cada `REPORT_SEND_GAP_MS` (4 s);
  `tryLater(save, afterMs)` no marca «sin señal» cuando la espera la pidió
  agentes; `forget()` olvida el ritmo; `client_key` viaja solo con las fotos.
- `reportScreen`: `NO_GPS_PHOTO`; una sección con `requireLocation` descarta
  la foto sin posición (o con el GPS fallando) y lo dice; una sin ella acepta
  la foto solo con la hora.
- `reportCreation`: `reportDraftRequest(type, id, page)` manda `page` desde
  la 2; `pageLine` («Página 2 de 3»); `sectionFormRequest(…, clientKey)`;
  `itemsLine` pluraliza («unidades»); CTL-PIS abre en Lilachat (`opensHere:
  true`) desde que Portal desplegó (06/11).
- `appForms`: `x-check-all` → `AppForm.checkAll`; `checkAllValues` pone en
  cada opción la primera que se puede elegir; `CHECK_ALL_LABEL`.
- `appActions.formSubmitFailure`: un solo lector del 4xx de un formulario
  para la app y la web (status, errors, code, retry_after_s).
- `botCommands.validateFormReply` conserva `code: 'rate_limited'` y
  `retry_after_s` (redondeado hacia arriba).

Server (`clientReports.ts`, `botForms.ts`, `botUserRoutes.ts`): CTL-PIS en
`OPEN_REPORT_TYPES`; `page` entero desde 1 hacia Portal (0 es 400); el
contexto de `agregar_foto_de_informe` suma `tipoFoto` (del `photoKind` de la
sección) y `clientKey` (del `client_key` del run); una sección con
`requireLocation` sin `lat`/`lng` es 400 antes de tocar Portal; el
`rate_limited` de agentes sale como **HTTP 429** con `errors`, `code` y
`retry_after_s` (los demás errores siguen en 422).

App y web: `ReportUnitsView` / `ReportUnitsWeb` (diseño j-05) cuando el
repeat es de unidades; «Publicar informe» también al pie de la lista de
unidades con `publishFooterLine`; botón «Marcar todo» (`marcar-todo`) en
`AppFormSheet` y `AppFormDialog` con `fill` en los dos `useAppFormState`. La
pantalla j-06 no es una pantalla aparte: la tarjeta de la unidad ya tiene las
cuatro fotos y la fila de datos, y cada una abre su formulario con un toque.

Límites conocidos: Portal guarda el checklist como booleanos, así que un «No
cumple» vuelve vacío al reabrir y el informe no se publica hasta que los 5
cumplan; `precisionM` no se manda (la app no guarda la precisión del GPS); la
cámara se abre dentro del formulario de la foto, no al tocar el recuadro (un
toque más que el diseño).

E2E del 06/11 (Test, Consorcio Vial del Pacífico, servicio QA-CTLPIS
`6aedcc3a2f5e395dca260f16`, pedido `6aedcc392f5e395dca260f12`, informe
`6aede78618cf3d526c1260f1`), con las tres herramientas reaprobadas por José:

- Web (Chrome de José) y APK (emulador, OTA 1381ce77) abren el mismo
  borrador. Abrir el informe: 1,0 s. «Datos generales» con el pedido elegido
  guardó en menos de 2 s y habilitó el resto de secciones. «Información de
  control» (tramo, turno) guardó en 2,5 s. CTL-IMP vuelve a abrir con sus
  `tramos` (no se guardó nada).
- **Bloqueo (resuelto en Agentes, pendiente de release):** el documento
  llegaba con cinco secciones `form` y sin la `repeat` de unidades, aunque
  `forms` traía `unidad` y `fotos` y `publish.missing` decía «Falta al menos
  una unidad.». Portal sí emite seis; el server de Lilachat pasa el cuerpo de
  Agentes tal cual a `fieldDocumentOf`, y `sectionsOf` no recorta secciones
  sueltas (una inválida anula el documento entero). La causa estaba en la
  lista blanca de Agentes (`core/notices/field-document.ts`, `repeatOf` exigía
  `addLabel` con texto): commit `88b93ee` de Agentes deja pasar `addLabel`
  vacío, `canAdd`, `photoKind`, `requireLocation`, `tool`, `summary`/`enabled`
  por ítem, `publish.warnings` y copia `page` al `repeat`. **Regla:** la lista
  blanca de Agentes duplica nuestro analizador; toda clave nueva que lea
  `fieldDocument.ts` se le avisa a Agentes o se pierde sin error.
- **`seccion` para Portal = el `form` de la entrada, no su id.** Al guardar
  «Datos» de una unidad, `guardar_seccion_de_informe` respondía 422 «seccion:
  No es una de las opciones»: su enum para CTL-PIS es `general`, `control`,
  `unidad`, `checklist`, `observaciones`, `firmas`, y la entrada de la
  plantilla se llama `datos` con formulario `unidad`. El server manda ahora
  `sectionAt(document, path).form` (igual en CTL-IMP, donde entrada y
  formulario comparten id); el despacho sigue en `tramoId`. Portal prefirió
  esto a sumar `datos` al enum: cambiar el `inputSchema` obligaría a José a
  reaprobar la herramienta otra vez.
- `RepeatSection.results`: Portal manda en la sección de unidades Carros,
  Volumen y Terminadas; el analizador los lee y el hub y la lista de unidades
  los muestran (`resultados-unidades`).
- Sin verificar: «Llegó» y el formulario de datos, las cuatro fotos con GPS
  (tiempo de la primera foto contra el tope de 7 s de agentes), publicar, el
  PDF con cuatro fotos por fila y el WhatsApp por foto; lila-app
  (`escantillonCm`, resumen) sigue esperando el OK de José en la sesión lila-2.
  El índice único por pedido de Portal cubre solo informes nuevos: dos pedidos
  de Globofast ya tienen dos controles.

## 4. Lilachat

### 4.1 Motor puro (`shared/src/fieldDocument.ts`, con test)

- `fieldDocumentOf(body)`: parsea y valida el documento; cada `form` pasa por
  `validateFormSpec`. Un documento que no se puede dibujar se rechaza con motivo.
- `sectionAt(document, path)`, `progressOf`, `nextSection` (la primera
  obligatoria sin terminar), `publishBlockers`.
- `applySavedSection(document, path, values, clientKey, state)`: el borrador
  local avanza antes de que Portal conteste; la respuesta lo reemplaza.
- `shared/src/reportSaves.ts`: el guardado como hecho (`ReportSave`), su lugar en
  la cola (`queueSave`), cómo se pinta sobre el documento (`applySave`,
  `documentWithQueue`), el documento en blanco de un tipo (`blankDocumentOf`) y
  cómo se juzga cada respuesta (`judgeFailure`, `judgeReply`, `judgeNotice`).
- `shared/src/reportQueue.ts`: la cola con su drenaje (`createReportQueue`).
- `shared/src/reportScreen.ts`: lo que la pantalla muestra y hace, igual en la
  app y la web (`createReportScreen`). Las dos solo prestan su disco y sus
  llamadas: `app|web/src/spaces/clients/reports/reportQueueStore.ts`.

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
| Sección | `AppFormSheet` / `AppFormDialog` de hoy | el formulario se dibuja acá, desde `document.forms`, con los `values` precargados: abre sin señal y sin ida y vuelta. «Guardar» encola y cierra. Lo que Portal rechaza vuelve bajo su campo al reabrir la sección |
| Fotos del tramo | fila «N fotos» del tramo (j-03) → form `fotos`, y debajo la tira con miniatura y leyenda | una foto por guardado, con su `descripcion` y `progresiva`; `at`, `lat` y `lng` se leen al tomarla. No espera a Portal: se pueden tomar varias seguidas. Un reloj marca la que sigue en el dispositivo. Portal sella al recibirla |
| Cola | `QueueCard` sobre el hub y los tramos | «2 cambios sin enviar…» o «Sin señal…»; cada rechazo con su motivo, «Corregir» y «Descartar» |
| Publicar | `j-04-informe-publicar` | hoja/diálogo con lo que falta (botón apagado) o «Todo listo» → form `publicar_informe` (nota); publicado, el pie del hub muestra «Informe publicado», «Ver PDF» (`pdf_de_informe` de siempre) y «Volver al servicio» |

Código: motor `shared/src/reportCreation.ts` (tipos, rutas, requests,
pastillas; con test); app `app/src/spaces/clients/reports/*`; web
`web/src/spaces/clients/reports/*` (con test de la página). El `chatId` del
canal del cliente llega al Detalle porque los runs viven en ese chat.

Reglas de UI: `constroad-premium-ui`; acento del espacio; estados cargando,
vacío y error en cada pantalla; toque mínimo 44 px; sin hex.

### 4.4 Offline

**Un solo camino de escritura (decisión de F2).** Toda sección y toda foto pasan
por la cola, con señal o sin ella: «Guardar» encola y la hoja se cierra al
instante. Con señal sale en segundos. Dos caminos habrían dado dos reglas de
error y una carrera entre ellos. «Publicar» no entra: exige red.

- El documento vive en AsyncStorage (app) y en `meta` de Dexie (web), por
  servicio y tipo. Se abre sin red con lo último guardado. Un informe ya
  publicado no se reabre: arranca uno nuevo.
- **Informe nuevo sin señal**: sale de los formularios del último documento de
  ese tipo en el espacio (`blankDocumentOf`). Si el dispositivo nunca abrió un
  informe de ese tipo, la pantalla dice que hay que abrirlo una vez con señal.
- **Entrada sin señal**: el Detalle no se guarda (decisión de José, 30/10), así
  que sin señal falla. Su tarjeta de error ofrece «Crear informe» solo si la
  falla fue de red, no de permisos.
- Cada guardado abre su propio run al salir: `reports/draft` deja el documento
  al día en el server, `reports/forms` abre el run, `…/files` sube la foto,
  `…/form` envía. No hace falta cambiar el server ni las herramientas.
- **Orden y dependencias**: se drena en orden. Mientras el informe no exista
  solo sale su primera sección. Un tramo nuevo lleva id local `local-<clave>`
  hasta que Portal da el suyo (`resolveItem`). Lo que cuelga de un tramo
  rechazado espera con él.
- **Respuesta perdida**: antes de enviar se anota qué tenía el informe
  (`SentMark`). Al reintentar, un tramo o una foto que ya están no se reenvían
  (`landedBefore`). Una sección normal se reescribe: da lo mismo.
- **Veredictos**: sin red, 408, 429 y 5xx reintentan con espera creciente; 401
  vacía la cola (regla de `rn-app-loop` §5); el resto queda rechazado y a la
  vista, sin bloquear lo que sigue. Nada se borra solo.
- Lo que llegó a Portal sigue pintado hasta que llega su documento nuevo: una
  sección no vuelve a su estado viejo mientras tanto.
- Dos pestañas de la web comparten el disco: solo envía la que tiene el candado
  (Web Locks) y cada pasada relee el disco.
- Al cerrar sesión se borra todo: la app con `forgetReportQueue`; en la web, la
  base local entera.

## 5. Fases

| Fase | Lilachat | Portal | Sale como |
| --- | --- | --- | --- |
| F1 | motor + rutas del server + hub + tramos + secciones con el formulario de hoy | `informe_de_campo`, `guardar_seccion_de_informe`, autor, fórmulas en el guardado | OTA + web |
| F2 | fotos con leyenda, varias seguidas, cola offline de guardados y fotos | ya estaba en F1 | OTA + web |
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
- 05/11/2026 (noche), decisión de José: el informe avisa al canal solo al
  publicar. Portal lo cambió en `ddd0390e`: `createServiceReport` tiene
  `announce`, y solo el borrador de Lilachat pasa `false`.
- 05/11/2026 (noche), **F2 escrita**: cola de un solo camino (§4.4), fotos con
  leyenda y varias seguidas, miniaturas en el tramo, «Crear informe» sin señal.
  El server y las herramientas no cambian.
- 06/11/2026, **F2 probada sin señal en el emulador** (OTA `a33107b5`, Test,
  Consorcio Vial del Pacífico, wifi y datos apagados): el informe se abre con
  sus formularios, Datos generales y un tramo quedan «Pendiente de enviar», y
  dos fotos con leyenda salen de la cámara una tras otra. La línea llegó a «4
  cambios sin enviar». Al volver la red la cola se vació sola en unos 20 s, y
  el tramo mostró «2 fotos» con sus dos leyendas.
  Defecto hallado en esa prueba: quedó un Tramo 1 vacío además del tramo real.
  Portal crea el informe con un tramo vacío, y el primer tramo hecho sin señal
  creaba otro. Ese vacío debe sus secciones obligatorias y traba «Publicar».
  Arreglo: el primer tramo de un informe que todavía no existe lleva
  `fillsSeed` y escribe sobre ese tramo vacío (`SentMark.seed`). Solo se toma
  si sigue intacto, y un segundo tramo crea uno nuevo. Con la respuesta perdida
  se reenvía: escribir la misma sección dos veces no cambia nada.
- 06/11/2026, **Datos generales** (José: «por qué tengo que llenar datos del
  cliente si estoy en el canal del cliente»):
  - `cliente` y `proyecto` no se piden. `sectionFormOf` los saca del formulario
    y de `required`, en el teléfono y en el server. El server los manda igual
    en el contexto del run (`channelValuesOf`), con el valor que dio Portal:
    `writeFields` de Portal deja vacío lo que una sección guardada omite. En un
    informe nuevo Portal los llena del servicio.
  - `responsable` empieza con el nombre de quien hace el informe y se puede
    corregir. Si ya había uno guardado, se respeta. Sin nombre queda vacío.
  - `ubicacion` trae el botón «Usar mi ubicación» (`x-input: place`). Escribe
    el enlace de Google Maps de donde está el dispositivo, igual que el lugar
    del servicio. Si no hay permiso o GPS lo dice bajo el campo.
  Esto vive en `reportFormAnswer`, sin cambios en Portal.
  Publicado: web y server `cd647c4`, OTA `2b6c0d11` (runtime `79221c17`).
  Verificado en vivo el 06/11 con esa versión:
  - Web, Chrome de José, Test: el formulario de Datos generales ya no trae
    cliente ni obra. Al guardar con la posición simulada, el borrador de Portal
    conservó los dos y actualizó `ubicacion` con el enlace. En un informe nuevo
    `responsable` nació igual al nombre del perfil.
  - Emulador, wifi y datos apagados, servicio `b1`: informe nuevo con
    responsable «J zamora» y sin cliente ni obra. Sin permiso de ubicación, el
    botón avisa bajo el campo. Con permiso escribe el enlace. Datos generales y
    un tramo quedaron en cola. Al volver la red se vaciaron en unos 10 s: 1
    tramo, `control-1`, y Datos generales «Lista» con `b1 · MC-30`.
  - Diagnóstico: código `2b6c0d11`, avisos registrados, 0 % de CPU.
  Sin verificar: «Publicar» sin señal con un informe completo. Se probó solo
  con faltantes, y la hoja los mostró. El botón con GPS real en un teléfono y
  el rechazo de Portal a una sección guardada en cola quedan para campo.
  Datos QA: dos borradores en TEST COMPANY, en los servicios
  `096f1e56d931ff4d4561bb41` y `6a54797255b64bb87befd231`, que limpia Portal.
- 06/11/2026, **la tarjeta del informe dice quién lo hizo** (José: «no sale
  quién creó el informe»). Lilachat no cambia: dibuja cualquier campo de
  `card.fields`. Portal manda `data.record.author` en `report` y `report_pdf`
  (`92c5a383`), solo el nombre, sin correo ni teléfono. Agentes agrega el campo
  «Creado por» después de «Servicio» (`6ad6757`). Sin autor, la tarjeta queda
  como antes.
  Verificado en vivo: web, Chrome de José, Test, Consorcio. Informe nuevo
  publicado con foto. La tarjeta `seq` 7 trae «Creado por: J zamora» y el
  enlace al PDF.
  Límites: las tarjetas ya publicadas no se redibujan. Lo creado en la página
  pública sale sin autor, porque ese enlace no tiene usuario. En Lilachat el
  nombre es el que la persona edita en su perfil: se muestra, no identifica.
  Sin verificar: la tarjeta abierta en el APK. La app dibuja `card.fields` con
  el mismo recorrido, pero no se abrió en el emulador.
  Defecto hallado en esa prueba: antes de guardar Datos generales, el hub
  decía «Faltan datos generales: cliente, proyecto, responsable, fecha», aunque
  cliente y proyecto ya no se piden. Portal lo corrigió en `6c21837e`. Verificado
  en vivo: un informe nuevo dice «Faltan datos generales: responsable, fecha.».
  Un informe guardado sin cliente o proyecto sigue bloqueado, con un texto que
  manda a completarlos en Portal.
  Datos QA: Portal borró el informe `6aedb421fca1f5d5db14e079`, con 0 informes
  y 0 archivos activos; la foto y el PDF quedaron en la papelera. La tarjeta
  `seq` 7 sigue en el canal para que José la borre.
