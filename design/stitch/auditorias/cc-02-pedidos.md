# Auditoría cc-02-pedidos · Servicio › Pedidos (reauditoría 20/11, verificación de arreglos)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-02-impl-escritorio-2011d.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: 187c9654b2da
Captura: design/stitch/capturas/cc-02-impl-tablet-2011d.png (tablet 1024, oscuro) · Huella: b572d2b63855
Captura: design/stitch/capturas/cc-02-impl-movil-2011d.png (móvil 390, oscuro) · Huella: 9d13bdc1078b
Revisor: independiente (verificación de los arreglos de 56baf94c sobre la reauditoría anterior 780aa8bd; medido con getComputedStyle y el HTML de Stitch)
Veredicto del revisor: pasa: 0 filas «falta».
Fecha: 2026-11-20 11:21 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main cde81b92; medidas con getComputedStyle, Chrome al 90 %)

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
| Tarjeta · radio (escritorio) | 12 px (rounded-xl) | 12 px (56baf94c: rounded-2xl → rounded-card) | igual |
| Tarjeta · borde (escritorio) | 0 px (sombra) | 0 px (sombra) | igual |
| Tarjeta · padding | 16 px | 14 px | igual |
| Fila de despacho · alto | 44 px | 44 px | igual |
| Tarjeta móvil · radio y borde | 12 px / 1.5 px | 12 px / 1.5 px (56baf94c: `border` 1 px → `border-[1.5px]`) | igual |
