# Auditoría imp-03-tramo-tablet · Tramo del CTL-IMP compacto (tablet)

Stitch: `.stitch-work/out_imp/tablet/imp-03-tramo-tablet.stitch.png` (+ `.html`) del checkout principal. Id en INVENTARIO § «Informe CTL-IMP compacto (José 19/11)».
Código: los mismos de `imp-01-tramo-oscuro.md`. Web: diálogo ancho (`Overlay wide`, 672 px) desde 640 px; columna «Estado» desde `sm`. APK: hoja de hasta 640 pt (`COMPACT_SHEET_MAX_WIDTH`) y tabla con «Estado» desde 560 pt de ancho útil.
Captura: design/stitch/capturas/imp-03-impl-tablet.jpg (tablet 768 px, tema claro, web local con la API de producción)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones. La tabla de bandejas con «Estado» es fiel; la tasa de riego y «Foto del riego» no están en la hoja.
Fecha: 2026-11-20 04:07 (E2E en la web local contra la API de producción, espacio Test; main 3830d60d)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Panel sobre el informe | panel de 640 px centrado, el informe atenuado detrás | web: diálogo de 672 px sobre el informe; APK: hoja de 640 pt | igual (web 32 px más ancho: el ancho del diálogo ancho de siempre) |
| Columna lateral «Formulario Técnico», «Canal de Campo», «Terminal Obra #04» | sí | no va | diferencia justificada: INVENTARIO § imp, inventada por Stitch |
| Barra «CONSTROAD CIVIL SUITE · Sincronizado» | sí | no va | diferencia justificada: INVENTARIO § imp, inventada por Stitch |
| Cabecera del panel | «CONTROL DE IMPRIMACIÓN · TRAMO 2», «JR CONCHUCOS», «BORRADOR» | la cabecera del formulario de siempre | diferencia justificada: el formulario abre una sección a la vez (ver imp-01) |
| «Obteniendo ubicación…» | tarjeta con indicador, pin y «Desde 0+120 (fin del Tramo 1)» | tarjeta con indicador y pin, en las secciones con foto | diferencia justificada: la línea y dónde sale, como en imp-01 |
| Progresivas y carril en una fila | «Progresiva desde · Progresiva hasta · Carril (Der. Izq. Ambos)» | progresivas de a dos y los chips del carril en su propia fila debajo | diferencia justificada: Las filas de a dos son las del motor de formularios |
| Horas | de a dos, anchas | de a dos | igual |
| Bandejas como tabla | cabecera N.º · VACÍA (G) · CON ASF. (G) · ÁREA (M²) · ESTADO | igual con los títulos de Portal y la columna «Estado» | igual |
| Estado por fila | ✓ verde, ⚠ rojo, «OPCIONAL» | ✓ (`en-linea`), ⚠ (`error`), «Opcional» | igual |
| Fila a medias | fondo rojo tenue, casilla roja, «Completa esta bandeja o déjala vacía» | igual | igual |
| «Tasa de riego: 1,02 lt/m² · EN RANGO» | tarjeta verde bajo las bandejas | no va en el formulario; la tasa la calcula Portal y sale en el tramo del informe (`results`) | diferencia justificada: Calcularla en Lilachat sería lógica de negocio fuera de Portal |
| «Foto del riego» + «Guardar tramo» | dos botones en la misma fila | solo «Guardar», 52 px a todo el ancho | diferencia justificada: la foto es su propia sección (ver imp-01) |
| «TOCA», «(ensayo de tara)» | sí | no van | diferencia justificada: INVENTARIO § imp, inventados por Stitch |
