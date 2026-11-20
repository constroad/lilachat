# Auditoría pv2-01-pista-cola · Control de pista › cola de descarga (móvil)

Stitch: `.stitch-work/out_v2/mobile/pv2-01-pista-cola.stitch.png` del checkout principal.
Captura: TODO
Revisor: pendiente
Veredicto del revisor: pendiente
Fecha: 2026-11-20 (implementación; sin captura todavía)

Aprobado por José el 20/11 («sí hazlo»). Las justificaciones de abajo son mías y dicen el motivo real;
ninguna es una exención de José. Lo inventado por Stitch que el prototipo manda ignorar no se implementa.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Cabecera «Control de pista · hoy», obra, «Borrador», «Ver PDF» | arriba a la derecha | cabecera del informe de siempre; «Ver PDF» al pie, junto a «Publicar», con ancho fijo (`w-36`) | diferencia justificada: el pie ya tenía «Ver PDF» y «Publicar» en una línea (José 07/11); el ancho fijo cumple «nunca se desborda» |
| Conteo «5 unid. · 1 enviada · 1 descargando · 3 en cola · 15 / 75 m³» | sí | `queueCountsLine` + `queueVolumeLine`; «en cola» y «en camino» van por separado | igual |
| «Descargando ahora» con la unidad, su estado y m³ | sí | `UnitCardWeb` / `UnitCardView`: unidad, placa, «Descargando», «Llegó 08:02 · 15 m³» | igual |
| «Empezó 08:10» | sí | no | diferencia justificada: Portal no manda la hora de inicio de la descarga en el documento |
| 4 fotos: ingreso, temp. con «148 °C», escantillón (la que toca, punteada), vacía | sí | igual (`slotMeasureOf`, `nextSlotOf`) | igual |
| «Tomar escantillón» y «Terminar unidad» compactos | sí | igual, 40 px de alto | igual |
| «Cola de descarga · orden en campo · Tú decides el orden» | sí | igual (`QUEUE_TITLE`, `QUEUE_HINT`) | igual |
| Fila: asa, número, placa, «En cola», «Llegó 08:20 · 15 m³», «Siguiente ↑» | sí | igual; en el APK no hay asa (solo «Siguiente ↑», lo permitido por José) | igual |
| «la moviste detrás» / fila resaltada | sí | no | diferencia justificada: Lilachat no guarda quién movió qué; la fila elegida sí se resalta |
| Unidad «En camino» atenuada | con «En ruta» | atenuada, con «Llegó» compacto para registrar su llegada | diferencia justificada: «En ruta» es invento de Stitch; sin «Llegó» la unidad no podría entrar a la cola |
| «Terminadas 1» plegable | sí | igual (`ver-terminadas`) | igual |
| «Llegó una unidad» abajo | sí | no | diferencia justificada: las unidades salen de los despachos de Portal; cada una en camino tiene su «Llegó» |
| «Asfalto en tolva», «En progreso», «TOCA» | sí | no | invento de Stitch (notas del prototipo) |
