# As-is · Tanques, materiales, consumos y cubicaje

> Fecha de corte: **17/11/2026**. Fuentes: código de `main`, `git log` desde el 23/10,
> `specs/ARCHITECTURE.spec.md` (§118, §131, §176, §180, «Fotos de formularios» 06/11),
> `specs/AS-IS-0.1.170.spec.md` (13/11 noche 7 y 8) y `design/stitch/INVENTARIO.md`.

## 1. Qué es

Lo que la planta y la obra registran sobre tanques (líquidos), materiales y agregados,
consumo de combustible y cubicaje de volquetes.

- **El dueño es Inframaq** (otra app de ConstRoad, con su propia base). Tanques,
  agregados y consumos se guardan allá, no en Portal ni en Lilachat.
- Inframaq llega a Lilachat como **app del espacio**: comandos «/» (`/tanques`, `/clima`,
  `/asistencia`), acciones del ⚡, formularios y tarjetas. Lilachat no tiene pantallas
  propias de tanques: dibuja el **kit genérico** de formularios y bloques.
- El cubicaje del despacho de un pedido también se ve en el detalle del servicio
  (viene de Portal).

## 2. Qué hace hoy

### Tanques

- Bloque `tank` del kit de tarjetas (`shared/src/botBlocks.ts`): el tanque dibujado
  (cilindro con nivel y línea del mínimo), valor, estado en palabras («Saludable», «Stock
  medio», «Bajo») con su tono, y el delta como texto, también en cero. Hasta 12 tanques.
- Tocar un tanque abre su detalle (un nivel, nunca un bucle): el tanque grande, su nivel,
  mínimo y última lectura (24/10).
- Web: `web/src/chat/botBlocks/BlockTank.tsx`. APK: `app/src/chat/botBlocks/BlockTank.tsx`.

### Medida de tanque y movimiento de material (formularios de Inframaq)

- Formulario de la app con fotos. Toda foto puede salir de la cámara o de la galería
  (José 06/11):

| Origen | Qué pide al server | Qué queda en la foto |
| --- | --- | --- |
| Cámara de Lilachat (desde 12/11) | sello Timemark con `lat`, `lng`, `precision` | hora, fecha, día, dirección y logo (lo quema el server) |
| Cámara sin GPS a tiempo | `stamp=hour` | fecha y hora |
| Galería con EXIF | `stamp=taken`, `takenAt` | la fecha de la foto; nunca lugar |
| `x-gallery: true` | nada | sin marca (un voucher) |

- `x-gallery: false` deja solo la cámara. El GPS arranca al abrir la cámara.
- Cada foto del formulario guarda su punto y su hora. La app los recibe en
  `form.submitted.photos`, aparte de `values` (`server/src/bots/formPhotoPlaces.ts`).
- La galería de una tarjeta acepta fotos de `inframaq.constroad.com` (13/11).

### Consumo de combustible (formularios vivos, h-01…h-04)

- Periodo, pedidos como filas con casilla (uno bloqueado con su motivo) y lecturas por
  tanque. Hoja de lecturas con miniaturas; visor con «Elegir esta opción»; resumen en
  vivo arriba de «Enviar».
- Motor `shared/src/appFormOptions.ts` (`choiceOptions` con `x-thumb`, `x-photos`,
  `x-match`, `x-disabled`; `optionsForRow`, `keptAfterRefresh`, `previewReplyOf`).
- Server: `bots/botFormLive.ts` (`refreshForm`, `previewForm` con 3 s de plazo).
- Web y APK: `MultiField`, `RichChoiceField`, `ListField` con filas fijas, `useFormLive` (600 ms).

### Cubicar un volquete (Inframaq, pla-02 / pla-03)

- Acción `cubicar_volquete` en el ⚡ (Test: solo admins). Placa, forma con dibujo
  (Cuadrado / Cóncavo), medidas A1…A5 y B2 en metros, resumen en vivo y «Quiero N m³ →
  altura de despacho».
- La forma con dibujo es `x-cards` (13/11): una elección de 2 a 6 opciones con `x-thumb`
  se dibuja como tarjetas de un toque y, debajo, la figura de la elegida.
