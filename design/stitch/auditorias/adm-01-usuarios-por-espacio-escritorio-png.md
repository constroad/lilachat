# Auditoría adm-01 · Usuarios por espacio, con la vista «Denuncias» (19/11)

Reauditoría pedida por el gate `stitch-fidelity` porque `web/src/admin/AdminUsersScreen.tsx` cambió: el segmentado
suma «Denuncias» (cola de denuncias, Google Play, José 19/11). Auditoría anterior y sus justificaciones:
`design/stitch/auditorias/adm-01-usuarios-por-espacio.md`.

Stitch: `screens/ae2e01e71109468a8fbc92a2b63393b3` (escritorio, design/stitch/adm-01-usuarios-por-espacio-escritorio.png)
y `screens/c510471dda784b1b861a3b95596f4df7` (móvil, design/stitch/adm-01-usuarios-por-espacio-movil.png).
Captura: design/stitch/capturas/adm-01-impl-escritorio-1911.jpg (escritorio, 1440 px, tema oscuro, web local con la API de producción)
Captura: design/stitch/capturas/adm-01-impl-movil-1911.jpg (móvil, 390 px, tema oscuro)
Revisor: subagente independiente (solo vio las cuatro imágenes; no leyó código).
Fecha: 2026-11-19 20:35

Veredicto del revisor: pasa con observaciones. El tema oscuro y los logos reales de los espacios son datos y tema, no forma.

## Escritorio

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera | flecha en círculo, «Volver a los chats», logo en cuadro violeta, pastilla SUPERADMIN, avatar JZ | flecha, «Volver a los chats», logo de la app; sin pastilla ni avatar | diferencia justificada: pastilla y avatar inventados por Stitch (INVENTARIO); el logo es el de la app |
| Kicker y título | «SUPERADMIN», «Usuarios de Lilachat», subtítulo | igual, mismo texto | igual |
| Segmentado | Por espacio · Todas las personas | Por espacio · Todas las personas · Denuncias | diferencia justificada: «Denuncias» es la cola que exige Google Play (José 19/11); misma pieza, una opción más |
| Franja de cifras | 4 celdas con divisores | igual | igual |
| Buscador | lupa, placeholder, atajo ⌘K | lupa y placeholder, sin ⌘K | diferencia justificada: ⌘K inventado por Stitch (INVENTARIO) |
| Columna ESPACIOS | tarjeta, «Todos los espacios» activo con borde, espacios con iniciales, «Sin espacio» punteado, nota | igual, con el logo real de cada espacio | diferencia justificada: reuse de `SpaceLogo`; el mockup no tenía logos |
| Tarjeta de espacio | avatar, nombre, «N miembros · N activos hoy» en mono, «Contraer» | igual | igual |
| Tabla de personas | 7 columnas, chips, pastillas de rol, check de correo | igual; filas más altas cuando el nombre parte en dos líneas | diferencia justificada: nombres reales más largos que los del mockup |
| Tipografía y espaciados | jerarquía y monoespaciadas | igual, algo más compacta | igual |
| Acento | violeta | lila del tema oscuro | diferencia justificada: tokens de la app en tema oscuro |

## Móvil

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera | flecha, logo en cuadro, pastilla SUPERADMIN | flecha y logo de la app | diferencia justificada: pastilla inventada por Stitch |
| Subtítulo | corto | el de escritorio, en dos líneas | diferencia justificada: un solo texto para los dos tamaños (auditoría anterior) |
| Segmentado | no aparece | a lo ancho, con «Denuncias»; «Todas las personas» parte en dos líneas | diferencia justificada: sin él las otras vistas no se alcanzan en el teléfono; «Denuncias» por Google Play |
| Cifras | 2×2 | 2×2; «NUEVAS ESTA SEMANA» en dos líneas | diferencia justificada: la etiqueta real es más larga a 390 px |
| Buscador | lupa, placeholder | igual | igual |
| Chips de espacios | fila con scroll, «Todos N» lleno | igual, con logos | igual |
| Tarjeta de espacio | avatar, nombre, conteos, chevron | igual | igual |
| Persona como tarjeta | iniciales, chip «También en» al pie | foto o círculo, chip bajo el teléfono, «Correo ·» con etiqueta | diferencia justificada: chip debajo del nombre pedido por José (auditoría anterior); datos con etiqueta |
| Acento | violeta | lila del tema oscuro | diferencia justificada: tema oscuro |

## Sin verificar en estas capturas

Pie «Ver los N de…», estado contraído, «Sin espacio», paginación y vacío: sin cambios de código desde la auditoría anterior.
La vista «Denuncias» en sí no tiene diseño de Stitch (PLAY-STORE.spec §5); se verifica en el E2E después del deploy.
