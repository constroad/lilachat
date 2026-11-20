# Auditoría imp-03-tramo-tablet · Tramo del CTL-IMP compacto (tablet)

Stitch: `.stitch-work/out_imp/tablet/imp-03-tramo-tablet.stitch.png` (+ `.html`) del checkout principal. Id en INVENTARIO § «Informe CTL-IMP compacto (José 19/11)».
Código: los mismos de `imp-01-tramo-oscuro.md`. Web: diálogo ancho (`Overlay wide`, 672 px) desde 640 px; columna «Estado» desde `sm`. APK: hoja de hasta 640 pt (`COMPACT_SHEET_MAX_WIDTH`) y tabla con «Estado» desde 560 pt de ancho útil.
Captura: TODO (web 1024 px y APK en la tablet del emulador; la toma la sesión principal)
Revisor: pendiente
Veredicto del revisor: pendiente
Fecha: 2026-11-19 (lectura de código contra la captura; sin navegador ni emulador en la tarea)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Panel sobre el informe | panel de 640 px centrado, el informe atenuado detrás | web: diálogo de 672 px sobre el informe; APK: hoja de 640 pt | igual (web 32 px más ancho: el ancho del diálogo ancho de siempre) |
| Columna lateral «Formulario Técnico», «Canal de Campo», «Terminal Obra #04» | sí | no va | diferencia justificada: INVENTARIO § imp, inventada por Stitch |
| Barra «CONSTROAD CIVIL SUITE · Sincronizado» | sí | no va | diferencia justificada: INVENTARIO § imp, inventada por Stitch |
| Cabecera del panel | «CONTROL DE IMPRIMACIÓN · TRAMO 2», «JR CONCHUCOS», «BORRADOR» | la cabecera del formulario de siempre | diferencia: pendiente de revisor (ver imp-01) |
| «Obteniendo ubicación…» | tarjeta con indicador, pin y «Desde 0+120 (fin del Tramo 1)» | tarjeta con indicador y pin, en las secciones con foto | igual la tarjeta; la línea y dónde sale, pendientes (ver imp-01) |
| Progresivas y carril en una fila | «Progresiva desde · Progresiva hasta · Carril (Der. Izq. Ambos)» | progresivas de a dos y los chips del carril en su propia fila debajo | diferencia: pendiente de revisor. Las filas de a dos son las del motor de formularios |
| Horas | de a dos, anchas | de a dos | igual |
| Bandejas como tabla | cabecera N.º · VACÍA (G) · CON ASF. (G) · ÁREA (M²) · ESTADO | igual con los títulos de Portal y la columna «Estado» | igual |
| Estado por fila | ✓ verde, ⚠ rojo, «OPCIONAL» | ✓ (`en-linea`), ⚠ (`error`), «Opcional» | igual |
| Fila a medias | fondo rojo tenue, casilla roja, «Completa esta bandeja o déjala vacía» | igual | igual |
| «Tasa de riego: 1,02 lt/m² · EN RANGO» | tarjeta verde bajo las bandejas | no va en el formulario; la tasa la calcula Portal y sale en el tramo del informe (`results`) | diferencia: pendiente. Calcularla en Lilachat sería lógica de negocio fuera de Portal |
| «Foto del riego» + «Guardar tramo» | dos botones en la misma fila | solo «Guardar», 52 px a todo el ancho | diferencia: pendiente (ver imp-01) |
| «TOCA», «(ensayo de tara)» | sí | no van | diferencia justificada: INVENTARIO § imp, inventados por Stitch |
