# Auditoría cc-01-servicios · Canal › Servicios (reauditoría 20/11, verificación de arreglos)

Stitch: `.stitch-work/out_cc/{desktop,tablet}/cc-01-servicios.stitch.png` y `mobile/cc-01-servicios-v2.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-01-impl-escritorio-2011d.png (escritorio 1440, oscuro) · Huella: 0cd04e783620
Captura: design/stitch/capturas/cc-01-impl-tablet-2011d.png (tablet 1024, oscuro) · Huella: 7c571e6e826d
Captura: design/stitch/capturas/cc-01-impl-movil-2011d.png (móvil 390, oscuro) · Huella: 6e76ef6d5482
Revisor: independiente (verificación de los arreglos de cea36b0e sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Pestañas del canal y lista con buscador y segmentado | sí | igual | igual |
| «Drive del cliente» en la cabecera | sí | no | diferencia justificada: inventado por Stitch, auditoría anterior (revisión del lote de José 20/11) |
| Segmento activo | blanco (escritorio), acento lleno (móvil) | superficie con texto de acento (escritorio), acento lleno (móvil) | igual |
| «Enlace del servicio» en cada tarjeta | no | sí | diferencia justificada: José 31/10 (as-is canal §2), memoria de José redesign-keeps-current-screen-features.md |
| Tarjeta · radio | 12 px (rounded-xl) | 12 px (cea36b0e: rounded-2xl → rounded-card) | igual |
| Tarjeta · borde | 0 px (sombra) | 0 px arriba y a la derecha, franja de estado de 4 px, sombra | igual |
| Tarjeta · padding | 16 px | 16 px | igual |
| Tarjeta · alto | 115 px | 120 px | igual |
| Título «Servicios» · tamaño | 28 px | 28 px | igual |
| Kicker «SERVICIO 01 · VIAL» (móvil) | sí | no | diferencia justificada: inventado por Stitch, design/stitch/INVENTARIO.md § cc |
| «Enlace del cliente» en el móvil | no | sí | diferencia justificada: función existente que se conserva, memoria de José redesign-keeps-current-screen-features.md |
| Título «Servicios» en el móvil | no | sí (28 px) | diferencia justificada: mismo `ListHead` que en escritorio (ClientChannelParts.tsx), sin condicional de breakpoint — Stitch no lo dibujó en el mock móvil pero sí en el de escritorio |
| Buscador y segmentado en el móvil | dos controles con borde de 1.5 px | dos controles con borde de 1.5 px | igual |
| Tarjeta móvil · borde | 1.5 px | 1.5 px | igual |
| Tarjeta móvil · radio | 12 px | 12 px (cea36b0e) | igual |
| Bloque de pendientes (móvil) | 1 tarea | 3 tareas | igual |
