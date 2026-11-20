# Auditoría cc-03-informes · Servicio › Informes

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-03-informes.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDetailWeb.tsx`, `ServiceListsWeb.tsx`, `app/src/spaces/clients/ServiceDetailView.tsx`, `ServiceLists.tsx`.
Captura: design/stitch/capturas/cc-03-impl-escritorio.jpg (escritorio, web local con la API de producción, tema oscuro)
Captura: design/stitch/capturas/cc-03-impl-tablet.jpg (tablet, web local con la API de producción, tema oscuro; con datos de OBRA GRAU)
Captura: design/stitch/capturas/cc-03-impl-movil.jpg (móvil, web local con la API de producción, tema oscuro; con datos de OBRA GRAU)
Revisor: subagente independiente (solo vio las imágenes de Stitch y de la implementación; 19/11).
Veredicto del revisor: pasa con observaciones: servicio sin informes en la captura; la lista por día se ve con datos en OBRA GRAU.
Fecha: 2026-11-20 01:30 (E2E del lote 2 en web a 1440 y 390 px; main f217270b)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera y barra | idénticas a Pedidos | mismo `ServiceShellWeb` / `ServiceShell` | igual |
| «Crear informe» | botón primario a la derecha de la barra | igual (`SectionActions` en web; `actions` en APK) | igual |
| Días | «HOY · 19 NOV» con «1 informe registrado» a la derecha | «19 de noviembre» con «1 informe» | diferencia justificada: el título del día sale de `reportGroups` (José 31/10, como la lista de Portal) |
| Fila | ícono en recuadro, título, «Creado por …», estado, botón PDF | igual | igual |
| Franja de cifras al pie (escritorio) | Conformidad técnica, Última actualización, Sincronización Drive | no va | diferencia justificada: INVENTARIO § cc, cifras inventadas sin dato en Portal |
| Resumen «Total emitidos» (móvil) | tarjeta arriba | no va | diferencia justificada: INVENTARIO § cc, sin dato de aprobados en el detalle |
| «Generar informe de servicio» | no | sí, solo quien ve montos | diferencia justificada: José 31/10 y 05/11 (as-is canal §2), memoria «Rediseño conserva lo de la pantalla actual» |


## Revisión de tablet y móvil (19/11, revisor independiente)

Pasa con observaciones. Diferencias por datos que Portal no manda (código PED, «Volquete», totales y contadores: van con las cifras del lote siguiente), por piezas de la pantalla actual que se conservan («Etapas · X de N», «Generar informe de servicio») y por inventos de Stitch (tarjetas de resumen de Informes, «Total emitidos», «Nueva carpeta», ⌘K). En el teléfono el estado y el PDF del informe bajan bajo el título para que no se corte (6accd568).


## Revisión tras el lote de José (20/11, revisor independiente)

Pasa con observaciones en Servicios (escritorio y móvil), Mapa, hoja del Drive y Pendientes. Cifras, «N etapas» y último movimiento salen «—» u ocultos hasta que se desplieguen Portal y Agentes (ramas `feat/service-counts-lilachat`). Diferencias justificadas: «Drive del cliente», el kicker «SERVICIO 01 · VIAL», la escala y la brújula del mapa, «Requeridos para faena» y «Agregar nueva tarea» los dibujó Stitch sin pedido ni dato; «Enlace del servicio», chips de días, «Trabajo» y «Registrar avance» son de la pantalla actual (memoria «Rediseño conserva lo de la pantalla actual»). Pendiente menor: «Compartir» en la hoja del Drive solo aparece donde el navegador lo soporta.
