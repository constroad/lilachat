# Auditoría ped-v2-movil · Servicio › Pedidos en el celular (rediseño 20/11)

Stitch: `.stitch-work/out_v2/mobile/ped-v2-movil.stitch.png` del checkout principal (id `73bd2cad7fc1406a9d1b126c9b1d42e7`).
Captura: design/stitch/capturas/ped-v2-movil.png (móvil 390, oscuro) · Huella: 99f859802f19
Revisor: subagente independiente
Fecha: 2026-11-20 09:40

Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Código «PED-2026-0418» sobre el pedido | sí | no | diferencia justificada: Portal no manda código de pedido en el detalle del servicio |
| Producto · cantidad · día y estado | sí | igual; sin producto dice «Pedido · día» (`OrderCard.heading`) | igual |
| Obra del pedido | no | debajo del título | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual» (José 31/10 pidió la obra) |
| «5 despachos · 60 / 75 m³ · 18 medios» | sí | igual (`OrderCard.summary`) | igual |
| Barra de avance | sí | igual: m³ despachados contra los del pedido (`orderProgressOf`) | igual |
| «DESPACHOS · 5» y «Orden por hora» | sí | «Despachos · 5» y «Por hora» | igual |
| Fila fina: hora sobre m³, camión y placa, miniaturas | sí | igual, por hora (`byHour`) | igual |
| Miniaturas | íconos de cámara, termómetro, regla | las fotos y videos reales con play en el video (`FileThumb`) | diferencia justificada: no verificable en la captura; los despachos QA no tienen fotos. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| Duración del video «0:24» | sí | play sin duración | diferencia justificada: Portal no manda la duración del video |
| «+2» al final | sí | igual (`dispatchThumbs`) | diferencia justificada: no verificable en la captura; los despachos QA no tienen fotos. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| Botón «Foto» en el despacho sin medios | sí | no | diferencia justificada: Lilachat no tiene camino para subir fotos a un despacho |
| Tocar la fila | — | abre la ficha del despacho con la grilla de medios | igual (pedido de José 20/11) |
| Pedido programado: «Sin despachos todavía» | sí | igual | igual |
| «0 / 300 gal» en el pedido sin despachos | sí | no | diferencia justificada: Stitch lo inventó; sin despachos no hay nada que sumar |
| Botón violeta cortado al pie | sí | no | diferencia justificada: Stitch lo inventó; no hay acción para él |
| Bloque «Etapas · N de 5» | no | sí, arriba de los pedidos (solo admins) | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual»; siempre tiene contenido |
| «Cubicaje» | no | sale solo con despachos cubicados | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual» |
| Conteo en «Drive 58» | sí | «Drive» sin número | diferencia justificada: Portal no manda el conteo del Drive con el servicio |
| Cabecera | una fila: ←, nombre, «CLIENTE · 40 %», enlace, ⋮ | tres filas: cliente arriba, nombre, y estado + «Avance 50 % · Inicio» + barra | falta |