- La tarjeta `flota.cubicaje` llega al canal (#planta) con «Ver certificado».
- Un admin del canal o del espacio borra para todos la tarjeta de una app
  (`appMessageByAdmin`, `chatService.deleteMessage`), porque la app no puede borrar lo
  que publicó.

### Cubicaje en el detalle del servicio (Portal)

- La ficha del despacho dice «Ver cubicaje · 23.21 m³ · Cóncavo» plegado; fotos y
  videos van primero (31/10). Bloque `cubicage` («Volquete cubica», forma y medidas).
  Dos decimales (30/10).

### Superficies

- **Web/PWA:** `web/src/chat/commands/*` (`AppFormDialog.tsx`, `RichChoiceFields.tsx`,
  `ListField.tsx`, `PhotoListField.tsx`), `web/src/chat/botBlocks/*`, cámara `WebCamera`.
- **APK:** `app/src/chat/commands/*` (`PhotoListField.tsx`), `app/src/chat/botBlocks/*`
  (`BlockTank.tsx`, `BlockChart.tsx`), cámara `FormCamera`.
- **Server:** rutas de comandos y formularios en `server/src/bots/botUserRoutes.ts`
  (`/commands`, `/shortcuts`, `/form`, `/files`, `/place`, `/refresh`, `/preview`);
  `formPhotoPlaces.ts`, `photoStamp.ts`, `stampAsked.ts`.
- **Shared:** `botBlocks.ts`, `appForms.ts`, `appFormOptions.ts`, `appFormRows.ts`,
  `photoStamp.ts`, `timemarkStamp.ts`, `eliminarMensaje.ts`, `accionesDeMensaje.ts`.

## 3. Diferencias APK vs web

| Tema | Web/PWA | APK |
| --- | --- | --- |
| Cámara del formulario | `WebCamera` (sello en vivo) | `FormCamera` (sello en vivo) |
| Galería | Fecha del archivo; el navegador no da lugar | EXIF del teléfono (`galleryPick.ts`) |
| Borrar tarjeta de app | Diálogo con «Eliminar para todos» si es admin del canal | Selección con los `appIds` del grupo si es admin |

## 4. Historia reciente

- **23/10** El tanque con su % y estado; marcar en un toque con la cámara en vivo.
- **24/10** Tocar un tanque abre su detalle; varias fotos por formulario, cámara trasera.
- **30/10** Formularios vivos del consumo (h-01…h-04). Cubicaje con dos decimales y fotos
  fechadas con la salida del despacho.
- **31/10** Cubicaje plegado en la ficha del despacho.
- **04–05/11** Delta del tanque notorio, como texto también en cero.
- **06/11** Fecha y hora en las fotos de formularios; galería con fecha, sin lugar.
- **12/11** Cámara con sello en toda el APK y la web del celular.
- **13/11** `x-cards` para cubicar; `photos` en `form.submitted`; galería acepta
  `inframaq.constroad.com`; cubicar probado en Test; un admin borra la tarjeta de una app.

## 5. Diseños de Stitch relacionados

| Diseño | Estado | Evidencia |
| --- | --- | --- |
| h-01…h-04 consumo | Implementado web y APK (según inventario) | `appFormOptions.ts`, `RichChoiceFields.tsx` |
| r155-asistencia-tanque, r155-tanques-detalle | Bloque tanque y su detalle implementados | `BlockTank.tsx` |
| pla-01 ⚡ de #planta | Generado; los grupos del ⚡ son genéricos. No auditado contra la captura | — |
| pla-02 cubicar | Implementado con `x-cards` | 7 referencias en código |
| pla-03 tarjeta del cubicaje | Cabe en el kit de tarjetas; no auditada | — |
| pla-04…pla-09 producción, bitácora, temperatura, incidencia, mezcla | **No implementados**; pla-04 se cortó, pla-05…09 «en generación» | sin referencia en código |

## 6. Pendientes y deuda conocida

- **Video en formularios:** no se acepta. Comprimir video exige un módulo nativo; video
  en tanque y materiales exige contrato con Agentes, Portal e Inframaq (según spec).
- **Sin verificar:** la marca sobre una foto real de teléfono (el emulador da una foto falsa).
- **Sin verificar en los clientes:** un owner o admin del espacio que no es admin del
  canal. El server lo deja borrar la tarjeta de una app; web y APK no le ofrecen la opción.
- **Sin E2E en vivo de `x-cards`** fuera del cubicar de Test (13/11).
- Las pantallas pla-04…pla-09 no existen.

## 7. Pruebas

- **Shared:** `botBlocks.test.ts`, `appFormOptions.test.ts`, `appForms.test.ts`,
  `appFormRows.test.ts`, `photoStamp.test.ts`, `eliminarMensaje.test.ts`.
- **Server:** `bots/formPhotoPlaces.test.ts`, `bots/botForms.test.ts`, `deleteAppCard.test.ts`.
- **Web:** `appFormDialog.consumption.test.tsx`, `appFormDialog.cards.test.tsx`,
  `photoListField.test.tsx`, `botBlocks/BotBlocks.test.tsx`,
  `chat/dialogoEliminar.appCard.test.tsx`.
- **Maestro:** sin flujo de tanques ni de cubicaje.
- **E2E:** cubicar en Test #planta (13/11, 23:14), con la tarjeta en el APK; Inframaq
  borró la unidad y el cubicaje de prueba.
