# Auditoría adm-01 · Usuarios por espacio (panel del superadmin)

Stitch: `screens/ae2e01e71109468a8fbc92a2b63393b3` (escritorio, design/stitch/adm-01-usuarios-por-espacio-escritorio.png)
y `screens/c510471dda784b1b861a3b95596f4df7` (móvil, design/stitch/adm-01-usuarios-por-espacio-movil.png).
Código: `web/src/admin/AdminUsersScreen.tsx`, `web/src/admin/AdminSpacesView.tsx`, `web/src/admin/AdminParts.tsx`.
Captura de la implementación: **pendiente**. Esta primera lectura es solo de código (sin navegador ni dev server en esta
tarea). Falta capturar `/admin` a 1440 px y a 390 px y que un revisor independiente compare captura contra mockup.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-14 16:23 (revisión independiente sobre capturas de producción; código d14c8ac9)

## Escritorio

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera fija | flecha en círculo + «Volver a los chats», divisor, logo y «Lilachat» | igual: `admin-volver` con flecha y texto desde `md`, divisor de 24 px, logo 24 | igual |
| Pastilla «SUPERADMIN» y avatar «JZ» en la cabecera | sí | no van | fuera (inventado por Stitch, INVENTARIO) |
| Kicker | «SUPERADMIN» en acento | igual, `text-primary` | igual |
| Título y subtítulo | «Usuarios de Lilachat»; «Quién está, en qué espacio y desde cuándo. Sin chats ni mensajes.» | igual; 30 px desde `md` | igual |
| Segmentado | a la derecha del título: «Por espacio» relleno de acento · «Todas las personas» | igual, en un grupo con borde; «Todas las personas» es la lista plana de antes | igual |
| Franja de cifras | 4 en fila con divisores | la de antes (`admin-total-*`), sin cambios | igual |
| Buscador | a lo ancho, lupa, placeholder | igual, 48 px de alto (antes 44) | igual |
| Atajo ⌘K | sí | no va | fuera (inventado por Stitch) |
| Columna «ESPACIOS» | 280 px, tarjeta: «Todos los espacios» con ícono de edificio, cada espacio con su cuadrado y conteo, divisor, «Sin espacio» con cuadrado punteado | igual desde `lg` (1024 px): `lg:grid-cols-[280px_…]`, `SpaceLogo` de 28, divisor, cuadrado punteado con «–» | igual |
| Seleccionado en la columna | fondo tenue, borde izquierdo de acento, texto en acento, conteo en pastilla | fondo `primary/10`, borde izquierdo de 4 px, texto en acento; conteo sin pastilla | ≈ el conteo va como texto, igual que en las otras filas |
| Nota bajo la columna | «Una persona en varios espacios aparece en cada uno.» | igual | igual |
| Tarjeta de espacio: cabecera | cuadrado 44 con iniciales, nombre, «23 miembros · 9 activos hoy» en mono, «Contraer ˄» con borde | igual (`SpaceLogo` 44, línea en mono desde `md`; en el teléfono sin mono, como el mockup móvil; botón con borde) | igual |
| Contraído | solo la cabecera, «Expandir ˅» | igual (estado por tarjeta, en memoria) | igual |
| Cabecera de tabla | PERSONA · ROL · CORREO · SE UNIÓ · ÚLTIMA VEZ · DISPOSITIVOS · LO INVITÓ | igual, mismas 7 columnas | igual |
| Persona | avatar con iniciales, nombre, teléfono en mono | igual (`Avatar` y `formatPhoneDisplay` de la lista plana) | igual |
| Chip «También en» | junto al nombre, truncado («También e…») | DEBAJO del teléfono, con el nombre de los espacios («También en ConstRoad y Test», «… y 2 más») | diferencia pedida (INVENTARIO: va debajo) |
| Pastilla de ROL | Dueño lila con borde, Admin y Miembro grises, Invitado ámbar | `RolePill` de la casa (`web/src/spaces/memberWeb.tsx`, diseños e1-09/e1-10): Dueño relleno de acento, Admin acento tenue, Miembro e Invitado neutros | diferencia justificada: reuse-first; el mismo rol se ve igual que en Miembros del espacio |
| «Oculto» | no está en el mockup | pastilla neutra junto al rol para el miembro incógnito | diferencia justificada: pedido de José (el superadmin ve a los ocultos, marcados) |
| Correo | texto truncado y check verde, o «(sin verificar)» | igual (`EmailValue` compartido con la lista plana) | igual |
| Se unió / Última vez / Dispositivos / Lo invitó | «21 oct. 2026», «hoy 7:31 a. m.», «1 Android · 1 web», nombre o «—» | igual, mismas funciones de `shared/adminUsers.ts` | igual |
| Pie de tarjeta | «Ver los 23 de Globofast ›» en acento | igual; solo cuando hay más miembros que los 4 mostrados; elige ese espacio en el filtro | igual |
| «Sin espacio» | tarjeta con borde punteado, ícono de persona tachada en cuadrado punteado, «28 personas que todavía no están en ningún espacio» | igual (`UserX` en cuadrado punteado); rol «—»; «Ver los 28 sin espacio ›» | igual |
| Paginación | «Mostrando 4 espacios · 96 personas», Anterior · 1 · 2 · Siguiente | mismo texto; botones ‹ › de 44 px del `Pager` de la lista plana (`admin-anterior`/`admin-siguiente`) | diferencia justificada: reuse del paginador existente y sus testids |
| Vacío | tarjeta «Nadie coincide con esa búsqueda.» + segunda línea | solo la primera línea (`admin-vacio`) | fuera la segunda línea (inventada por Stitch) |
| Ancho de página | ~1290 px de contenido | `max-w-7xl` (1280) | igual |

