# Auditoría nl-01 · Enlaces por categoría

Stitch: design/stitch/notas/nl-01-por-categoria-escritorio.stitch.png (escritorio) · Huella: a85c6f1cbfb0
Stitch: design/stitch/notas/nl-01-por-categoria-movil.stitch.png (móvil) · Huella: f15283f99184
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/web-nl01-desktop.png (escritorio, web) · Huella: 853b4e386542
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/web-nl01-mobile.png (móvil, web) · Huella: f76ae98910c5
Banco local: server del worktree en qa.localhost:4013 con Mongo de prueba y un doble del clasificador; chat «QA-NOTAS IA links» con 4 enlaces reales.
Revisor: subagente independiente (solo vio las dos imágenes de cada dispositivo).
Fecha: 2026-11-18 09:40 (código web en 34d6f0bb y ee48b291)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Escritorio · layout | lista de chats / columna de categorías / contenido | igual | igual |
| Escritorio · columna de categorías | fila activa con fondo tenue y riel de 3 px, conteo a la derecha | igual | igual |
| Escritorio · bloque «REVISIÓN» | abajo, con badges de color | igual | igual |
| Escritorio · buscador + orden | campo + desplegable | campo + desplegable «Más nuevos» | igual |
| Escritorio · título de la categoría | kicker «CATEGORÍA · N ENLACES», título, «Renombrar» y «Unir con…» | igual (captura con «Fuera de tema» elegida) | igual |
| Escritorio · grilla | 3 columnas | 3 columnas desde 1280 px; la categoría de QA tiene 2 enlaces y la tercera queda vacía | diferencia justificada: son los datos; `grid-cols-2 xl:grid-cols-3` en web/src/chat/links/CategoryLayouts.tsx:124 |
| Escritorio · etiqueta de tipo sobre la miniatura | «VIDEO», «REEL» sobre la imagen | no está | diferencia justificada: design/stitch/INVENTARIO.md, fila nl-01 escritorio la marca «no va» (repite la pastilla) |
| Escritorio · play | círculo blanco | círculo oscuro translúcido | diferencia justificada: va sobre la foto real del enlace, Stitch lo dibujó sobre un liso (web/src/chat/links/linkCardParts.tsx) |
| Escritorio · cabecera | chip «SOLO TÚ», «Notas · N enlaces», lupa y ⋮ | «Solo tú lo ves», lupa, sin ⋮ | diferencia justificada: cabecera compartida de toda conversación (web/src/chat/Conversation.tsx); el menú del chat vive en el detalle, Ajustes (web/src/chat/info/LinkSortingRow.tsx); la lista no trae el conteo de enlaces (server/src/listaDeChats.ts solo manda linksSorted) |
| Escritorio · segmentado | activo subrayado | activo en pastilla blanca | diferencia justificada: el mismo control que nl-01 móvil dibuja con pastilla blanca, uno solo para los dos (web/src/chat/links/NotesViewSwitch.tsx) |
| Escritorio · panel de chats | «Chats» con «Personal» | selector, íconos y chips de filtro; el último chip se corta | diferencia justificada: panel de la lista de chats existente, fuera de este cambio (web/src/chat/FiltrosDeLaLista.tsx) |
| Móvil · segmentado, buscador, chips con scroll y secciones «NOMBRE · N» | sí | igual | igual |
| Móvil · ícono de filtros en el buscador | sí | no está | diferencia justificada: design/stitch/INVENTARIO.md, fila nl-01 móvil la marca «no va» |
| Móvil · cabecera | lupa, ⋮ y avatar | sin los tres | diferencia justificada: el avatar «no va» (INVENTARIO.md, fila nl-01 móvil); cabecera compartida (web/src/chat/Conversation.tsx) y la búsqueda es el buscador de la vista |
| Móvil · «Ver las N →» | en cada sección | no se ve | diferencia justificada: aparece con más de 3 enlaces y las secciones de QA tienen 2 (`SECTION_PREVIEW = 3`, web/src/chat/links/categoryViewModel.ts:9 y CategoryLayouts.tsx:158) |
| Móvil · ⋮ en cada fila | no tiene | tiene | diferencia justificada: «Mover», «Abrir» y «Copiar enlace»; copiar solo está ahí (specs/as-is/chat-notas.md §2, Tarjetas) |
| Móvil · autor | una línea | una línea con «…» (el ⋮ le quita ancho) | diferencia justificada: mismo ⋮ de la fila anterior; Stitch también lo deja en una línea |
| Móvil · «+» sobre la última fila | no tapa | tapa a mitad del scroll; al final no | diferencia justificada: la lista deja 96 px abajo (`pb-24`, web/src/chat/links/LinksByCategory.tsx:62) |
| Móvil · pastilla de plataforma | fondo oscuro | fondo tenue | diferencia justificada: la misma pastilla que nl-02, una sola (web/src/chat/links/linkCardParts.tsx:41) |
| Escritorio · tarjeta · radio | 12 px | 12 px | igual |
| Escritorio · tarjeta · borde | 1.5 px | 1 px | diferencia justificada: el borde de la casa es 1 px (`border border-outline/…` en 202 archivos de web/src; 1.5 px en 13) |
| Escritorio · tarjeta · padding | 12 px | 12 px | igual |
| Escritorio · grilla · gap | 20 px | 20 px | igual |
| Escritorio · miniatura · alto | 180 px | 176 px | diferencia justificada: escala de Tailwind `h-44` (web/src/chat/links/LinkNoteCards.tsx:63) |
| Escritorio · miniatura · radio | 8 px | 8 px | igual |
| Escritorio · fila de categoría · alto | 36 px | 36 px | igual |
| Escritorio · fila de categoría · radio | 8 px | 8 px | igual |
| Escritorio · fila de categoría · padding | 12 px | 12 px | igual |
| Escritorio · fila de categoría · tamaño de texto | 13 px | 13 px | igual |
| Escritorio · fila activa · riel | 3 px | 3 px | igual |
| Escritorio · fila activa · borde | 1 px | 0 px | diferencia justificada: la activa se marca con fondo y riel, sin borde (web/src/chat/links/CategoryLayouts.tsx:27) |
| Móvil · buscador · alto | 50 px | 54 px | diferencia justificada: borde de 1 px de la casa arriba y abajo y la línea de ayuda a 16 px (CategoryLayouts.tsx) |
| Móvil · buscador · radio | 12 px | 12 px | igual |
| Móvil · buscador · borde | 0 px | 1 px | diferencia justificada: borde de la casa de 1 px (202 archivos de web/src) |
| Móvil · chip · alto | 36 px | 36 px | igual |
| Móvil · chip · radio | 12 px | 12 px | igual |
| Móvil · chip · padding | 16 px | 16 px | igual |
| Móvil · chip · tamaño de texto | 14 px | 14 px | igual |
| Móvil · chip · borde | 0 px | 1 px | diferencia justificada: borde de la casa de 1 px (202 archivos de web/src) |
| Móvil · tarjeta de fila · alto | 107 px | 118 px | diferencia justificada: dos líneas de descripción a 20 px de interlínea (`leading-5`, web/src/chat/links/LinkNoteCards.tsx:115) |
| Móvil · tarjeta de fila · radio | 12 px | 12 px | igual |
| Móvil · tarjeta de fila · padding | 16 px | 16 px | igual |
| Móvil · miniatura · alto | 75 px | 75 px | igual |
| Móvil · miniatura · radio | 8 px | 8 px | igual |
| Móvil · segmentado · alto | 44 px | 46 px | diferencia justificada: borde de la casa de 1 px arriba y abajo (202 archivos de web/src) |
| Móvil · segmentado · radio | 12 px | 12 px | igual |
| Móvil · segmento · alto | 36 px | 36 px | igual |
| Móvil · segmento · radio | 8 px | 8 px | igual |

Primera revisión (radios al doble de Stitch) corregida con los tokens `card` 12 y `thumb` 8 (shared/src/tokens.ts). Segunda: el autor largo se salía de la tarjeta de la grilla; corregido en 34d6f0bb.
