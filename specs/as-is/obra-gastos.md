# As-is · Gastos («Revisar gasto»)

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 23/10,
> `specs/AS-IS-0.1.170.spec.md` (13/11 noche 2, 3 y 4), `specs/ARCHITECTURE.spec.md` §118 y
> `design/stitch/INVENTARIO.md` (gst-01, gst-02).

## 1. Qué es

El registro de un gasto desde un comprobante (voucher). Alguien sube la foto del
comprobante a un canal de caja (por ejemplo #flujo-caja). Agentes lo lee y publica una
tarjeta en el hilo con «Revisar gasto» y «Descartar». El formulario reparte el monto
entre las partidas de un servicio y lo registra en Portal.

- Lilachat **no** lee el voucher ni guarda el gasto. Dibuja la tarjeta y el formulario
  que manda Agentes, reparte el monto y valida el centavo.
- El formulario es genérico de las apps (`AppForm`). Lo especial son tres extensiones
  opcionales del esquema: secciones plegables, varios botones y reparto por pesos.

## 2. Qué hace hoy

### Tarjeta del gasto (gst-01)

- Por completar: monto grande, comercio, comisión, la pregunta y «Revisar gasto» a todo
  el ancho, con «Descartar» debajo.
- Registrado: destino, partidas y «Registrado por».
- Ya registrado (misma operación y monto): «Ya registrado», sin «Aprobar» (Agentes 4453271).
- En un hilo angosto la cabecera hace `flex-wrap` y los botones no se parten.
- La raíz del hilo muestra la foto del comprobante como en el chat (APK:
  `useThreadPhotoViewer`, abre el visor).

### Formulario «Revisar gasto» (gst-02-completar-v2)

- **Cabecera:** logo y nombre de la app, «APP», el título y «Canal #… · Registra: Nombre».
- **Tarjeta del comprobante arriba:** la del hilo (`cardContextOf`), viaja por
  `EphemeralAnswer.context`.
- **Pasos numerados** (`numberedStepsOf`): «1. ¿A qué va?» (Servicio / Proyecto),
  «2. Servicio», «3. Partidas del servicio». El diseño aplica desde el primer paso
  (`isDesignedForm`).
- **Partidas:** fichas con casilla; cada marcada con su % (`sharePercent`), «ajustado» y
  el monto a mano. Aviso «Asignado S/ X de S/ X · 100 % CUADRADO» en verde. Si falta o
  sobra, lo dice y el envío queda bloqueado. Lo que nadie toma: «Sin asignar … queda como
  gasto general».
- **Reparto** (`reparto`): «Una partida», «Partes iguales», «Según partida» (por pesos) y
  «A mano». Regla del centavo de Portal: la última fila con peso toma lo que queda
  (100 entre 3 = 33.33 / 33.33 / 33.34).
- **«Corregir datos» plegable** (`x-section`, `x-collapsed`): empieza abierta si un
  requerido de adentro está vacío y se abre sola ante un error.
- **Botones** (`x-submits`, hasta 3): «Registrar gasto» (estricto) y «Guardar borrador»
  (no exige requeridos ni que cuadre). El id tocado viaja como `values._accion`.
- **Avisos en vivo** solo de lo que ya se llenó (`filledRemarks`).

### Web/PWA

- `web/src/chat/commands/AppFormDialog.tsx`, `AppFormFields.tsx`, `FoldedSection.tsx`,
  `FormHeader.tsx`, `FormSummary.tsx`, `ListField.tsx`. El diálogo es más ancho en estos
  formularios. Tarjeta: `web/src/chat/botBlocks/*`.

### APK

- `app/src/chat/commands/*` con `FoldedSection.tsx`; el scroll al error va a la sección.
  Tarjeta: `app/src/chat/botBlocks/*`.

### Server

- El formulario corre como cualquier formulario de una app: `POST /api/chats/:chatId/commands/:commandId/form`
  (`submitForm`). Solo pasa un `_accion` que el formulario declaró; uno desconocido es el
  primero. El resumen en vivo usa `form.preview.requested` (`x-preview: reparto_de_gasto`,
  3 s de plazo, `bots/botFormLive.ts`).

### Shared

`appFormSteps.ts` (`isDesignedForm`, `isSplitForm`, `numberedStepsOf`), `appFormSections.ts`,
`appFormSubmits.ts` (`ACTION_KEY`), `appFormSplit.ts`, `appFormLive.ts`, `appFormRows.ts`,
`appForms.ts` (`validateFormValues(..., { draft })`), `botBlocks.ts`.

### Dependencias

- **Agentes:** lee el voucher, arma la tarjeta y el esquema del formulario (campos,
  partidas con su peso, `x-section`, `x-submits`), y recalcula el reparto.
- **Portal:** guarda el gasto y sus partidas. Lo que Finanzas de Portal lee de ese gasto
  no se verificó desde Lilachat.

## 3. Diferencias APK vs web

El dibujo y las reglas son las mismas (shared). Diferencias: diálogo ancho en la web y
hoja en el APK. En el APK el scroll al error dentro de la sección no se verificó en vivo.

## 4. Historia reciente

- **23/10** §118: avisos de las apps que no ensucian el chat y `/gastos` sin digitar.
- **28–29/10** Listas de ítems en los formularios. Decisión: gastos al canal elegido sin
  confirmar, sin tarjeta con IA.
- **04–05/11** Qué guarda Portal del gasto; cómo lee Agentes el voucher; decisiones de José
  sobre partida, comisión y pagos cargados a mano; un botón corre una línea y las filas
  funcionan en un hilo.
- **12/11** Lista marcada por una elección; el monto llega como número; los selectores
  largos tienen lugar.
- **13/11** Las partidas reparten solas. El formulario como gst-02 en web y APK. Un solo
  formulario «Revisar gasto» con secciones plegables, dos botones y reparto por pesos.
  Probado en vivo en la web (Test #flujo-caja, voucher B001-000779 de S/ 180).

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| gst-01 tarjetas | Dibujo genérico hecho; falta el texto de Portal y la auditoría (según inventario) | `botBlocks/*` |
| gst-02 completar (v1) | No generado (Stitch cortó) | — |
| gst-02-completar-v2 | Implementado web y APK | 42 referencias en código; `appFormSteps.ts` |
| r155-gasto-vista-previa, r155-gastos-cola | Referencia del §118; no auditados contra el código | PNG en `design/stitch/` |

El inventario dice que falta «Corregir datos» plegable (Portal). Está hecho del lado de
Lilachat con `x-section` desde el 13/11; el inventario no se actualizó.

## 6. Pendientes y deuda conocida

- **Sin verificar:** el formulario en el APK en vivo y el scroll al error dentro de la
  sección en el APK (según as-is 0.1.170).
- **Sin verificar:** la lista de ocho o más partidas en el celular.
- **Pedido a Portal / Agentes (13/11):** el texto del botón con comisión e ITF
  («Registrar gasto · S/ 505.05»). No verificado si llegó.
- gst-01: falta el texto de Portal y la auditoría contra la captura.

## 7. Pruebas

- **Shared:** `appFormSteps.test.ts`, `appFormSections.test.ts`, `appFormSubmits.test.ts`,
  `appFormSplit.test.ts`, `appFormLive.test.ts`, `appFormRows.test.ts`, `appForms.test.ts`.
- **Web:** `appFormDialog.expense.test.tsx`, `appFormDialog.review.test.tsx`,
  `appFormDialog.lists.test.tsx`, `FormSummary.test.tsx`.
- **Server:** `bots/botForms.test.ts`.
- **Maestro:** sin flujo de gastos.
- **E2E:** en vivo en la web el 13/11 (Chrome de José, producción, Test #flujo-caja).
