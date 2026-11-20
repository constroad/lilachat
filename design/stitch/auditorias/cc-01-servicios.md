# Auditoría cc-01-servicios · Servicios del canal

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-01-servicios.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ClientChannelParts.tsx`, `ServiceCardWeb.tsx`, `app/src/spaces/clients/ClientChannelParts.tsx`, `ServiceCard.tsx`, `shared/src/serviceFacts.ts`.
Captura: design/stitch/capturas/cc-01-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-01-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-01-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: no pasa: la tarjeta no trae pedidos, informes, etapas ni último movimiento (Portal no los mandaba). José 19/11: «Portal manda las cifras»; Portal y Agentes ya los mandan en sus ramas y la tarjeta en columnas va en el lote siguiente.
Fecha: 2026-11-20 00:40 (E2E en web a 1440, 1024 y 390 px; main d9aa2e91)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pestañas del canal | Chat · Cuenta · Servicios N · Checklist N/N · Pendientes N | iguales (`ChannelTabs`); en el móvil sin Pendientes para quien tiene Checklist | igual |
| Cabecera de la lista | kicker «SERVICIOS DEL CLIENTE», título «Servicios» en acento, «Enlace del cliente» y «Drive del cliente» a la derecha | igual (`ListHead`) | igual |
| Filtro | buscador + segmentado «Abiertos 2 · Completados 1 · Todos 3» | igual; «Rechazados» solo si hay uno (`serviceSegmentsOf`) | igual |
| Tarjeta de servicio (escritorio/tablet) | una fila: nombre e «Inicio 12 nov · 6 etapas», estado y avance con barra, PEDIDOS, INFORMES, ÚLTIMO MOVIMIENTO | igual desde 768 px (`WideSummary`) | igual |
| Tarjeta de servicio (móvil) | estado arriba, nombre, «Avance» con %, barra, «Inicio 12 nov · 6 etapas», fila «2 pedidos · 3 informes · Hoy 09:40», barra «Último movimiento: … ›» | igual (`CompactSummary`, `CompactFacts`) | igual |
| Cifras por servicio | PEDIDOS · INFORMES · ÚLTIMO MOVIMIENTO | las que manda Portal (`ordersCount`, `reportsCount`, `stagesTotal`, `lastActivity`); sin dato, «—» en la columna y fila oculta en el móvil | igual |
| Chip «NUEVO» del último movimiento | sí | no va | diferencia justificada: Portal no manda qué es nuevo para cada persona; no se inventa |
| «SERVICIO 01 · VIAL» (móvil) | kicker numerado con rubro | no va | diferencia justificada: INVENTARIO § cc, datos inventados por Stitch |
| Bloque de pendientes (móvil) | «PENDIENTES · 3» con borde de alerta, tarea, «Ver en Checklist ›» | igual (`PendingBlock`, 3 tareas, `pendingPreview`) | igual |
| Enlace del servicio en la tarjeta | no | botón «Enlace del servicio» bajo la tarjeta | diferencia justificada: José 31/10 (as-is canal §2) y memoria «Rediseño conserva lo de la pantalla actual» |
| Medidas (radio, borde, padding) | tarjeta 16 px de radio, borde 1 px | rounded-2xl (16 px), borde 1 px, p-4 | diferencia justificada: medido por el revisor independiente, igual de forma y algo más compacto en tema oscuro |
