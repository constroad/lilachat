# Auditoría lv01 · Tarjeta de la visita

Stitch: `screens/d830679c9ffb4c72b4890930633d8321` (design/stitch/lv01-visita-chat.png).
Captura: design/stitch/impl/lv01-web-movil.jpg (móvil, 390 px)
Banco local con la tarjeta que arma el builder real de agentes (8223426). En producción se verificó en Test, VIS-2026-0072.
Revisor: subagente independiente (solo vio las dos imágenes). Las faltas que marcó se arreglaron y se recapturó.
Fecha: 2026-11-14 09:02 (APK; la web, 07:55)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Barra de acento | 3 pt | igual | igual |
| Radio de la tarjeta | 8–10 pt | 10 px (antes 20) | igual |
| Kicker | «VISITA TÉCNICA ·» en acento y el código en mono gris | igual (antes todo en acento, espaciado ancho) | igual |
| Estado | pastilla neutra, radio 6 | igual (antes lila y redonda) | igual |
| Título | 18 pt | 18 px | igual |
| Dirección | una línea con pin y «…» | igual (antes 2 líneas) | igual |
| Mapa | 123 pt, borde 1 px, radio 8 | 125 px, borde, radio 8 (antes 170, sin borde) | igual |
| Badge GPS | «● GPS ACTIVO · ±6 m» en mono | igual, abajo a la izquierda (a la derecha va la atribución de OSM) | igual |
| Marcadores | 20 pt, borde blanco, con nombre | 20 px, borde blanco, número o «F» | diferencia justificada: Portal no manda nombre por punto |
| Lugar | edificio con «ACCESO» | edificio con «LUGAR» al costado, sin tapar los puntos | igual |
| Línea de ruta | punteada fina | punteada fina (antes discontinua gruesa) | igual |
| Encuadre | los puntos llenan el mapa | zoom hasta 19; con puntos a pocos metros quedan juntos | diferencia justificada: depende de la distancia real |
| Cifras | fondo gris, radio 8, «6» grande y «de 10» chico en mono | igual (antes borde blanco, todo bold) | igual |
| Faltantes | al pie, con PENDIENTE | al pie, debajo de los botones (antes sobre los botones) | igual |
| Botones | rectángulo radio 8–10, 2×2 | radio 10, primario a lo ancho + 2×2 (5 botones, el 5.º es Abrir croquis) | diferencia justificada: José pidió el croquis en la tarjeta |
| «Abrir croquis» | — | una línea (antes partía en dos) | igual |
| Íconos | cámara, lista, cámara+, check | cámara, lista, imagen+, check, mapa | diferencia justificada: el set de íconos no tiene cámara+ |
| Pie «Actualizada por …» | no tiene | con la hora | diferencia justificada: la tarjeta se redibuja y la hora dice cuándo |

Segunda revisión (mismo revisor, solo imágenes): quedaban la etiqueta del lugar sobre los puntos (pasó al lado del edificio), el ícono de Entrevista (ahora lista con check), el título (18 px) y el tamaño de los marcadores (medidos en el DOM: 20 px; la estimación salió de la imagen reducida). «Foto suelta» sigue con imagen+: el set de íconos no tiene cámara+ (diferencia justificada).

## APK (React Native) — revisión de código, 2026-11-14

Revisor: subagente independiente. Comparó el código del APK con design/stitch/lv01-visita-chat.png y con la web ya aprobada.
Aún no hay capturas del emulador: esta ronda es solo de código. Las medidas salen de las clases (NativeWind con `inlineRem: 16`).
Ojo con los radios: en `app/tailwind.config.js` `rounded-lg` vale 16 px y `rounded-xl` 24 px (tokens de la casa), no 8 y 12.
2026-11-14 09:00

