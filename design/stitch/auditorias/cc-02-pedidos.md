# Auditoría cc-02-pedidos · Servicio › Pedidos (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-02-impl-escritorio-2011c.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 1d7021c54e54
Captura: design/stitch/capturas/cc-02-impl-tablet-2011c.png (tablet 1024, oscuro) · Huella: 31458d6fd60f
Captura: design/stitch/capturas/cc-02-impl-movil-2011c.png (móvil 390, oscuro) · Huella: 29f4b4f7fe1c
Revisor: subagente independiente (reauditoría 20/11 tras e1808eb8…b35ea61c; midió con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: no pasa: quedan 2 filas «falta».
Fecha: 2026-11-20 10:40 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main b35ea61c; medidas con getComputedStyle, Chrome al 90 %)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila en el teléfono («CLIENTE · %») | estado, avance, etapas e inicio | solo «Cliente · 0 %» | diferencia justificada: rediseño 20/11 (ped-v2-movil, cabecera de una fila) |
| Banda «Servicio activo» | sí | no | diferencia justificada: rediseño 20/11 |
| Conteo en «Drive 58» | sí | sin número | diferencia justificada: Portal no manda el conteo, design/stitch/auditorias/mapa-v2-movil.md |
| Agrupado por etapas y no por código «PED-…» | tarjeta por PED | «Etapas · 1 de 5» | diferencia justificada: memoria de José redesign-keeps-current-screen-features.md; código no llega de Portal (design/stitch/auditorias/ped-v2-movil.md) |
| Filas de despacho con medios | tres botones | filas por hora con miniaturas | diferencia justificada: rediseño 20/11 (ped-v2-movil) |
| Barra de avance del pedido | no | sí | diferencia justificada: rediseño 20/11 (ped-v2-movil, barra de avance) |
| «Cubicaje» y «Ver pedido» | sí | sí | igual |
| «Asignado a…» | sí | no | diferencia justificada: Portal no manda el asignado del pedido (shared/src/serviceOrderCards.ts no tiene el campo) |
| «Pedidos asociados al servicio (N) · Total» (móvil) | sí | sí | igual |
| «Crear pedido» (móvil) | sí | no | diferencia justificada: Lilachat no crea pedidos, los crea Portal (specs/as-is/obra-canal-cliente-y-tutoriales.md) |
| Título del servicio · tamaño | 22 px | 15 px | diferencia justificada: José 20/11 en el chat, cabecera de una fila en todas las pestañas sin repetir el cliente (2edfbb37) |
| Tarjeta · radio (escritorio) | 12 px (rounded-xl) | 16 px | falta |
| Tarjeta · borde (escritorio) | 0 px (sombra) | 0 px (sombra) | igual |
| Tarjeta · padding | 16 px | 14 px | igual |
| Fila de despacho · alto | 44 px | 44 px | igual |
| Tarjeta móvil · radio y borde | 12 px / 1.5 px | 16 px / 1 px | falta |
