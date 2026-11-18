# Auditoría nl-03 · Mover de categoría

Stitch: design/stitch/notas/nl-03-mover-de-categoria-movil.stitch.png (móvil) · Huella: fda135403ed9
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/web-nl03-mobile.png (móvil, web) · Huella: 383731cc2224
Banco local: server del worktree en qa.localhost:4013; la hoja se abrió con la pastilla de categoría del primer enlace.
Revisor: subagente independiente (solo vio las dos imágenes).
Fecha: 2026-11-18 09:40 (código web en 3d7db1b2)

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
