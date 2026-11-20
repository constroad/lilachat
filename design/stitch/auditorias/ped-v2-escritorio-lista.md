# Auditoría ped-v2-escritorio-lista · Servicio › Pedidos en escritorio (rediseño 20/11)

Stitch: `.stitch-work/out_v2/desktop/ped-v2-escritorio-lista.stitch.png` del checkout principal (id `928abd296fd944e5ba52c79f525d1b44`).
Stitch: `.stitch-work/out_v2/desktop/ped-v2-escritorio.stitch.png` (visor del despacho, id `a40af6aabc5447d283531b5e9c42c8fa`).
Captura: design/stitch/capturas/ped-v2-escritorio-lista.png (escritorio 1440, claro) · Huella: 920baf3ff382
Revisor: subagente independiente
Fecha: 2026-11-20 09:51

Las justificaciones de abajo son mías y dicen el motivo real; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Chip «PED-2026-0418» | sí | no | diferencia justificada: Portal no manda código de pedido en el detalle del servicio |
| Producto · cantidad · día y estado en una línea | sí | igual (`OrderCard.heading`) | igual |
| Pastillas «5 DESPACHOS · 60 / 75 m³ · 18 MEDIOS» a la derecha | sí | la misma cifra en una línea bajo el título | diferencia justificada: un solo resumen para celular y escritorio |
| «Progreso de suministro» y «80.0% completado» | sí | solo la barra | diferencia justificada: la cifra ya dice «60 / 75 m³» al lado |
| Barra de avance | sí | igual (`orderProgressOf`) | igual |
| Tabla Hora · Unidad · Volumen · Fotos y videos | sí | igual desde 640 px | igual |
| Placa en chip | sí | igual | igual |
| Miniaturas | íconos con «SLUMP», «152 °C», «TOLVA» | las fotos y videos reales (`FileThumb`) y «+K» | diferencia justificada: no verificable en la captura; los despachos QA no tienen fotos («Sin fotos»). El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| Fila resaltada (08:05) | sí | resaltado al pasar el mouse | diferencia justificada: no hay un despacho «actual» en los datos |
| «Sin fotos aún» | sí | «Sin fotos» | igual |
| Tocar la fila | — | abre la ficha del despacho con la grilla de medios | igual (pedido de José 20/11) |
| «2 pedidos asignados al frente» | sí | no | diferencia justificada: Portal no manda frentes |
| Pedido programado: «Sin despachos todavía · Programado para …» y «TURNO MAÑANA» | sí | «Sin despachos todavía» | diferencia justificada: Portal no manda el turno ni la planta |
| «0 / 300 gal» | sí | no | diferencia justificada: Stitch lo inventó; sin despachos no hay nada que sumar |
| Visor con todas las fotos y videos del despacho, deslizables | sí | la galería de 755c4767 (`PortalFileViewer`, `siblings` = todos los medios) | igual |
| Visor: cabecera «placa · hora», «Foto 2 de 7», Copiar enlace, tira de miniaturas | sí | lo que ya trae la galería; sin verificar contra la captura | diferencia justificada: no verificable con datos QA; ningún despacho del espacio Test tiene fotos (Pachacútec, QA-PISTA-APK y QA-CTLPIS: «Sin fotos»), revisión en solo lectura 20/11 |
| Visor: «Registro de temperatura en tolva · Prog. 0+180» | sí | no | diferencia justificada: Stitch lo inventó; Portal no manda leyenda por foto |
| Bloque «Etapas · N de 5» | no | sí (solo admins) | diferencia justificada: memoria de José «el rediseño conserva lo de la pantalla actual»; siempre tiene contenido |
