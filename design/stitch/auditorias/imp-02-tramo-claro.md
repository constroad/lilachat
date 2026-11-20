# Auditoría imp-02-tramo-claro · Tramo del CTL-IMP compacto (móvil, claro)

Stitch: `.stitch-work/out_imp/mobile/imp-02-tramo-claro.stitch.png` (+ `.html`) del checkout principal. Id en INVENTARIO § «Informe CTL-IMP compacto (José 19/11)».
Código: los mismos de `imp-01-tramo-oscuro.md`; el tema claro sale de los tokens (`shared/src/tokens.ts`), sin hex.
Captura: design/stitch/capturas/imp-02-impl-movil-claro.jpg (móvil 390 px, tema claro, web local con la API de producción)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones (los mismos puntos que imp-01).
Fecha: 2026-11-20 04:07 (E2E en la web local contra la API de producción, espacio Test; main 3830d60d)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera | «CONTROL DE IMPRIMACIÓN · TRAMO 2», «JR CONCHUCOS», «BORRADOR» | la cabecera del formulario de siempre | diferencia justificada: el formulario abre una sección a la vez (ver imp-01) |
| «Obteniendo ubicación…» | tarjeta blanca con borde, indicador, pin; «Desde 0+120 (fin del Tramo 1)» debajo | tarjeta con borde (`bg-background`), indicador y pin; sin la línea «Desde…» | diferencia justificada: la línea, como en imp-01 |
| Bloque «UBICACIÓN DEL TRAMO» con «MC-30» | tarjeta con rótulo y chip del ligante | campos sin tarjeta propia; el título de la sección dice «Ubicación» | diferencia justificada: la foto es su propia sección |
| Progresivas | de a dos, 44 px | de a dos, 44 px | igual |
| Carril | chips; «Derecho» lleno en acento con ✓, los otros con borde | igual (`bg-primary` / `border-outline/25`) | igual |
| Horas | de a dos con reloj | de a dos con el selector de hora | igual |
| Bloque «BANDEJAS (ENSAYO DE TARA)» | tarjeta con «Basta una completa» | lista de filas con «Basta una completa»; sin «(ensayo de tara)» | igual; «(ensayo de tara)» inventado por Stitch (INVENTARIO § imp) |
| B1 completa | ✓ verde | ✓ (`text-en-linea`) | igual |
| B2 a medias | fila con borde rojo, «—» rojo, ⚠, «Completa esta bandeja o déjala vacía» | igual | igual |
| B3 vacía | casillas «—», «0,178» gris, «OPC.» | casillas con «—» de marcador, «OPC.» | igual; el área no se precarga (Portal no la manda) |
| Botón | «Guardar tramo», 52 px, acento | «Guardar», 52 px, acento | diferencia justificada: la foto es su propia sección (ver imp-01) |
| «TOCA», barra de estado del teléfono | sí | no van | diferencia justificada: INVENTARIO § imp, inventados por Stitch |
