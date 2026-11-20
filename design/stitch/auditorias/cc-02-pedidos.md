# Auditoría cc-02-pedidos · Servicio › Pedidos

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceShellWeb.tsx`, `ServiceListsWeb.tsx`, `app/src/spaces/clients/ServiceShell.tsx`, `ServiceLists.tsx`.
Captura: design/stitch/capturas/cc-02-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-02-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-02-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro; con datos de OBRA GRAU)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: sin código PED, «Volquete», total ni progreso de m³ (Portal no los manda); «Crear pedido» es invento de Stitch; «Etapas · X de N» es de la pantalla actual.
Fecha: 2026-11-20 00:40 (E2E en web a 1440, 1024 y 390 px; main d9aa2e91)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pestañas del canal (escritorio/tablet) | siguen visibles sobre el servicio | igual (`serviceFull` solo bajo 768 px) | igual |
| Vuelta | «‹ Servicios» (escritorio/tablet), flecha en recuadro (móvil); sin migas | igual (`volver-a-servicios`) | igual |
| Kicker | «SERVICIO · CONSORCIO EL ALMIRANTE» | igual; móvil solo el cliente | igual |
| Nombre y estado | nombre en negrita con chip de estado al lado | igual | igual |
| Línea | «Avance 0 % · 6 etapas · Inicio 12 nov» + barra | «Avance 0 % · Inicio 12 nov» + barra | diferencia justificada: el número de etapas del mapa no viene en el detalle (`ServiceDetail`); pedido a Portal |
| Acciones de cabecera | «Enlace del servicio» + «⋯» | igual; «⋯» lleva «Abrir en el Portal» | igual |
| Barra | Pedidos 2 · Informes 3 · Mapa · Drive 58, subrayada | Pedidos 2 · Informes 3 · Mapa · Drive (sin número) | diferencia justificada: as-is obra-drive §6, Portal no manda el conteo del Drive en el detalle |
| Pedido | tarjeta: código PED-…, producto, cantidad, día, obra, estado | tarjeta: producto, cantidad, día, despachos, obra, estado | diferencia justificada: Portal no tiene número de pedido (comentario de `detailRows`, shared/src/serviceDetail.ts) |
| Despachos | «DESPACHOS · 2», fila por volquete con placa, m³, hora y 3 fotos | igual (`orderCardsOf`, 3 fotos) | igual |
| Cubicaje | «Cubicaje ›» al pie | «Cubicaje» abre la ficha del pedido | igual |
| Sin despachos | caja «Sin despachos todavía» | igual | igual |
| «Crear pedido para este servicio» (móvil) | botón fijo abajo | no va | diferencia justificada: Lilachat no crea pedidos (los crea Portal/Agentes, as-is canal §1) |
| Barra «SERVICIO ACTIVO» y pestañas repetidas (escritorio) | sí | no va | diferencia justificada: error de Stitch (dos filas de pestañas superpuestas en la captura) |


## Revisión de tablet y móvil (19/11, revisor independiente)

Pasa con observaciones. Diferencias por datos que Portal no manda (código PED, «Volquete», totales y contadores: van con las cifras del lote siguiente), por piezas de la pantalla actual que se conservan («Etapas · X de N», «Generar informe de servicio») y por inventos de Stitch (tarjetas de resumen de Informes, «Total emitidos», «Nueva carpeta», ⌘K). En el teléfono el estado y el PDF del informe bajan bajo el título para que no se corte (6accd568).
