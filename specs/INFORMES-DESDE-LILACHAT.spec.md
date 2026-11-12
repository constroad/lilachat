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
- **Corrida completa en la web (06/11, 11:00–11:21, tras el arreglo de
  Agentes y el de `seccion`):** unidades en dos grupos con totales; «Llegó» en
  QAP-102 → «Datos» guardado (POST 0,68 s, unidad refrescada en 3,0 s, «Llegada
  10:54 · 148° · 5.2 cm»); las cuatro fotos con posición fija de Lima: subida
  a Portal 2,5 / 2,2 / 1,4 / 3,1 s (tope de agentes 7 s), la primera visible
  en la unidad 6,0 s después de «Enviar»; la unidad pasó a «Terminó 11:20» y
  los totales a «Terminadas 1 de 1»; checklist con «Marcar todo» en 0,56 s;
  publicar 2,8 s; PDF (CTL-PIS 1.2.1, 4 folios) en 1 s: panel fotográfico con
  las cuatro fotos en una fila, con hora y sello de ubicación; registro y
  checklist correctos. La tarjeta del pedido en el canal pasó a «unidades
  terminadas: 1 de 4» y «Salió 06:48 · Llegó 10:54 · Terminó 11:20». Se
  publicó con aviso «3 despachos del pedido sin registrar».