## Móvil (390 px)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera | flecha, logo, «Lilachat»; pastilla SUPERADMIN | flecha (sin texto), logo, «Lilachat»; sin pastilla | igual (pastilla fuera) |
| Subtítulo | «Quién está y en qué espacio. Sin chats ni mensajes.» | el de escritorio (una frase más larga) | ≈ un solo texto para los dos tamaños |
| Segmentado | no aparece | a lo ancho bajo el subtítulo | diferencia justificada: sin él, «Todas las personas» no se alcanza en el teléfono |
| Cifras | 2×2 | 2×2 (la de antes) | igual |
| Buscador | 48 px | 48 px | igual |
| Chips de espacios | «Todos 96» relleno, cada espacio con cuadrado + nombre + conteo; la fila scrollea sola | igual: `overflow-x-auto` en su propia fila (`-mx-4 px-4`), chips de 44 px, cuadrado 20; la página no scrollea en horizontal | igual |
| Cabecera de grupo | tarjeta con cuadrado, nombre, línea, chevron | igual; el botón muestra solo el chevron (texto para lectores) | igual |
| Persona como tarjeta | avatar, nombre, teléfono, ROL arriba a la derecha; línea; correo; «Se unió · … · Última vez · …»; «Dispositivos · … · Lo invitó · …»; chip «También en» al pie | avatar, nombre, teléfono, chip «También en» debajo del teléfono, ROL a la derecha; línea; correo; los cuatro datos en 2 columnas con su etiqueta | ≈ chip bajo el nombre (pedido); datos en rejilla de 2 en vez de frase corrida |

## Fuera y por qué

- Pastilla «SUPERADMIN» y avatar «JZ» de la cabecera, atajo ⌘K y segunda línea del vacío: inventos de Stitch (INVENTARIO).
- Paginación numerada (1 · 2): se reusa el paginador de la lista plana para no duplicar componente ni testids.

## Pendiente

- Captura real a 1440 px y 390 px (claro y oscuro) y revisión independiente contra las dos imágenes.

## Revisión independiente (capturas de producción)

Revisor: subagente independiente (no escribió el código). Comparó por composición las capturas de producción con los dos mockups.
Capturas: design/stitch/impl/adm-01-web-escritorio.png (1440 px, solo el primer pantallazo) y design/stitch/impl/adm-01-web-movil-433.png (433 px, tema oscuro).
Las fotos de perfil y los logos de espacio están ocultos a propósito. Los huecos de 44/28/20 px junto al nombre del espacio y el círculo vacío del avatar son eso, no faltas.
Los colores salen de los tokens de la app (tema oscuro), no de la paleta de Stitch.

### Escritorio

