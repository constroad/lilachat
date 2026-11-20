# Auditoría pv2-04-pista-tablet · Control de pista › cola y unidad lado a lado (tablet)

Stitch: `.stitch-work/out_v2/tablet/pv2-04-pista-tablet.stitch.png` del checkout principal.
Captura: TODO
Revisor: pendiente
Veredicto del revisor: pendiente
Fecha: 2026-11-20 (implementación; sin captura todavía)

Aprobado por José el 20/11 («sí hazlo»). Web desde 1024 px (`lg:`) y APK desde 900 dp de ancho. Las
justificaciones son mías; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cola a la izquierda, unidad a la derecha | sí | igual (web `lg:grid-cols-[5fr_7fr]`, APK `flex 5 / 7`) | igual |
| Conteo en la cabecera y «Ver PDF» | en una cápsula arriba | conteo sobre la cola; «Ver PDF» al pie, ancho fijo | diferencia justificada: el pie del informe tiene «Ver PDF» y «Publicar» juntos (José 07/11) |
| Fila con asa para arrastrar, número, placa, estado, «Siguiente ↑» | sí | igual; la web arrastra con el asa | igual |
| Unidad enviada al tope de la cola | en línea, «Enviada» | plegada en «Terminadas» bajo la cola | diferencia justificada: una sola pieza para móvil y tablet; plegada no tapa las que esperan |
| Tarjeta: «Unidad 2 · Descargando», placa, «Llegó 08:02 · 15 m³» | sí | igual | igual |
| 4 fotos con su dato (ingreso, temperatura con °C, escantillón la que toca, vacía) | sí | igual, más compactas | igual |
| «Fotos adicionales · 0» con «Agregar» | sí | franja de adicionales con «Agregar foto» | igual |
| «Tomar escantillón» y «Terminar unidad» al pie de la tarjeta | sí | igual, 40 px de alto | igual |
| «Al terminar revisas las fotos y se envían al grupo del cliente» | sí | la línea `UNITS_CLOSE_HINT` sobre la cola | igual |
| «Se enviarán las 4 fotos… al grupo «…»» | sí | no en la tarjeta; lo dice la revisión | diferencia justificada: Lilachat no conoce el nombre del grupo; la revisión ya cuenta las fotos |
| «Reordenado», «Especificación MAC caliente…», «EN DESCARGA» repetido, «Termómetro en masa», «tolva limpia», «OBRA CONCHUCOS», «4G Faena», «PED-2026-0418» | sí | no | invento de Stitch (notas del prototipo) |
| «+ Llegó una unidad» | sí | no | diferencia justificada: las unidades salen de los despachos de Portal; cada una en camino tiene su «Llegó» |
