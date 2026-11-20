# Auditoría cc-06-checklist-pendientes · Checklist con Pendientes (móvil)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-06-checklist-pendientes.stitch.png` del checkout principal (móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/chat/workPlan/ChecklistSegmentsWeb.tsx`, `WorkListsWeb.tsx`, `app/src/chat/workPlan/ChecklistSegments.tsx`, `WorkListsPanels.tsx`, `shared/src/serviceShell.ts`.
Captura: design/stitch/capturas/cc-06-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: cliente sin pendientes en la captura; segmento activo corregido (d9aa2e91).
Fecha: 2026-11-20 00:40 (E2E en web a 1440, 1024 y 390 px; main d9aa2e91)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pestaña | «Checklist ● 3» sin pestaña Pendientes | igual para quien tiene Checklist; badge con los pendientes y punto si hay vencidos | igual |
| Segmentado | «Pendientes 3 · Plan 15/15» | igual | igual |
| Lista de pendientes | tarjetas con borde de acento, casilla, tarea, «Etapa N · persona», cámara | igual (`PendingRowWeb`, `PendingRow`), más la fecha límite; casilla y cámara solo para quien puede marcar (`taskActionsFor`) | igual |
| Encabezado «PENDIENTES DE ACCIÓN (3) · Requeridos para faena» | sí | «3 pendientes» | diferencia justificada: «Requeridos para faena» lo inventó Stitch; el número es el mismo |
| Plan de la obra / Servicio asociado | tarjetas resumen | el plan existente en «Plan» | diferencia justificada: INVENTARIO § cc (PROPUESTA: un canal no tiene «servicio asociado» único) |
| «Agregar nueva tarea o pendiente» | botón al pie | no va | diferencia justificada: crear tareas vive en el plan, solo admins (as-is canal §2) |
