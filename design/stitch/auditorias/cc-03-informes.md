# Auditoría cc-03-informes · Servicio › Informes (reauditoría estricta)

Stitch: `.stitch-work/out_cc/{desktop,tablet}/cc-03-informes.stitch.png` y `mobile/cc-03-informes-v2.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-03-impl-escritorio-2011.jpg (escritorio 1440 px, claro; tres borradores)
Captura: design/stitch/capturas/cc-03-impl-tablet-2011.jpg (tablet 768 px, claro)
Captura: design/stitch/capturas/cc-03-impl-movil-2011.jpg (móvil 390 px, claro)
Revisor: subagente independiente estricto (solo vio las imágenes; estados igual o falta, sin justificar; 20/11).
Veredicto del revisor: no pasa en la primera ronda (PDF por fila, tarjetas de resumen, «Crear informe» en la barra en el móvil).
Fecha: 2026-11-20 11:15 (web local contra la API de producción, espacio Test, servicio QA-PISTA-APK; main d7d69f1b)

Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención de José. Lo que José
pidió cambiar el 20/11 (orden, fotos del despacho, espacio) va en el rediseño «Rediseño 20/11» de INVENTARIO,
que espera su aprobación.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Volver, título, estado, «Enlace del servicio», «Crear informe» | sí | igual | igual |
| Grupos por día con «N informes» | sí | igual | igual |
| Fila: ícono, título, creador, estado | sí | igual | igual |
| Botón PDF en cada fila | sí | sale en los publicados; la captura solo tiene borradores | igual |
| Tarjetas de resumen (Conformidad, Última actualización, Sincronización Drive, «Total emitidos») | sí | no | diferencia justificada: Stitch las inventó sin dato (INVENTARIO § cc, revisión del 19/11) |
| Bloque «Etapas» y «Generar informe de servicio» | no | sí | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual» |
| «Crear informe» dentro de la barra de pestañas en el móvil y botón fijo abajo | sí | en su propia fila bajo las pestañas | diferencia justificada: a 390 px no entra junto a cuatro pestañas sin cortarlas |
| «0/6» junto al avance en el móvil | sí | «Etapas · 1 de 5» debajo | diferencia justificada: el mismo dato en el bloque de etapas |
| Pestaña «Drive 58» y cabecera con RUC y «Llamar» | sí | Drive sin número; cabecera del canal con íconos | diferencia justificada: Portal no manda el conteo; la cabecera del canal es otra pieza |
