# Auditoría cc-02-pedidos · Servicio › Pedidos

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceShellWeb.tsx`, `ServiceListsWeb.tsx`, `app/src/spaces/clients/ServiceShell.tsx`, `ServiceLists.tsx`.
Captura de la implementación: **pendiente** (sin navegador, dev server ni emulador en esta tarea: Mac compartida). Esta lectura es
de código contra cada captura de Stitch, abierta en la sesión del 19/11. Falta capturar a 1440 / 1024 / 390 px (web) y en teléfono y
tablet (APK) y que un subagente independiente compare imagen contra imagen, con medidas en px.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-19 21:10 (lectura de código; ramas 988a209a y 9d074e71)

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
