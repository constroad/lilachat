# Auditoría nl-03 · Mover de categoría

Stitch: design/stitch/notas/nl-03-mover-de-categoria-movil.stitch.png (móvil) · Huella: fda135403ed9
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/web-nl03-mobile.png (móvil, web) · Huella: 383731cc2224
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/apk-nl03-movil-390.png (móvil, APK: captura de 1080 px a 420 dpi reducida a 390 px) · Huella: a528c83dddb1
Banco local: server del worktree en qa.localhost:4013; la hoja se abrió con la pastilla de categoría del primer enlace.
Revisor: subagente independiente (solo vio las dos imágenes; el APK, dos pasadas).
Fecha: 2026-11-18 10:02 (web en 34d6f0bb y ee48b291; APK en 81b1a70f, 88072765 y 6a147e4b)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Hoja inferior sobre el fondo oscurecido | sí | igual | igual |
| Kicker «MOVER A» + título | sí | igual | igual |
| Mini tarjeta del enlace | miniatura, autor, pastilla y 2 líneas | igual | igual |
| «La eligió Lila al guardarlo. Tú decides.» | sí | igual | igual |
| Opciones con botón de opción, nombre y conteo; la actual marcada en el acento con «CATEGORÍA ACTUAL» | sí | igual | igual |
| «Nueva categoría» | sí | igual | igual: design/stitch/INVENTARIO.md, fila nl-03, la lista |
| Botón «Mover» a todo el ancho | sólido | tenue con la actual elegida | igual: es el estado deshabilitado, no la composición |
| Tirador, X con relleno, sin separador | sí | sin tirador, X sin relleno, separador bajo el título | diferencia justificada: primitiva de hoja de toda la web (web/src/ui/Overlay.tsx) |
| Hoja · radio superior | 24 px | 16 px | diferencia justificada: `rounded-t-2xl` de la primitiva de hoja (web/src/ui/Overlay.tsx:52) |
| Fila de categoría · alto | 56 px | 56 px | igual |
| Fila de categoría · radio | 12 px | 12 px | igual |
| Fila de categoría · padding | 14 px | 16 px | diferencia justificada: `px-4` de las filas de las hojas de la web (web/src/chat/links/MoveLinkSheet.tsx) |
| Botón «Mover» · alto | 56 px | 56 px | igual |
| Botón «Mover» · radio | 12 px | 12 px | igual |
| APK · hoja con tirador, «MOVER A», título y cerrar en círculo | sí | igual | igual |
| APK · mini tarjeta, nota de Lila, opciones con conteo y «CATEGORÍA ACTUAL» | sí | igual | igual |
| APK · fila elegida | riel izquierdo, fondo tenue y acento | igual | igual |
| APK · título de la mini tarjeta | autor corto entero | título largo con «…» junto a la pastilla | diferencia justificada: la pastilla nunca se corta y se acorta el título (81b1a70f, app/src/chat/links/LinkCardParts.tsx) |
| APK · «Nueva categoría» | sí | igual | igual: design/stitch/INVENTARIO.md, fila nl-03, la lista |
| APK · fondo de la hoja | oscurecido y desenfocado | oscurecido | diferencia justificada: primitiva de hoja de la app (app/src/ui/Sheet.tsx) |
| APK · fila de categoría · alto | 56 px | 55 px (dp, \`min-h-[56px]\`) | igual |
| APK · fila de categoría · radio | 12 px | 12 px (dp) | igual |
| APK · botón «Mover» · alto | 56 px | 56 px (dp, \`min-h-[56px]\`) | igual |
| APK · márgenes laterales | 22 px | 16 px (dp, \`px-4\`) | diferencia justificada: margen de las hojas de la app (app/src/ui/Sheet.tsx) |

APK: primera pasada (pastilla cortada, sin riel) corregida en 81b1a70f.
