# Auditoría nl-02 · Tarjeta del enlace en el chat

Stitch: design/stitch/notas/nl-02-tarjeta-en-el-chat-movil.stitch.png (móvil) · Huella: 09212aa82332
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/web-nl02-mobile.png (móvil, web) · Huella: c47a27604f3f
Captura: /private/tmp/claude-501/-Users-josezamora-projects-Portal/21b9fcc4-f3e2-404f-8d05-37dd93bfbcaa/scratchpad/e2e/apk-nl02-movil-390.png (móvil, APK: captura de 1080 px a 420 dpi reducida a 390 px) · Huella: a2ce5621aaa2
Banco local: server del worktree en qa.localhost:4013, chat «QA-NOTAS IA links» con 4 enlaces reales y una nota.
Revisor: subagente independiente (solo vio las dos imágenes; el APK, dos pasadas).
Fecha: 2026-11-18 10:02 (web en 34d6f0bb y ee48b291; APK en 81b1a70f, 88072765 y 6a147e4b)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Segmentado «Chat · Por categoría» | arriba, «Chat» activo | igual | igual |
| Burbuja con tarjeta blanca dentro | sí | igual | igual |
| Pastilla de categoría con lápiz | abajo, dentro de la burbuja | igual | igual |
| «SOLO PIDE COMENTAR» | bajo el autor | bajo el autor (corregido en ee48b291) | igual |
| «NO SE PUDO LEER» + «Reintentar» | en una fila | en dos filas | diferencia justificada: la columna de texto mide 194 px (tarjeta 298 − miniatura 72 − gap 12 − padding 20) y las dos no caben; `flex-wrap` en web/src/chat/links/StoredLinkInBubble.tsx |
| Hora en cada burbuja | sí | solo en la última del grupo | diferencia justificada: regla de agrupado de toda conversación (`ultimoDelGrupo`, web/src/chat/ListaDeMensajes.tsx:136) |
| Doble check | sí | no | diferencia justificada: design/stitch/INVENTARIO.md, fila nl-02: «Los dobles checks no van en un chat de notas» |
| Nota suelta con «Sin categoría» | sí | burbuja de texto sin pastilla | diferencia justificada: José 18/11, solo se ordenan los enlaces (`storedLinkOf` exige `message.link`, StoredLinkInBubble.tsx:16) |
| Cabecera | lupa, ⋮ y avatar | sin los tres | diferencia justificada: cabecera compartida de toda conversación (web/src/chat/Conversation.tsx); el menú del chat vive en el detalle (web/src/chat/info/LinkSortingRow.tsx) |
| Separador de día | línea con «HOY» | pastilla «Hoy» | diferencia justificada: separador de toda conversación (shared/src/chatDisplay.ts:49) |
| Compositor | emoji, «Pega un enlace…», clip, cámara | «+», «Escribe un mensaje…», emoji, micrófono | diferencia justificada: compositor compartido de todos los chats (web/src/chat/Composer.tsx) |
| Autor | una línea entera | una línea con «…» | diferencia justificada: la burbuja mide 322 px y no 358 (fila «Burbuja · ancho»); va en una línea con `truncate` como en Stitch (web/src/chat/links/StoredLinkInBubble.tsx) |
| Burbuja · ancho | 358 px | 322 px | diferencia justificada: a su lado van apiladas las acciones al pasar el mouse (reaccionar, hilo, ⋮) de todo mensaje, 32 px + 4 de gap (web/src/chat/BurbujaDeMensaje.tsx) |
| Burbuja · radio | 16 px | 24 px | diferencia justificada: radio de toda burbuja (`rounded-xl` = `radius.xl` 24 en shared/src/tokens.ts; web/src/chat/BurbujaDeMensaje.tsx:90) |
| Burbuja · padding | 10 px | 8 px / 12 px | diferencia justificada: padding de toda burbuja (`px-3 py-2`, web/src/chat/BurbujaDeMensaje.tsx:90) |
| Tarjeta interior · radio | 12 px | 12 px | igual |
| Tarjeta interior · padding | 10 px | 10 px | igual |
| Tarjeta interior · gap | 10 px | 12 px | diferencia justificada: `gap-3` de todas las tarjetas de enlace de la web (LinkNoteCards.tsx, MoveLinkSheet.tsx, StoredLinkInBubble.tsx) |
| Miniatura · alto | 96 px | 96 px | igual |
| Miniatura · radio | 8 px | 8 px | igual |
| Pastilla de categoría · alto | 28 px | 28 px | igual |
| APK · control «Chat · Por categoría» | riel tintado, segmento activo blanco, sin íconos | riel blanco con borde, activo lavanda, con íconos | diferencia justificada: primitiva compartida de la app (app/src/ui/Segmentado.tsx, en 15 pantallas) |
| APK · cabecera | ícono violeta sólido, lupa, ⋮ y avatar | ícono del chat de notas y ⋮ | diferencia justificada: cabecera compartida de la conversación (app/src/chat/ChatScreen.tsx); el avatar «no va» (design/stitch/INVENTARIO.md, fila nl-01 móvil) |
| APK · burbuja con tarjeta blanca y pastilla de categoría con lápiz | sí | igual | igual |
| APK · «SOLO PIDE COMENTAR» | bajo el autor, tinte azul | bajo el autor, tinte ocre | diferencia justificada: tono «pendiente» de la casa, \`warning\` (shared/src/tokens.ts:75) |
| APK · tarjeta ilegible | el error como título, chips en una fila | título y motivo, chips debajo | diferencia justificada: \`cardLinesOf\` arma título y cuerpo igual para todas (app/src/chat/links/linkView.ts) |
| APK · compositor | «Pega un enlace o escribe una nota» y enviar | «Mensaje» y micrófono | diferencia justificada: compositor compartido (app/src/chat/Composer.tsx) |
| APK · burbuja · ancho | 358 px | 366 px (dp, fila entera) | diferencia justificada: margen de la lista de 12 dp (\`paddingHorizontal: 12\`, app/src/chat/ListaDeMensajes.tsx:209) |
| APK · separación entre burbujas | 16 px | 2 px (dp) | diferencia justificada: mensajes seguidos del mismo autor se agrupan (\`grouped ? 'pt-0.5' : 'pt-3'\`, app/src/chat/MessageRow.tsx:253) |
| APK · tarjeta interior · margen | 10 px | 6 px (dp, \`m-1.5\`) | diferencia justificada: la burbuja no tiene padding y la tarjeta lleva su margen (app/src/chat/links/NoteLinkBubble.tsx) |
| APK · tarjeta interior · radio | 12 px | 12 px (dp) | igual |
| APK · miniatura · ancho | 72 px | 72 px (dp) | igual |
| APK · miniatura · alto | 96 px | 96 px (dp) | igual |

Primera revisión: la burbuja medía 261 px y cortaba la pastilla de plataforma y «Solo pide comentar» (las tres acciones ocultas ocupaban 97 px). Corregido en 3d7db1b2 y 34d6f0bb.

APK: primera pasada (burbuja al 80 %, título y pastilla cortados) corregida en 81b1a70f; segunda (portada de 64 dp) en 6a147e4b.
