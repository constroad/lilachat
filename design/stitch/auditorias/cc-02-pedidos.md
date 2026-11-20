# Auditoría cc-02-pedidos · Servicio › Pedidos (reauditoría estricta)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-02-impl-escritorio-2011.jpg (escritorio 1440 px, claro; despachos de prueba sin fotos propias)
Captura: design/stitch/capturas/cc-02-impl-movil-2011.jpg (móvil 390 px, claro)
Captura: design/stitch/capturas/cc-02-impl-tablet.jpg (tablet, captura anterior: la pantalla no cambió de forma en tablet)
Revisor: subagente independiente estricto (solo vio las imágenes; estados igual o falta, sin justificar; 20/11).
Veredicto del revisor: no pasa (orden, código del pedido, botones del despacho). José 20/11 pidió rediseñar esta pantalla: va en «Rediseño 20/11».
Fecha: 2026-11-20 11:15 (web local contra la API de producción, espacio Test, servicio QA-PISTA-APK; main d7d69f1b)

Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención de José. Lo que José
pidió cambiar el 20/11 (orden, fotos del despacho, espacio) va en el rediseño «Rediseño 20/11» de INVENTARIO,
que espera su aprobación.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Volver, título, estado, avance, «Enlace del servicio» | sí | igual; el enlace abre su hoja (755c4767) | igual |
| Pestañas con conteo | Pedidos 2, Informes 3, Drive 58 | Pedidos e Informes con conteo; Drive sin número | diferencia justificada: Portal no manda el conteo del Drive con el servicio |
| Código «PED-…», producto y destino del pedido | sí | «Pedido», m³, fecha, despachos | diferencia justificada: Portal no manda código ni producto en el detalle del servicio |
| Despachos: camión, placa, m³, hora | sí | igual | igual |
| Fotos y videos del despacho | tres botones por fila | miniaturas con «+N» y visor con todo (755c4767); en la captura no hay fotos | diferencia justificada: José 20/11 pidió ver todas las fotos del despacho; el rediseño lo dibuja |
| «Cubicaje ›» | sí | sale solo con despachos cubicados; sin datos en la captura | igual |
| «Pedidos asociados (2) · Total», avance m³ de m³ y «Crear pedido para este servicio» | sí | no | diferencia justificada: los pedidos se crean en Portal; el total va en el rediseño 20/11 |
| Bloque «Etapas · 1 de 5» | no | sí | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual» (etapas) |
| Banda «Servicio activo · En progreso» y cabecera «Activo · miembros» | sí | el estado va junto al título | diferencia justificada: el mismo dato una sola vez |