| # | Elemento | Mockup | Producción | Veredicto |
| --- | --- | --- | --- | --- |
| 1 | Orden de bloques | cabecera → kicker/título + segmentado → cifras → buscador → columna ESPACIOS + tarjetas | igual | OK |
| 2 | Cabecera fija | flecha en círculo + «Volver a los chats», divisor, logo, «Lilachat»; pastilla y avatar | flecha sin círculo, divisor, logo de la app; sin pastilla ni avatar | OK (pastilla y avatar inventados); MINOR el círculo de la flecha |
| 3 | Segmentado | a la derecha del título, alineado | igual | OK |
| 4 | Franja de cifras | ~130 px de alto, cifras de ~36 px, mucho aire | ~80 px, cifras más chicas, padding corto | MINOR: proporción más apretada que el mockup (se reusó la de antes) |
| 5 | Buscador | lupa, placeholder, ⌘K | lupa y placeholder, sin ⌘K | OK |
| 6 | Columna ESPACIOS | 280 px; ícono de edificio; logo + nombre + conteo; divisor; «Sin espacio» punteado; nota debajo | igual (logos ocultos en la captura; «Test» muestra el cuadrado con iniciales) | OK |
| 7 | Seleccionado | fondo tenue, borde izquierdo, conteo en pastilla | fondo tenue, borde izquierdo, conteo como texto | MINOR (ya anotado ≈) |
| 8 | Cabecera de tarjeta | logo 44, nombre, «n miembros · n activos hoy» en mono, «Contraer ˄» con borde | igual (logo oculto) | OK |
| 9 | Cabecera de tabla | 7 columnas, cada título en una línea | 7 columnas; «ÚLTIMA / VEZ» parte en dos líneas por el tracking ancho y la columna angosta | **FIX** |
| 10 | Última vez | «hoy 7:31 a. m.» en una línea | «hoy 10:58 a. / m.»: corta «a. m.» en dos líneas en las 4 filas | **FIX** (ver nota de columnas) |
| 11 | Dispositivos | «1 Android · / 1 web» (corta en el separador) | «23 Android · 4 / web»: separa el número de su unidad | **FIX** (mismo origen) |
| 12 | Se unió | todas las filas en dos líneas, parejo | unas filas «20 ago. / 2026», otras «24 oct. 2026» en una: filas desparejas | MINOR (se arregla con el mismo ajuste) |
| 13 | Persona | nombre completo, teléfono en mono | nombres largos truncados («Wilson Zeña Za…», «Aracely Gomez …») | **FIX** (la columna Persona queda en ~140 px útiles) |
| 14 | Chip «También en» | junto al nombre, truncado | debajo del teléfono, pero también truncado: «También en Globofast, …» | **FIX**: INVENTARIO lo bajó justamente para que no se trunque; en el teléfono sí sale completo («… Inframaq y 1 más»). Debe partir línea o tener ancho |
| 15 | Pastilla de ROL | Dueño con borde, Admin gris | `RolePill` de la casa: Dueño relleno, Admin tenue | OK (reuse-first) |
| 16 | Correo | truncado + check verde | igual; la columna es más ancha que en el mockup (~174 px contra ~147) | OK (le sobra lo que le falta a Última vez) |
| 17 | Lo invitó | alineado a la derecha | alineado a la izquierda | MINOR |
| 18 | Pie de tarjeta | «Ver los 23 de Globofast ›» en acento | «Ver los 8 de Constroad ›» | OK |
| 19 | Ancho del contenido | ~1260 px | ~1248 px (`max-w-7xl` menos padding) | OK |
| 20 | «Sin espacio», «Expandir», paginación, vacío | en el mockup | fuera de la captura (solo el primer pantallazo) | no verificable: falta captura de la página completa |