| Elemento | Mockup | APK | Veredicto |
| --- | --- | --- | --- |
| Kicker | «VISITA TÉCNICA ·» en acento, código en mono gris, una línea | 11 px bold, tracking 1 px, acento; código gris con `MONO_FONT` (monospace en Android, Menlo en iOS) desde 5dde714b; una línea con «…» (`VisitCardBlocks.tsx:15-16`) | ✓ igual |
| Estado | pastilla neutra, radio ~6, mayúsculas | `rounded-md` (6 px), borde outline/30, fondo background, 10 px bold (`BotCardView.tsx:69-72`) | ✓ igual |
| Título | 18 pt bold | 18 px bold, interlínea 24 (`BotCardView.tsx:75`) | ✓ igual |
| Dirección | pin en acento + una línea con «…» | MapPin 15 en acento, 13 px, `numberOfLines={1}` (`VisitCardBlocks.tsx:21-28`) | ✓ igual |
| Mapa: marco | ~123 pt, borde 1 px, radio 8 | alto 125, borde outline/20, `rounded-[8px]` desde 5dde714b (`VisitMap.tsx:68`) | ✓ igual |
| Mapa: lugar | edificio en acento con «ACCESO» | Building2 13 en círculo de 24, borde blanco, «LUGAR» 9 px al costado (`VisitMap.tsx:16-24`) | ≈ «LUGAR» en vez de «ACCESO», igual que la web |
| Mapa: puntos numerados | 20 pt, verdes, borde blanco, nombre debajo; línea punteada fina | 20 px, acento, borde blanco, «1»/«2»/«F» dentro; línea 2 px `1 5` redonda (`VisitMap.tsx:27-33, 48`) | ≈ sin nombre (agentes no lo manda); acento en vez de verde, igual que la web |
| Mapa: GPS | «● GPS ACTIVO · ±6 m» en mono, abajo a la derecha | punto en-linea + texto 10 px con `MONO_FONT` desde 5dde714b, abajo a la izquierda (`VisitMap.tsx:54-58`) | ≈ mono corregido; la posición a la izquierda es la única diferencia (OSM va a la derecha) |
| Cifras | fila gris, radio 8, divisores finos, «6» grande y «de 10» chico en mono, Puntos en acento | fondo surface-variant/60, `rounded-[8px]`, divisores a todo el alto, valor 20 px, «de 10» 13 px con `MONO_FONT`, Puntos en acento (`VisitCardBlocks.tsx:48-69`, 5dde714b) | ≈ radio y mono corregidos; solo quedan los divisores a todo el alto |
| Botones 2×2 con ícono | 56 pt, radio ~10, ícono a la izquierda; la etiqueta parte en dos líneas si no entra («MARCAR / PUNTO») | 56 px, radio 10, ícono 20, 13 px bold mayúsculas, ancho 48,5 % (`VisitCardButtons.tsx:37-39`). Etiqueta con `shrink text-center` y `numberOfLines={2}` desde 5dde714b: parte en dos líneas como «MARCAR / PUNTO». Íconos: cámara, lista con check, imagen+, check, mapa | ✓ igual; íconos ≈ (imagen+ por cámara+, como la web) |
| Primaria | relleno de acento, ícono y texto en on-primary | `bg-primary`, ícono y texto on-primary; con 5 botones va a lo ancho (`VisitCardButtons.tsx:35-38`) | ≈ a lo ancho por el 5.º botón (croquis), igual que la web |
| Terminar en verde | borde neutro, check verde, texto oscuro | CircleCheck en `en-linea`, texto on-surface, borde outline/25 (`VisitCardButtons.tsx:18`) | ✓ igual |
| «Falta» + PENDIENTE | al pie, línea arriba, ícono naranja, pastilla amarilla | después de los botones, `border-t`, ClipboardList 16 en warning, 13 px, pastilla `rounded-md` warning/10 (`VisitCardBlocks.tsx:32-44`, `BotCardView.tsx:224`) | ✓ igual (portapapeles sin reloj, como la web) |
| Pie «Actualizada por … · hora» | no tiene | `withUpdateInFooter` une pie y hora, 12 px, `border-t`, antes de los botones (`BotCardView.tsx:82, 220`) | ≈ como la web; deja dos líneas seguidas (pie y grilla) que el mockup no tiene |
| Esquinas/borde | radio ~10, borde 1 px, barra de acento 3 pt | `rounded-[10px]`, borde outline/15, barra 3 px `primary-brand`, `overflow-hidden` (`BotCardView.tsx:193-194`) | ✓ igual |

Orden: kicker → título → dirección → mapa → cifras → (pie) → botones → «Falta». Coincide con el mockup salvo el pie, que es ≈.

### Faltas (✗) de la primera lectura, corregidas en 5dde714b

1. `app/src/spaces/visits/VisitMap.tsx:67`: `rounded-lg` es 16 px en esta app. Cambiar a `rounded-[8px]`, como `web/src/chat/botBlocks/RouteMapWeb.tsx:48`.
2. `app/src/spaces/visits/VisitCardBlocks.tsx:59`: igual, `rounded-lg` → `rounded-[8px]`, como `web/src/spaces/visits/VisitCardBlocks.tsx:41`.
3. `app/src/spaces/visits/VisitCardButtons.tsx:39`: la etiqueta no encoge. Darle `shrink text-center` y `numberOfLines={2}`, como el mockup («MARCAR / PUNTO»).
4. `font-mono` en Android: `VisitCardBlocks.tsx:15` (código del kicker), `VisitCardBlocks.tsx:51` («de 10») y `VisitMap.tsx:55` (GPS). NativeWind lo traduce a `fontFamily: "mono"` en Android (`app/node_modules/nativewind/dist/tailwind/native.js:172`). El resto de la app usa `Platform.select({ android: 'monospace', ios: 'Menlo' })` (`app/src/chat/commands/CommandPanel.tsx:9`, `app/src/spaces/clients/reports/ReportUnitsView.tsx:10`). Usar esa constante por `style`. Confirmarlo en la captura.

Segunda lectura del código: 2026-11-14 09:02, correcciones de 5dde714b verificadas.
Fuera de la tarjeta queda `font-mono` en la pantalla de la visita (`VisitScreen.tsx:165`, `MarkPointSheet.tsx:53`), con el mismo problema en Android.

Pendiente: segunda revisión sobre capturas del emulador.
