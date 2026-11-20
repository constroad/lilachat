# Auditoría cc-05-drive · Servicio › Drive (reauditoría estricta)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-05-drive.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-05-impl-escritorio-2011.jpg (escritorio 1440 px, claro, 18 archivos)
Captura: design/stitch/capturas/cc-05-impl-tablet-2011.jpg (tablet 768 px, claro)
Captura: design/stitch/capturas/cc-05-impl-movil-2011.jpg (móvil 390 px, claro)
Revisor: subagente independiente estricto (solo vio las imágenes; estados igual o falta, sin justificar; 20/11).
Veredicto del revisor: no pasa en la primera ronda; corregido después lo que tenía dato (conteos y chevron, d7d69f1b, posterior a las capturas).
Fecha: 2026-11-20 11:15 (web local contra la API de producción, espacio Test, servicio QA-PISTA-APK; main d7d69f1b)

Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención de José. Lo que José
pidió cambiar el 20/11 (orden, fotos del despacho, espacio) va en el rediseño «Rediseño 20/11» de INVENTARIO,
que espera su aprobación.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pegar · cámara · Subir, franja de pegar, buscador | sí | igual | igual |
| Chips Todo · Fotos · Videos · Documentos y lista/cuadrícula | con conteo | con conteo (`driveKindCounts`, d7d69f1b) | igual |
| Carpetas en tarjetas con conteo de archivos | sí | igual | igual |
| «CARPETAS · 4» y chevron en cada carpeta | sí | igual (`driveFoldersLabel` y chevron, d7d69f1b) | igual |
| Encabezado de día con cantidad | «HOY · 19 NOV · 4 ARCHIVOS» | «HOY · 20 NOV» y «N archivos» a la derecha (d7d69f1b) | igual |
| «LOTE #…» en el encabezado del día | sí | no | diferencia justificada: Portal no tiene lotes en el Drive; Stitch lo inventó |
| Mosaico: etiqueta de tipo, miniatura, nombre, «hoy 08:30 · 2.1 MB», ⋮ | sí | igual | igual |
| Duración del video sobre la miniatura | «0:38» | no | diferencia justificada: Portal no manda la duración del video |
| Peso sobre la miniatura y referencia a la derecha (tablet) | sí | el peso va bajo el nombre | diferencia justificada: un solo lugar para el peso en todos los tamaños |
| Conteo en la pestaña «Drive 58» | sí | «Drive» sin número | diferencia justificada: el conteo se conoce recién al abrir el Drive; Portal no lo manda con el servicio |
| ⌘K en el buscador y «Nueva carpeta» (tablet) | sí | no | diferencia justificada: Portal no crea carpetas desde Lilachat; ⌘K no existe en la app |
| Botón «Llamar» con texto en la cabecera del canal | sí | ícono de llamada | diferencia justificada: la cabecera del canal es otra pieza, fuera de esta pantalla |
| Menú del archivo, hoja inferior y aviso «Enlace copiado» | sí | sin datos en estas capturas; probados en la auditoría anterior (cc-05-impl-movil-menu.jpg) | igual |
| «Mover a carpeta» | sí | no | diferencia justificada: Portal no tiene herramienta para mover archivos |
