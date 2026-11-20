# Auditoría cc-03-informes · Servicio › Informes

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-03-informes.stitch.png` del checkout principal (escritorio, tablet, móvil). Ids en INVENTARIO § «Canal de cliente y servicio, rediseño».
Código: `web/src/spaces/clients/ServiceDetailWeb.tsx`, `ServiceListsWeb.tsx`, `app/src/spaces/clients/ServiceDetailView.tsx`, `ServiceLists.tsx`.
Captura de la implementación: **pendiente** (sin navegador, dev server ni emulador en esta tarea: Mac compartida). Esta lectura es
de código contra cada captura de Stitch, abierta en la sesión del 19/11. Falta capturar a 1440 / 1024 / 390 px (web) y en teléfono y
tablet (APK) y que un subagente independiente compare imagen contra imagen, con medidas en px.
Revisor: pendiente (no aprobado).
Fecha: 2026-11-19 21:10 (lectura de código; ramas 988a209a y 9d074e71)

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera y barra | idénticas a Pedidos | mismo `ServiceShellWeb` / `ServiceShell` | igual |
| «Crear informe» | botón primario a la derecha de la barra | igual (`SectionActions` en web; `actions` en APK) | igual |
| Días | «HOY · 19 NOV» con «1 informe registrado» a la derecha | «19 de noviembre» con «1 informe» | diferencia justificada: el título del día sale de `reportGroups` (José 31/10, como la lista de Portal) |
| Fila | ícono en recuadro, título, «Creado por …», estado, botón PDF | igual | igual |
| Franja de cifras al pie (escritorio) | Conformidad técnica, Última actualización, Sincronización Drive | no va | diferencia justificada: INVENTARIO § cc, cifras inventadas sin dato en Portal |
| Resumen «Total emitidos» (móvil) | tarjeta arriba | no va | diferencia justificada: INVENTARIO § cc, sin dato de aprobados en el detalle |
| «Generar informe de servicio» | no | sí, solo quien ve montos | diferencia justificada: José 31/10 y 05/11 (as-is canal §2), memoria «Rediseño conserva lo de la pantalla actual» |
