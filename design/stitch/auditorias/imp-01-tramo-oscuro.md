# Auditoría imp-01-tramo-oscuro · Tramo del CTL-IMP compacto (móvil, oscuro)

Stitch: `.stitch-work/out_imp/mobile/imp-01-tramo-oscuro.stitch.png` (+ `.html`) del checkout principal. Id en INVENTARIO § «Informe CTL-IMP compacto (José 19/11)».
Código: `shared/src/compactReportForms.ts`, `shared/src/sampleRows.ts`, `shared/src/fieldDocument.ts` (`sectionFormOf`), `web/src/chat/commands/CompactFields.tsx`, `web/src/chat/commands/AppFormDialog.tsx`, `web/src/spaces/clients/reports/PlaceStatusWeb.tsx`, `app/src/chat/commands/CompactFields.tsx`, `app/src/chat/commands/AppFormSheet.tsx`, `app/src/spaces/clients/reports/PlaceStatus.tsx`.
Captura: design/stitch/capturas/imp-01-impl-movil-oscuro.jpg (móvil 390 px, tema oscuro, web local con la API de producción: Bandejas)
Captura: design/stitch/capturas/imp-01-impl-movil-ubicacion.jpg (móvil 390 px, tema oscuro: Ubicación)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones. La hoja de Bandejas es fiel; a Ubicación le faltan la tarjeta de GPS, el candado y MC-30 (ver tabla).
Fecha: 2026-11-20 04:07 (E2E en la web local contra la API de producción, espacio Test; main 3830d60d)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera | flecha, «CONTROL DE IMPRIMACIÓN · TRAMO 2», «JR CONCHUCOS», chip «BORRADOR» | la cabecera del formulario de siempre: título de la sección («Tramo 2 · Ubicación») y cerrar | diferencia justificada: El formulario abre una sección a la vez; la cabecera no se tocó |
| «Obteniendo ubicación…» | tarjeta con borde, indicador girando, pin y texto; «±— m» a la derecha | tarjeta con borde, indicador, pin y texto (`PlaceStatus*`); también «Ubicación lista.» y los dos errores | igual, sin «±— m» (la lectura no expone la precisión a la tarjeta) |
| Dónde sale la tarjeta | sobre los campos del tramo | sobre los campos de las secciones con foto, que son las que leen el GPS | diferencia justificada: La sección «Ubicación» del tramo no lee GPS; leerlo ahí sería un cambio de comportamiento |
| «Desde 0+120 (fin del Tramo 1)» | línea bajo la tarjeta | no va | diferencia justificada: «Agregar tramo» ya abre donde terminó el anterior (as-is obra-informes) pero esa línea no existe en el formulario |
| «UBICACIÓN DEL TRAMO» + «MC-30» | rótulo de bloque con el ligante | no va; el título de la sección dice «Ubicación» | diferencia justificada: El ligante vive en otra sección (`material`) |
| Progresivas | «Progresiva desde» y «Progresiva hasta» de a dos, 44 px | de a dos (`compactSectionSchema` fija el par: el `x-width` de Portal no llega), 44 px en web y APK (`compact`) | igual |
| Orden | progresivas, carril, horas | progresivas antes del carril (`compactSectionSchema`, orden solo de pantalla) | igual; «Tramo» va primero porque Portal lo exige |
| Candado en «Progresiva desde» | sí | no | diferencia justificada: El campo es editable en Portal; no se bloquea |
| Carril | chips «Derecho · Izquierdo · Ambos», el elegido lleno con ✓ | chips iguales (`TextChipsField`, `x-chips`); guarda el mismo texto; un carril escrito antes sale como un chip más | igual |
| Horas | «Hora inicio» y «Hora final» de a dos con reloj | de a dos con el selector de hora de siempre, 44 px | igual |
| Bandejas: cabecera | «BANDEJAS» y «Basta una completa» a la derecha; columnas N.º · VACÍA (G) · CON ASF. (G) · ÁREA (M²) | «Basta una completa» a la derecha; columnas N.º · VACÍA (G) · CON ASF. (G) · ÁREA (M²) en el teléfono; los títulos completos de Portal en tablet | igual |
| Bandeja completa | fila B1 con ✓ verde | fila B1 con ✓ (`text-en-linea`) | igual |
| Bandeja a medias | borde rojo, casilla vacía en rojo, «Completa esta bandeja o déjala vacía» | igual, mientras se escribe (`sampleRowMessage`), con ⚠ al final | igual |
| Bandeja vacía opcional | (cortada en la captura) | «OPC.» al final | igual a imp-02 |
| Unidad dentro de la casilla | «g» a la derecha | «g» / «m²» dentro de la casilla desde 400 px de ancho; en 360 px solo en la cabecera | diferencia justificada: en 360 px no cabe; la unidad queda en la cabecera |
| «Foto del riego» | botón secundario sobre «Guardar tramo» | no va: la foto es su propia sección «Fotos» | diferencia justificada: la foto es su propia sección |
| Botón principal | «Guardar tramo», 52 px, uno solo | «Guardar», 52 px (`tall`), uno solo | diferencia justificada: Cada sección se guarda sola; «Guardar tramo» diría que se guarda el tramo entero |
| «TOCA», barra de estado del teléfono, «(ensayo de tara)» | sí | no van | diferencia justificada: INVENTARIO § imp, inventados por Stitch |
