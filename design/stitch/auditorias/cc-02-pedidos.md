# Auditoría cc-02-pedidos · Servicio › Pedidos (reauditoría 20/11)

Stitch: `.stitch-work/out_cc/{desktop,tablet,mobile}/cc-02-pedidos.stitch.png` del checkout principal.
Captura: design/stitch/capturas/cc-02-impl-escritorio-2011b.png (escritorio 1440, oscuro, servicio Mejoramiento del Corredor Vial) · Huella: c4afb0bf9172
Captura: design/stitch/capturas/cc-02-impl-tablet-2011b.png (tablet 1024, oscuro) · Huella: 0f20eb6ad1be
Captura: design/stitch/capturas/cc-02-impl-movil-2011b.png (móvil 390, oscuro) · Huella: 9ea6dd7f2d35
Revisor: subagente independiente (solo vio las imágenes de Stitch, su HTML y las capturas; 20/11)
Veredicto del revisor: no pasa. La tablet no la abrió el revisor.
Fecha: 2026-11-20 10:01 (web local en 4005 contra la API de producción, espacio Test, cliente Consorcio Vial del Pacífico; main 02f38ddf)

Las justificaciones son del auditor y citan su fuente; ninguna es una exención de José. «Rediseño 20/11» = rediseño 20/11 aprobado por José, ver design/stitch/INVENTARIO.md sección Rediseño 20/11. Lo que no tiene fuente queda «falta».

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera de una fila en el teléfono («CLIENTE · %») | estado, avance, etapas e inicio | solo «Cliente · 0 %» | diferencia justificada: rediseño 20/11 (ped-v2-movil, cabecera de una fila) |
| Banda «Servicio activo» | sí | no | diferencia justificada: rediseño 20/11 |
| Conteo en «Drive 58» | sí | sin número | diferencia justificada: Portal no manda el conteo, auditoría mapa-v2-movil |
| Agrupado por etapas y no por código «PED-…» | tarjeta por PED | «Etapas · 1 de 5» | diferencia justificada: memoria «el rediseño conserva lo de la pantalla actual»; código no llega de Portal (auditoría ped-v2-movil) |
| Filas de despacho con medios | tres botones | filas por hora con miniaturas | diferencia justificada: rediseño 20/11 (ped-v2-movil) |
| Barra de avance del pedido | no | sí | diferencia justificada: rediseño 20/11 (ped-v2-movil, barra de avance) |
| «Cubicaje», «Ver pedido», «Asignado a…» | sí | no | falta |
| «Pedidos asociados · Total» y «Crear pedido» (móvil) | sí | no | falta |
| Título del servicio · tamaño | 22 px | 17 px | falta |
| Tarjeta · radio (escritorio) | 16 px | 12 px | falta |
| Tarjeta · borde (escritorio) | 0 px (sombra) | 1 px | falta |
| Tarjeta · padding | 16 px | 14 px | igual |
| Fila de despacho · alto | 44 px | 50 px | falta |
| Tarjeta móvil · radio y borde | 12 px / 1 px | 12 px / 1 px | igual |