Nota de columnas (#9–#14): en el mockup las columnas miden aprox. Persona 220, Rol 73, Correo 147, Se unió 74, Última vez 143, Dispositivos 116, Lo invitó 105 px.
`MEMBER_COLUMNS` (`web/src/admin/AdminSpacesView.tsx:30`) reparte 2.2/0.9/2/1/1/1.1/1 fr con `gap-4` y `px-6`: unos 87 px por fr.
Así Última vez y Dispositivos quedan en ~87–96 px y Persona en ~191 px. Sugerencia: acercar las fracciones al mockup (Persona y Última vez más anchas, Correo más angosta),
`gap-3`, y espacios duros en «a. m.»/«p. m.» y entre el número y «Android»/«web» para que nunca corten ahí. El chip «También en» con `whitespace-normal` (o dos líneas) en escritorio.

### Móvil (433 px)

| # | Elemento | Mockup (390) | Producción | Veredicto |
| --- | --- | --- | --- | --- |
| 21 | Cabecera | flecha, logo, «Lilachat», pastilla | flecha, logo, «Lilachat» | OK |
| 22 | Subtítulo | corto, una línea | el de escritorio, en dos líneas | MINOR (ya anotado ≈) |
| 23 | Segmentado | no está | a lo ancho bajo el subtítulo | OK (sin él no se llega a «Todas las personas») |
| 24 | Cifras 2×2, buscador | igual | igual | OK |
| 25 | Chips de espacios | «Todos 96» relleno; logo + nombre + conteo; la fila scrollea | igual; la fila scrollea sin mover la página (logos ocultos) | OK |
| 26 | Cabecera de grupo | logo, nombre, línea, chevron | igual (logo oculto) | OK |
| 27 | Tarjeta de persona: arriba | avatar, nombre, teléfono; ROL arriba a la derecha, a la altura del nombre | ROL centrado en vertical del bloque (queda a la altura del teléfono/chip) | MINOR |
| 28 | Chip «También en» | al pie de la tarjeta | debajo del teléfono, texto completo | OK (pedido, INVENTARIO) |
| 29 | Datos | frase corrida: «Se unió · … · Última vez · …», «Dispositivos · … · Lo invitó · …» | rejilla de 2 columnas con etiqueta chica | OK (≈ ya anotado; se lee bien) |
| 30 | Dispositivos | «1 Android · 1 web» en una línea | «23 Android · 4 / web» separa número y unidad | **FIX** (mismo arreglo que #11) |

### Veredicto

**No aprobada.** Composición, orden de bloques y estados visibles coinciden con el mockup; las diferencias de cabecera, rol, segmentado y paginador están justificadas.
Lo que falta es la tabla de escritorio: el reparto de columnas parte «a. m.», «ÚLTIMA VEZ» y «4 / web», trunca nombres y deja truncado el chip «También en», que se bajó justamente para no truncarse.
FIX: #9, #10, #11, #13, #14 (escritorio) y #30 (móvil).
MINOR: #2 (círculo de la flecha), #4 (franja de cifras apretada), #7 (conteo sin pastilla), #12 (Se unió desparejo), #17 (Lo invitó a la izquierda), #22 (subtítulo), #27 (ROL centrado).
Para la próxima ronda: captura de la página completa en escritorio («Sin espacio», «Expandir», paginación, vacío) y una en tema claro.

## Segunda revisión, independiente (14/11, capturas v2 sobre 99951620)

Revisor: un subagente que no implementó la pantalla. Leyó el mockup, las capturas v2 y el código antes de esta auditoría.

**Veredicto: pasa con observaciones.** Los FIX de la primera ronda (#9–#14 y #30) se ven corregidos en las capturas v2. No hay hex ni voseo.

Corregido en el mismo día:
- P1. `SpaceLogo` no tenía fallback: con el logo roto quedaba un hueco. Ahora cae a las iniciales (`web/src/spaces/SpaceLogo.tsx`, con test). Los logos vacíos de las capturas eran el CSS que oculta imágenes antes de capturar, no un defecto.
- P2. El segmentado medía 40 px: pasa a 44 (`h-11`).
- P4. Con el espacio contraído, la cabecera dejaba un borde doble: `md:border-b` solo si está abierto.
- P5. Al buscar o paginar, todo se volvía a abrir: el estado de contraído sube a `AdminSpacesView`, por encima del esqueleto de carga (con test).
- P6. Un espacio elegido sin miembros activos decía «Nadie coincide con esa búsqueda.» sin búsqueda: ahora dice «Este espacio no tiene miembros activos.» (con test).

Queda como MINOR (ya anotado en la primera ronda): paginador ‹ › en vez de números, colores de rol de `memberWeb`, «Lo invitó» a la izquierda, rol centrado en la tarjeta móvil, conteo sin pastilla, «DISPOSITIVOS» y «LO INVITÓ» apretados a 1440 px.

Sin verificar: tema claro, estados contraído, cargando, error y vacío en captura, y el ancho real de 390 px (Chrome de escritorio no baja de 433).
