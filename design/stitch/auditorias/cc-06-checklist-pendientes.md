# Auditoría cc-06-checklist-pendientes · Checklist con Pendientes (móvil)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-06-checklist-pendientes.stitch.png` del checkout principal (móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/chat/workPlan/ChecklistSegmentsWeb.tsx`, `app/src/chat/workPlan/ChecklistSegments.tsx`, `shared/src/serviceShell.ts`.
Captura de la implementación: **pendiente** (sin navegador, dev server ni emulador en esta tarea: Mac compartida). Esta lectura es
de código contra cada captura de Stitch, abierta en la sesión del 19/11. Falta capturar a 1440 / 1024 / 390 px (web) y en teléfono y
tablet (APK) y que un subagente independiente compare imagen contra imagen, con medidas en px.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-19 21:10 (lectura de código; ramas 988a209a y 9d074e71)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pestaña | «Checklist ● 3» sin pestaña Pendientes | igual para quien tiene Checklist; badge con los pendientes y punto si hay vencidos | igual |
| Segmentado | «Pendientes 3 · Plan 15/15» | igual | igual |
| Lista de pendientes | tarjetas con casilla, tarea, etapa y persona, cámara | la lista de Pendientes existente (`PendingWeb`, `PendingPanel`): tarea, etapa, persona y fecha | falta: casilla y cámara directas en la fila (hoy se abren en el detalle de la tarea) |
| Plan de la obra / Servicio asociado | tarjetas resumen | el plan existente en «Plan» | diferencia justificada: INVENTARIO § cc (PROPUESTA: un canal no tiene «servicio asociado» único) |
| «Agregar nueva tarea o pendiente» | botón al pie | no va | diferencia justificada: crear tareas vive en el plan, solo admins (as-is canal §2) |