- Sin verificar: el WhatsApp por foto (lo confirma José en su teléfono); la
  app en el emulador con GPS real y el bloqueo sin GPS (los AVD se borraron
  al liberar disco; `lilafotos-qa` recreado, pendiente de código de ingreso y
  de un segundo pedido QA porque el índice es por pedido); el OTA del commit
  de totales (`25d6f96`) espera ese smoke; lila-app (`escantillonCm`,
  resumen) sigue esperando el OK de José en la sesión lila-2. Hallazgo web:
  al reabrir un formulario rechazado se pierden los números (tarea #218).

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

**06/11, la foto del informe, causa de la lentitud:** después de disparar, `upload`
esperaba `placeNow`, una lectura fresca de GPS de hasta 15 s en el APK. A eso se
sumaba la cámara del sistema con su paso de confirmar. Ahora:

- El GPS se lee desde que se abre el formulario, mientras se apunta. `upload` guarda
  la foto al instante y el lugar se resuelve en «Enviar».
- Sección que exige GPS (CTL-PIS): «Enviar» espera al teléfono. Sin lectura dice
  `NO_GPS_PHOTO`, el formulario sigue abierto y el siguiente «Enviar» lee de nuevo.
  Antes el rechazo salía al tomar la foto y la foto se perdía.
- Sección que no lo exige: «Enviar» espera `PHOTO_PLACE_WAIT_MS` (3 s) y la foto va
  con su hora.
- La hora del sello es la del disparo, no la de la lectura.
- `FormCamera` reemplaza a la cámara del sistema en todo campo de foto del APK.
- `cameraFirstFieldOf`: en un informe, si solo falta la foto, el toque en la casilla
  abre la cámara directo. Al disparar vuelve a la hoja con la foto, la hora y la
  descripción opcional. Cerrar la cámara sin foto cierra el formulario.
- Ver la foto: una foto tomada se abre en el visor, deslizando por las de su sección.
  El visor ofrece «Tomar otra». No ofrece borrar: al deslizar cambia la foto en
  pantalla y borraría la equivocada.
- Permisos: GPS y cámara preguntan primero con `get` y solo piden si falta. Android
  rechaza dos pedidos a la vez, y ahora GPS y cámara arrancan juntos.
- La web gana lo mismo salvo la cámara: su campo sigue siendo el del navegador.

E2E 06/11 en el emulador con barra de 3 botones, CTL-IMP en Test, OTA `f50d30e5`:

| Paso | Medido |
| --- | --- |
| «Tomar otra» hasta la cámara en pantalla | menos de 1 s |
| Disparo hasta la foto en el formulario | 1,3 s o menos |
| «Enviar» hasta cerrar el formulario | menos de 0,6 s |

Portal recibió la foto con la hora del disparo y la dirección en el sello. Atrás en
la cámara cierra cámara y formulario. El visor abre la foto de José y la nueva.

Trampa del emulador: `expo-camera` no captura ahí. `generateSimulatorPhoto` entrega
una imagen negra con la fecha en amarillo, así que la velocidad de disparo solo vale
en un teléfono. La cámara del sistema sí daba el patrón de prueba.

Sin verificar: la velocidad en un teléfono físico, y las casillas de CTL-PIS en el
APK. Los tres informes de pista de QA están publicados, y un informe nuevo con fotos
de pista avisa a grupos reales de WhatsApp. Su lógica tiene test en la web.

**06/11, prueba de José en su teléfono:** los campos de informe salen de una línea
y 2 por fila, la hora de inicio toma la hora actual si no hay una guardada, y
«Publicar informe» queda sobre los botones del teléfono. Pendiente: las decisiones
de José sobre WhatsApp por foto, borrar fotos enviadas y video. Portal ya siembra el responsable en
«Responsables y firmas» (`311e2120`).


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

### E2E móvil de `CTL-PIS` (06/11, emulador, OTA `95367b48` y siguientes)

Corrida en el espacio Test, segundo pedido QA (30 m³, QAP-103 y QAP-104).

- **Sin GPS:** con la ubicación del teléfono apagada la foto se rechaza con «Sin GPS no hay foto. Enciende la ubicación del teléfono y vuelve a tomarla.». Con el GPS encendido pasa. Verificado.
- **Casilla en blanco, defecto de Lilachat:** al tomar la foto, la casilla pasaba de punteada a llena y quedaba vacía, sin miniatura ni check, hasta reabrir la vista. El árbol de vistas sí traía la imagen y el check. Al montarse de nuevo se dibujaban bien. En Android, la vista recortada que pierde el borde punteado no volvía a pintar a sus hijos. La casilla ahora lleva `key` por estado y se remonta. No hay pruebas de componentes en la app: se verifica en el emulador.
- **Tarjeta PEDIDO sin salida a las fotos (pedido de José, 12:07):** la tarjeta llegaba al canal y no llevaba a ningún lado. Ahora dice «Ver despachos y fotos». El botón va a Servicios, y `orderFocusOf` cruza el `seq` del mensaje con los registros del canal (`order.*`, `service_id`, `record_id`) para abrir la hoja de ese pedido. La hoja lista los despachos y cada despacho muestra `DISPATCH_PICTURES`, que es la evidencia de planta. No cambia Portal ni el contrato. Los registros se piden al abrir Servicios, así que el chat no suma llamadas.
- **La tarjeta se reconoce por su `kicker` «PEDIDO».** Si agentes lo cambia, el botón desaparece sin error. Se decidió así para no agregar `clientRef` al mensaje, que obligaría a tocar el almacén local del teléfono.

- **Hora de «Llegó» vieja:** al tocar «Llegó» a las 12:22 el formulario traía 12:13, la hora del último borrador. Sin señal podía ser de horas antes. Ahora `arrivalHourOf` toma el reloj del teléfono al abrir el formulario de una unidad en espera. Portal solo manda `horaLlegada` cuando la marcó el chofer, y esa hora se respeta.

- **Recarga que falla:** tras la última foto de QAP-104, una lectura fallida reemplazó el informe por «No se pudo abrir el informe», sin salida. La foto sí estaba guardada y la web abrió el borrador en 0,55 s. No se supo la causa de esa lectura. Ahora una recarga que falla deja el informe en pantalla y reintenta sola 3 veces cada 4 s. Si el informe nunca abrió, el error trae «Reintentar».

Reportado a Portal y verificado con el informe publicado desde el APK a las 12:53:

- El encabezado del PDF de `CTL-PIS`: logo y título en franja normal, contenido desde el folio 1 (`45456f21`).
- El sello: la foto de las 12:51 dice «Avenida Alfonso Ugarte, Lima, Li…» (`45456f21`).
- La salida en la tarjeta del pedido al llegar (`dedaa11b`) y ENTREGADO solo con todas las llegadas (agentes `893ba62`).

Resuelto por Portal en `34d5c36d`: el bloque de firmas se partía entre folios.

### Prueba con un pedido de 12 carros (pedido de José, 06/11)

José pidió juzgar si la lista larga le sirve al ingeniero de campo y cómo diferenciar los pendientes. El orden de ingreso no depende de nada: el último puede ingresar quinto. Solo se listan los pendientes, sin obligar a elegir ninguno.

Con el diseño j-05 la lista no servía:

- Cabían 3 carros por pantalla, así que 8 carros ocupaban casi tres pantallas.
- Los carros en obra, que son el trabajo del momento, quedaban debajo de todos los pendientes.
- Las estadísticas empujaban la lista hacia abajo.
- Los carros que aún no salen de planta no aparecían, y el pedido parecía de 8.

Cómo quedó, en este orden:

1. **En pista:** las tarjetas con sus cuatro fotos. Una unidad terminada a la que le falta algo sigue aquí.
2. **Por llegar · toca el que llegó:** una fila por carro, con placa, salida y «Llegó». Cualquiera puede ser el siguiente.
3. **En planta:** una línea con las placas, sin botón. Portal marca esos ítems con `summary: ['En planta']`, sin llave nueva.
4. **Terminaron:** plegado. Se abre al tocarlo.
5. Las estadísticas van al final, y arriba queda una línea con el conteo de cada grupo.

Abierto para José: un carro que llega sin que la planta lo haya marcado despachado no se puede registrar, porque sigue en «En planta».

Resultado en el emulador, con OTA `01f31791` (git `3bda92d`), informe del pedido `6aee0e7256b47458e58861f6`:

- **Lista larga:** cuatro filas de «Por llegar» entran en una pantalla. Al tocar «Llegó», la tarjeta aparece justo encima de esas filas y la pantalla no salta.
- **Orden libre:** los carros llegaron 206, 203, 208, 201, 207, 204, 202, 205, 210, 209, 212 y 211. Cada uno tomó el siguiente número de unidad, y el PDF salió en ese orden.
- **Hora de llegada:** sale del reloj del teléfono. QAP-207 marcó 13:20 al tocar «Llegó» a las 13:20.
- **Planta a pista:** Portal despachó QAP-209 y QAP-210 con el informe abierto. Pasaron de «En planta» a «Por llegar» al reabrir Unidades, sin tocar nada más.
- **Terminaron:** con los 12 listos, toda la lista cabe en una pantalla. En la web, «Terminaron» se abre y se cierra, y muestra `TERMINÓ 13:19`.
- **Publicación:** 63 de 63 secciones, sin advertencias. Publicado a las 13:46 con el PDF generado antes de 30 s.
- **PDF `CTL-PIS-2026-11-06T18-46-07-025Z.pdf`:** 10 folios, 2,2 MB, encabezado correcto, 48 fotos a 8 por folio y firmas juntas en el último folio. El sello trae hora, dirección y mapa.
- **Tarjeta del pedido:** EN DESPACHO con 4 de 8 llegadas, DESPACHADO con 10 de 12, y ENTREGADO con la última llegada, 12 de 12.

Queda pendiente:

- **Numeración, decisión de José:** la tarjeta numera por orden de planta y el informe por orden de llegada. QAP-203 es «Unidad 3» en la tarjeta y «Unidad 2» en el informe.
- **PDF, cola de Portal:** «UNIDADES SIN TEMP» cae sola en el folio 2, la fila 12 cae sola en el folio 3, el encabezado dice «FOLIO: 1-1», «Observaciones» sale vacío y la dirección del sello se corta.
- **Lista con varias unidades en pista:** cada tarjeta ocupa media pantalla, así que con 4 en pista las filas de «Por llegar» quedan dos pantallas abajo. No se cambió: en obra rara vez hay más de dos carros descargando.

## «Llegó» abre la foto de ingreso (José 07/11)

José: al llegar primero se toma la foto de ingreso y la de temperatura. Pedir los datos antes no tiene sentido.

- **«Llegó» abre la primera foto** de la plantilla (`arrivalKeyOf`), la de ingreso. Si la plantilla no tiene fotos, abre Datos como antes.
- **La unidad pasa a «En pista» con la foto**, aunque siga en el teléfono. Antes solo contaba el estado que manda Portal, y la fila de «Por llegar» seguía ahí.
- **Hora de llegada:** Datos se abre después, con la hora de la foto de ingreso (`hora`, HH:MM). Si la foto aún no sube, va la hora del reloj. Una unidad con Datos ya escrito no se toca.
- Web y app usan la misma regla. Tests: `reportUnits.test.ts` y `ReportDocumentWeb.test.tsx`.
- **Sin verificar:** el recorrido en el emulador y en un teléfono real.

## Fotos adicionales por unidad (José 07/11, diseño j-07b)

El ingeniero Jeremy pidió subir fotos extra de cada unidad, además de las 4 obligatorias. José eligió la opción B de Stitch: una tira «Adicionales · opcional» en la tarjeta de la unidad.

- **Contrato con Portal:** la plantilla de `unidades` trae una 5.ª entrada, `foto-adicional`, con `required: false`, `photoKind: 'adicional'` y su propia herramienta, `agregar_foto_adicional`. Esa herramienta no recibe `tipoFoto`, para no cambiar la huella de `agregar_foto_de_informe`. Pide reaprobación de José solo para la nueva.
- **Tope:** 10 por unidad (`MAX_EXTRA_PHOTOS_PER_UNIT` de `@constroad/shared/informes` v0.9.0, la misma regla que usa Portal). Con 10, el botón «Agregar foto» desaparece. Portal rechaza la 11.ª.
- **No cuentan para terminar:** `photoSlotsOf` deja fuera la adicional, así que una unidad completa no espera fotos extra. Tampoco entran en «Falta» ni bloquean «Publicar».
- **Ver y borrar:** cada miniatura abre el visor, con su hora y descripción. En un borrador, «Eliminar» usa `quitar_foto_de_informe`, como las fijas.
- **PDF (Portal):** van después de todas las unidades, rotuladas «Adicional · placa · descripción».
- **Sin la entrada en la plantilla** la tarjeta se ve como antes.
- **Sin verificar:** el recorrido en el emulador y en un teléfono, hasta que Portal publique la plantilla y José apruebe la herramienta.

## «Ver PDF» junto a «Publicar» en un borrador (José 07/11)

José: en un borrador solo estaba el botón grande «Publicar». Pidió «Ver PDF» al lado, en la misma línea.

- `pdf_de_informe` no sirve para un borrador: lila marca como completado lo que renderiza, así que lo publicaría.
- Portal publicó `vista_previa_de_informe` (2b670a82, solo lectura). Arma la vista firmada con las mismas hojas del PDF y la marca «Borrador · vista previa sin publicar». No guarda nada ni avisa al canal. La URL vence en 15 minutos.
- La puerta es la de siempre: `GET …/reports/:id/pdf?preview=1`. El server de Lilachat agrega `preview: true` a `client.report.requested`, y Agentes llama a la vista previa en vez del PDF.
- Web: «Ver PDF» ocupa un tercio y «Publicar» dos tercios. Cuando está lista, el botón pasa a «Abrir vista previa», un enlace a una pestaña nueva; abrir la pestaña después de la espera la bloquearía como popup.
- APK: la vista previa es una página, no un PDF, así que se abre en el navegador.
- **Probado en producción (07/11, 19:51Z), web, espacio Test, borrador «Control de imprimación» de QA-CTLPIS:** «Ver PDF» dio «Abrir vista previa» en unos 8 s. La página firmada de Portal muestra «Borrador · vista previa sin publicar» con las 4 hojas, y el informe siguió en borrador. Agentes en cebf80a; José aprobó la herramienta a las 19:47Z.
- **Sin probar:** el APK (abre la misma página en el navegador) y un miembro que no es admin.
- **Por confirmar con Portal:** que los borradores aparezcan en los `reports` de `detalle_de_servicio`. Si no, a un miembro que no es admin Agentes le responde 404.

## Quitar una foto enviada de un borrador (José 06/11)

- El visor del informe muestra «Eliminar» solo en una foto que ya llegó a Portal,
  de un informe en borrador (`removablePhotoId`). Una foto que sigue en el teléfono
  se descarta en la cola. Un informe publicado conserva sus fotos.
- «Eliminar» actúa sobre la foto en pantalla al momento del toque, aunque la persona
  haya deslizado a otra (`ViewerRemoval`). Antes de enviar pide confirmación y nombra
  la foto por su descripción y hora.
- No pasa por la cola: el server abre el formulario `quitar_foto_de_informe` sin
  campos y la app lo envía enseguida. La foto sigue en pantalla hasta que Portal
  acepta. Sin señal o con rechazo, la persona lo lee y nada cambia.
- Portal rechaza un informe publicado y es idempotente con la misma confirmación.


## 13. Registro y levantamiento de observaciones (REG-OBS / LEV-OBS, José 11/11)

APK para campo, web para oficina. Diseños Stitch `design/stitch/obs/ob-01-lista.png`
(lista con mapa y pestañas), `ob-02-nueva.png` (nueva observación),
`ob-03-levantar.png` (antes y después) y `ob-07b-lienzo-mapa.png` (resumen de
oficina).

### Contrato (Portal ead85b1a, agentes 275fb32 y 506f753)

- **Lectura:** el mismo evento `client.report.draft.requested` con `type`
  REG-OBS o LEV-OBS. agentes lo envía a
  `informe_de_observaciones({ servicioId, tipo, informeId? })` y devuelve
  `document`. La sección `observaciones` trae `items`:
  `{ id, code, note, lat, lng, at, status open|lifted, liftedAt?, liftNote?, media[], liftMedia[], segment? }`.
  Cada media es `{ url, thumbUrl?, mime, durationS? }`. El mapa viene como
  `{ streets[{ id, name, geometry }], imageUrl? }`, y además llega
  `publish { label, missing[] }`. Topes: 200 ítems y 10 medios por lado.
  agentes pone `lat`/`lng` en null si están fuera de rango. Lilachat no guarda
  este documento: no arma formularios de sección con él.
- **Escrituras:** son corridas del formulario de la app del cliente. El
  contexto llega dentro de `values`, y los esquemas de Portal son `.strict()`.
  - `registrar_observacion { servicioId, informeId?, entradaId (uuid), lat, lng, nota? ≤600 }`.
    Sin nota, Portal escribe «Observación registrada en campo, sin nota.».
    `informeId` solo sale desde un REG-OBS. Desde un LEV-OBS, Portal la
    archiva en el registro abierto del servicio.
  - `levantar_observacion { servicioId, observacionId, informeId?, nota? }`.
    `informeId` solo sale desde un LEV-OBS. Es idempotente: si se repite,
    conserva la fecha y cambia solo la nota.
  - La respuesta trae `data` = `{ informeId, observacionId, codigo }` y aparte
    `upload` (el mismo ticket que `subir_al_drive`). Cada foto o video va del
    teléfono a Portal en un multipart, con `clientUploadId` = la clave del
    archivo. Portal responde 201 o 200 si es repetido. Un 410 vuelve a
    confirmar con la misma `entradaId` (o el mismo `observacionId`) y trae un
    ticket nuevo, una sola vez. Video: mp4, webm o quicktime de hasta 30 s.
- **Publicar:** todavía no desde Lilachat (solo el navegador de Portal dibuja el
  mapa del PDF). `publish.missing` dice «Por ahora este informe se publica desde
  Portal.» y la pantalla lo muestra.

### Interruptor

`OBSERVATIONS_OPEN_HERE` (`shared/src/observations.ts`) está **encendido
desde el 11/11**. José aprobó las tres herramientas en Agentes (agentes c255abc):
`informe_de_observaciones` a las 23:07:40Z, `levantar_observacion` a las
23:07:42Z y `registrar_observacion` (ya con `precisionM` y `fuente`) a las
23:56:31Z. Si se apaga, REG-OBS y LEV-OBS vuelven a abrir la página de Portal y
el server rechaza los tipos y los kinds.

**Primera corrida en producción (12/11, 00:33Z): «No se pudo abrir el informe».**
agentes respondió bien: 838 bytes, un borrador vacío. El server lo leyó con
`observationDocumentOf` y le mandó a la app el resultado, que ya no trae
`sections` sino `observations`. La app lo volvió a leer y lo rechazó. Con
`fieldDocumentOf` esto no pasaba porque devuelve la misma forma que lee. El
lector ahora acepta también su propia salida, y un test lo fija leyendo dos
veces el mismo documento. Lo diagnosticaron lila-2 (log del server sin la línea
de «sin respuesta») y agentes (log de las dos respuestas ok).

En la misma corrida apareció otro defecto: el selector preguntaba «¿Quién es el
responsable?» también para las observaciones. El contrato no tiene ese campo y
§5-ter regla 1 dice que no se tipea, así que ahora se salta. Además, REG-OBS
llevaba el ícono de la imprimación y ahora tiene uno propio.

### Reglas de campo aplicadas (stitch-design §5-ter, José 11/11)

José: «tomar foto, plin, dato aquí, ubicación del teléfono y listo». Esto lo
auditó Portal sobre `ob-01…03`.

- «Nueva observación» abre la cámara al primer toque, y el GPS se lee al mismo
  tiempo. Son 3 toques: Nueva, disparar, Registrar. Sin campos obligatorios.
- El botón de abajo hace siempre el siguiente paso pendiente y nunca está
  apagado (`registerAction`, `liftAction`):
  - mientras busca la ubicación dice «Buscando tu ubicación…»;
  - sin GPS dice «Leer el GPS de nuevo»;
  - antes de la foto del después, dice «Tomar foto del después».
- Se muestra «GPS ±N m», nunca las coordenadas, y el lugar en la calle cuando
  hay mapa de obra.
- Al registrar se envían `precisionM` (redondeado, de 0 a 5000) y
  `fuente: 'apk' | 'web'`.
- Portal marca `aproximada` cuando el GPS pasa de 15 m, y la pantalla dice
  «Ubicación aproximada (±N m)».
- Los objetivos táctiles miden 56 dp o más.

### La web también registra

José, por medio de Portal: un iPhone no tiene APK, así que la PWA móvil es el
formulario de campo. `ObservationFormsWeb` registra y levanta con las mismas
reglas:

- la cámara entra por la puerta `ServiceDriveWeb.EvidenceInput`;
- el GPS se lee con `navigator.geolocation` y su precisión;
- `fuente: 'web'`.

El estado de la escritura es el mismo store compartido
(`observationWriteStore`) en el APK y en la web.

### Qué está hecho

- `shared/observations.ts`: lee el documento, separa pendientes de levantadas,
  calcula totales y % de avance, arma los pines (rojo pendiente, verde
  levantada; `DischargePin.fill`), encuadra el mapa sin calles, nombra el lugar
  («Av. Los Incas 0+240» por segmento o por la calle a ≤30 m), y arma la
  insignia de evidencia y la hora de Lima.
- `shared/observationWrite.ts`: arma los pedidos, deja las notas en blanco
  afuera, lee la respuesta y tiene `writeObservation` (confirma, sube archivo
  por archivo y reconfirma ante un 410). Lo que dice la pantalla sale de
  `writeOutcome`.
- `driveUpload.formRunAnswer` y `uploadFailure` se comparten con el Drive.
- Server: `bots/observationForms.ts` (los dos kinds con el interruptor), la
  lectura en `clientReportDraft`, y «Registro de observaciones» en
  `isFieldReport`.
- APK (`spaces/clients/observations/*`):
  - Lista: mapa, pestañas Pendientes/Levantadas, tarjetas y «Nueva
    observación».
  - Nueva: botones Foto/Video de 72 px, GPS al abrir con reintento, nota
    opcional y «Registrar observación». La clave de la entrada vive lo que
    dura la pantalla.
  - Levantar: antes en el visor, después con cámara y nota, y «Marcar como
    levantada» bloqueado hasta tener una foto o video del después.
  - La cámara entra por la puerta `useDriveUpload.captureEvidence`.
- Web (`ObservationsWeb`):
  - totales Total/Levantadas/Pendientes/Avance con barra;
  - mapa y filtro Todas/Pendientes/Levantadas;
  - cada fila abre su antes y su después en el visor, y una pendiente se
    levanta ahí mismo;
  - «Nueva observación» abre la cámara del teléfono o el selector de archivos
    en la computadora.

### Diferencias con el diseño

- Sin responsable, plazo («en 4 días», «Vence hoy») ni autor de la
  observación: el contrato no los trae.
- Sin «Mover pin»: el punto es el GPS del teléfono (§5-ter regla 3: mover es
  opcional).
- Sin el micrófono propio: el texto apunta al dictado del teclado. Agregarlo
  pide una librería de voz.
- La web no es el lienzo de `ob-07b`: es el resumen. El editor del documento
  sigue en Portal.

**Segunda y tercera corrida (12/11, 00:58Z–01:53Z): tres defectos más.**

- **La foto del después se perdía al volver de la cámara.** El canal de
  cliente armaba su `target` en cada render. La pantalla volvía a pedir el
  informe cada vez que cambiaba, y al volver de la cámara una respuesta
  fallida desmontaba el levantamiento con la foto recién tomada. Ahora el
  `target` se memoriza por sus tres valores (APK y web), y las pantallas
  conservan el último informe bueno mientras llega otro (663c98f4).
- **Ráfagas de lecturas.** Por lo mismo, cada apertura mandaba la misma
  lectura de 8 a 18 veces por segundo. agentes tiene un tope de 20 llamadas
  por minuto y persona, así que rechazó seis («No se pudo traer el
  informe»). En la obra eso deja a la persona sin herramientas un minuto,
  escrituras incluidas. Desde el memo, agentes contó una lectura por apertura.
  Además, las lecturas del mismo informe que se pisan comparten una sola
  petición (`sharedInFlight`, e94262f8).
- **«Este informe ya no está en el Portal» después de levantar.** Levantar
  desde el registro contesta con el id del LEV-OBS. La pantalla del REG-OBS
  lo adoptaba y Portal respondía `not_found`. Ahora solo un registro adopta el
  id que contesta. Un levantamiento vuelve a pedir el informe de la pantalla.
- La pastilla de estado de la tarjeta ya no se estira hasta formar un óvalo.

**Verificado (OTA 35b5c959, web index-B0zXk8kj):** en el emulador, en el
espacio Test, con «QA-CTLPIS — borrar»:
- OBS-001 y OBS-002 registradas con foto, GPS ±5 m y nota.
- Levantadas con foto del después y nota. Quedaron en «Levantadas 2», con el
  pin verde y «Levantada 11/11 · 20:52».
- Portal creó el borrador LEV-OBS del día.
- La web, en el Chrome de José, muestra total 2, levantadas 2 y avance
  100 %, con las dos imágenes del antes y del después.
- agentes confirmó en su log `registrar_observacion` y `levantar_observacion`
  ok, y una lectura por apertura después del memo.

### Sin verificar todavía

- **La cola sin señal:** hoy un registro sin red falla y queda en pantalla para
  reintentarse con la misma clave. No se encola.
- **Video en el APK y registro desde la web:** la extensión de Playwright no
  sube archivos, y en el emulador solo se probó la foto. La web lo cubre un
  test de componente.
- **Ubicación aproximada (> 15 m) y la calle por tramo:** el emulador da ±5 m
  y la obra de prueba no tiene la calle donde cae el GPS.
- **El hilo bajo la tarjeta del REG-OBS** en el canal.
- **Limpieza:** se le pidió a Portal por el camino de la app (OBS-001/002 y
  los borradores REG-OBS/LEV-OBS del 11/11).

## 14. Área adicional en iPhone: opción B (IAA, José 12/11)

José: «vamos con la opción B, pero desde Lilachat instrúyelo qué aplicación
abrir desde el iPhone, paso a paso qué debe hacer, cómo calcular y cómo volver
a Lilachat para guardar esos valores. 15 metros está bien. El orden que
propones también me parece». Ese orden es el de Portal: precisión →
prueba de José → E2E en TEST → lienzo REG/LEV → embed de Lilachat web, y el
área adicional **después**. Por eso Lilachat queda listo detrás de
`AREAS_OPEN_HERE = false` y se enciende cuando Portal publique sus herramientas.

### Contrato con Portal (acordado el 12/11, propuesta hasta su sha)

- Lectura: `informe_area_adicional` {servicioId, informeId?} → {id, codigo,
  estado, fecha, areas[], totales}. Cada área: id, item, ubicacion, descripcion,
  largoM, anchoM, espesorCm, areaM2, volumenM3, metodo, verificar, lat, lng,
  precisionM, fuente, aproximada y fotos (mediaId, url, thumbnailUrl, captura).
- Fotos: hasta 100 por área y 1 000 por informe (agentes 3006ed9). Portal
  tiene un área real con 85 fotos y 25 con más de 10. Las fotos sin área llegan
  a nivel del informe en `fotosSinArea` (siempre presente, vacío si no hay) y
  Lilachat las muestra bajo el informe, fuera de las áreas.
- Escritura: `registrar_area_adicional` con `kind: 'crear'`, la `entradaId`
  (idempotencia) y las cifras como contexto. Los dos textos (`ubicacion`,
  `descripcion`) van como valores del formulario y son opcionales. En blanco no
  se manda nada: Portal pone la calle del punto (≤30 m) y «Bacheo localizado».
  Nunca un relleno nuestro.
- Archivos como en observaciones: la respuesta trae {informeId, areaId, codigo}
  y el boleto. Cada archivo va con `clientUploadId`, y la captura de Medición
  lleva `captura: true`. Portal guarda cada área `manual: true`: si no, sus
  fotos la recalculan a 0.
- `metodo`: iPhone `medidas-iphone`; Android y computadora `a-mano`. `ar-app`
  queda reservado (AR nativo, más adelante) y `foto-medida` es de Portal.
  `verificar` y `aproximada` los calcula Portal: se leen, nunca se mandan, y en
  campo no se muestra «Verifica esta área».
- Límites (los de Portal, de sus 68 áreas reales): largo y ancho de 0,1 a
  500 m; área de 0,05 a 5 000 m², con «¿Seguro?» desde 1 000 m²; espesor de 1 a
  50 cm. Decimales: 2 en largo, ancho y área; 1 en espesor; 3 en volumen.
  Volumen = área × espesor / 100.

### Lo que hace Lilachat

- `shared/areaMeasure.ts`: los 7 pasos para el iPhone, sacados de la guía de
  Apple (es-LA, iOS 27). La app se llama **«Medición»** y está en la carpeta
  **Utilidades**. Apple recomienda medir entre 0,5 y 3 m y aclara que las
  medidas son aproximadas. Los pasos: abrir Medición, apuntar al piso, largo
  con «+», ancho con «+», foto con el botón blanco (o captura con botón lateral
  y subir volumen), volver a Lilachat y escribir. Además lee las cifras
  («3,25», «325 cm», «17,6 m²»), las calcula (área de los lados ya redondeados)
  y aplica la regla de 15 m (`APPROXIMATE_FROM_M`).
- El borrador sobrevive a ir a Medición: lo escrito y el GPS se guardan en el
  navegador por servicio, durante 2 h. Al volver, la pantalla abre sola el
  área a medio llenar. Si iOS cerró Lilachat, el paso 6 dice el camino: canal
  del cliente → Servicios → servicio → Informes → Área adicional.
- `shared/additionalArea.ts`: lee el informe y también su propia salida (la
  lección de la primera corrida de observaciones). Arma el pedido y la escritura.
- `shared/formFilesWrite.ts`: la escritura con archivos de observaciones pasó
  a ser genérica. Observaciones y áreas la usan igual; los tests de
  observaciones no cambiaron.
- Web (`areas/AreasWeb`, `areas/AreaMeasureWeb`): total, tarjetas (m², lados,
  método, lugar), «Nueva área» con la guía abierta en iPhone, largo × ancho o
  área total, espesor opcional, cálculo en vivo, captura desde Fotos (en
  iPhone, sin `capture`), GPS «±N m» o «Ubicación aproximada (±N m)» y
  «Guardar área» abajo.
- Server (`bots/areaForms.ts`): el `kind` `area_create` y la lectura IAA,
  apagados con el mismo interruptor. Refuerzan los límites de Portal antes de
  la puerta (lados que no dan el área, AR, método de Portal, medio punto).
- Los dos selectores (APK y web) saltan «responsable» en observaciones y áreas
  (`asksResponsible`).

### Sin hacer todavía

- **APK:** la pantalla de áreas para Android (`a-mano`). Hasta tenerla, el
  interruptor no se enciende: hoy IAA abre la página de Portal en las dos.
- **Diseño Stitch** del flujo de campo: Portal dijo que es nuestro. Se genera
  antes de encender, con el pie 1.82.0 (sin textos obvios ni internos).
- **Editar y quitar** un área (`editar`, `quitar`): el contrato los tiene,
  Lilachat todavía no.
- **E2E:** necesita las herramientas de Portal. Se hará en TEST desde un iPhone
  real (Medición no corre en el emulador), con la limpieza por el camino de la
  app.
- Un aviso global «Tienes un área a medio guardar» si iOS reinicia Lilachat.
  Hoy lo cubre el texto del paso 6.

## 15. Editor 2.0 de Portal dentro de Lilachat web (José 11/11)

Decisión de José: todo miembro del canal edita el informe, solo los admins
borran, y cualquier versión anterior se restaura (eso vive en Portal). En el
teléfono y en el APK sigue el formulario de este spec.

**Contrato (Portal y agentes, 11/11):**

| Pieza | Valor |
| --- | --- |
| Marca por informe | `editor: 'v2'` en `client.service.requested`. Hoy: CTL-PIS, CTL-IMP, REG-OBS, LEV-OBS y CON-CAP. VAL-SRV y LIQ-SRV entran después, sin cambios acá |
| Pedido del enlace | `GET …/services/:serviceId/reports/:reportId/embed` → evento `client.report.embed.requested` {client_id, service_id, report_id, user} → herramienta `abrir_editor_de_informe` (agentes 9ec3e8c) |
| Respuesta | `{url, expires_at}`; url = `https://www.constroad.com/embed/report/<id>#t=<token>`. Token por miembro y por pedido, 12 h, en el fragmento (no llega a logs ni Referer) |
| Rol | Lo firma agentes (`space_role`, de la lista de miembros); el evento no lo lleva |
| Origen | Solo `https://www.constroad.com` (en dev también `http://localhost:3000`). `frame-src` de la CSP lo permite |
| Mensajes v1, Portal → Lilachat | `portal-embed:ready`, `:dirty` {dirty}, `:saved` {reportId, savedAt}, `:published` {reportId, pdfUrl?}, `:closed`, `:error` {code} |
| Mensajes v1, Lilachat → Portal | `portal-embed:close-request`, `portal-embed:theme` {mode} |
| Ancho | Ventana ≥ 1024 px (umbral del lienzo). Más angosta: la ficha o el formulario de hoy |

**Qué hace Lilachat** (`shared/src/portalEmbed.ts`, `web/src/spaces/clients/reports/PortalEmbedWeb.tsx`):
- Tocar un informe marcado, en ventana ancha, abre una capa sobre toda la
  ventana: barra de 56 px (Volver, servicio, informe) y el marco debajo. Abre
  así aunque sea un borrador.
- Pide el enlace una vez por apertura. El server y la web validan origen,
  ruta, token y vencimiento; otro origen es una falla y no se enmarca.
- Solo acepta mensajes del origen de Portal y de ESE marco, con `version: 1`.
- `ready` → le manda el tema (claro u oscuro) y lo sigue si cambia.
- Volver o Escape: antes de `ready` cierra al toque; después manda
  `close-request` y espera `closed`. Sin cambios, cierra solo a los 3 s si
  Portal no contesta. Con cambios espera a Portal («Guardando antes de
  cerrar…»), que guarda primero.
- Con cambios sin guardar, cerrar la pestaña del navegador pregunta.
- `saved` o `published` → al cerrar se vuelve a pedir el detalle una vez. Sin
  polling.
- `error expired` → pide otro enlace y recarga el marco. Otro código se
  muestra en palabras, con Reintentar y «Abrir en el Portal».

**Lo que Portal publicó (aa4cf2d9, 11/11)** con `REPORT_EMBED_LIVE = false`,
así que ningún informe trae todavía `editor: 'v2'`:
- Códigos de error de la página: `expired` (vencido, inválido o recargado sin
  `#t`) y `not_found` (el informe ya no está o no es de ese enlace). Agentes
  usa `not-found`; Lilachat lee los dos igual.
- Tras `:closed` pueden llegar el `:dirty false` o el `:saved` de ese mismo
  guardado: Lilachat ignora todo lo que llega después de `:closed`.
- Si el guardado del cierre falla, Portal no manda `:closed` y muestra el
  error en el marco; Volver lo vuelve a pedir.
- El marco no lleva `sandbox`. Si algún día lo lleva, necesita
  `allow-downloads allow-scripts allow-same-origin allow-forms allow-popups`.
- Distinto del editor de admin: sin «Imprimir» ni «Enviar por WhatsApp» (el
  `/print` no se deja enmarcar) y sin elegir firma o sello (viven en el Drive
  de la empresa). Sí están «Publicar PDF» y «Descargar PDF».

**Pendiente:** José aprueba `abrir_editor_de_informe` en agentes; Portal
enciende la marca en su propio commit y pasa el sha. Recién ahí, E2E en TEST:
abrir, editar, guardar, cerrar con cambios sin guardar y enlace vencido.
