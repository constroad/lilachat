# Auditoría pv2-02-pista-unidad-foto-dato · Control de pista › el dato en la vista previa de la foto (móvil)

Stitch: `.stitch-work/out_v2/mobile/pv2-02-pista-unidad-foto-dato.stitch.png` del checkout principal.
Captura: TODO
Revisor: pendiente
Veredicto del revisor: pendiente
Fecha: 2026-11-20 (implementación; sin captura todavía)

Aprobado por José el 20/11 («sí hazlo»). La foto se toma con la cámara de siempre (sello Timemark, «Repetir» /
«Usar foto»); al volver, el formulario de la foto muestra la vista previa y, justo debajo, el dato
(`withPhotoMeasure`). Las justificaciones son mías; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Título «D5N-227 · Unidad 2 · Foto 3 de 4 · Escantillón» | sí | el título de siempre del formulario de la foto (unidad y foto) | diferencia justificada: es el título de siempre de la foto de una unidad; no hay «Foto N de 4» en el documento |
| Íconos de las 4 fotos arriba | sí | no | diferencia justificada: la tarjeta de la unidad ya los muestra al volver |
| Vista previa de la foto con su sello (fecha, hora, ± m, calle) | sí | igual (sello Timemark de la cámara) | igual |
| «Espesor (cm)» / «Temperatura (°C)» bajo la foto | sí | campo numérico «Escantillón (cm)» / «Temperatura (°C)» justo bajo la foto, con lo que la unidad ya tenía | igual |
| Teclado numérico | propio, dibujado | el teclado decimal del sistema (`inputMode="decimal"`, `decimal-pad`) | diferencia justificada: el del sistema hace lo mismo y no tapa el formulario |
| «Diseño 5 cm · En rango» | sí | no | diferencia justificada: Portal no manda el espesor de diseño ni el rango; José: «rango/pill cuando se conozca» |
| «Repetir» y «Usar foto · 5,1 cm» | sí | «Repetir» / «Usar foto» en la cámara; «Guardar foto» en el formulario | diferencia justificada: el texto del botón es fijo; el dato se ve en el campo |
| El dato se guarda con la foto | — | al guardar, la foto va por `agregar_foto_de_informe` y el dato por `guardar_seccion_de_informe` (sección `unidad`), con lo que la unidad ya tenía | igual |
| Chip «PED-2026-0418 · …», regla dibujada, «Tolerancia ±0,5 cm» | sí | no | invento de Stitch (notas del prototipo) |
