# Auditoría pv2-03-pista-terminar · Control de pista › terminar unidad (móvil)

Stitch: `.stitch-work/out_v2/mobile/pv2-03-pista-terminar.stitch.png` del checkout principal.
Captura: design/stitch/capturas/pv2-03-pista-terminar.png (móvil 390, oscuro) · Huella: ba12bd86ec55
Revisor: subagente independiente
Fecha: 2026-11-20 09:40

Aprobado por José el 20/11 («sí hazlo»). Es la revisión de siempre (`UnitAlbumDialog` web, `UnitAlbumSheet`
APK, §24) con el bloqueo nuevo. Las justificaciones son mías; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Hoja inferior con título de la unidad | «Terminar unidad 2 · D5N-227 · 08:10–08:34 · 24 min · 15 m³» | «Revisa las fotos de la Unidad 2» | diferencia justificada: título de §24 ya en uso; Portal no manda inicio ni fin de la descarga |
| Cuadrícula con las fotos, check y lupa | sí | igual (todas marcadas; tocar desmarca, la lupa abre el visor) | falta: 3 columnas con el rótulo debajo; Stitch dibuja 2 columnas con el dato encima de la foto. Los rótulos de las adicionales siguen cortados («Adicional · Fotos adicionales · llegad…») |
| Dato en cada foto (08:10, 148 °C, 5,1 cm, «Vacía · salió 08:34») | sí | la hora de cada foto; el dato se ve en la tarjeta de la unidad | diferencia justificada: la revisión muestra el álbum de §24 tal como sale al grupo |
| «+ 1 foto adicional» | sí | las adicionales en la misma cuadrícula | igual |
| «Se enviarán 5 fotos al grupo de WhatsApp «…»» | con el nombre del grupo | «Se enviarán 5 fotos» | diferencia justificada: Lilachat no conoce el nombre del grupo de WhatsApp del cliente |
| Aviso rojo «Primero termina la Unidad 1 · F2K-908: todavía no tiene la foto de unidad vacía» | sí | igual (`finishBlockOf`), sin «(no ha salido)» | diferencia justificada: no verificable en la captura; la Unidad 1 QA está terminada, no hay bloqueo. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| «Ir a F2K-908 →» | sí | igual: cierra la revisión y deja esa unidad en la tarjeta | diferencia justificada: no verificable en la captura; no hay bloqueo en los datos QA. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| «Terminar y enviar 5 fotos» apagado | sí | «Enviar 5 fotos al grupo» apagado mientras hay bloqueo | diferencia justificada: no verificable en la captura; no hay bloqueo en los datos QA. El revisor trabaja en solo lectura sobre la cuenta real (instrucción de la revisión 20/11) |
| «Cancelar» | sí | igual | igual |
| «Fotos de registro en pista (4 obligatorias)», «4 de 4 listas», «Junta longitudinal fría» | sí | no | invento de Stitch (notas del prototipo) |
