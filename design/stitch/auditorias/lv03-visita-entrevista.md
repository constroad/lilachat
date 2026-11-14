# Auditoría lv03 · Entrevista

Stitch: `screens/32a018203f8d4829bed09e35af2f7ca2` (design/stitch/lv03-visita-entrevista.png).
Captura: design/stitch/impl/lv03-web-movil.jpg (móvil, 390 px)
Banco local con el documento real de Portal y la pregunta escrita de Test («Área aproximada a pavimentar», m²). En producción se respondió en VIS-2026-0073.
Revisor: subagente independiente (solo vio las dos imágenes). Las faltas que marcó se arreglaron y se recapturó.
Fecha: 2026-11-14 07:50

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Kicker | completo | completo, espaciado 0,08 em (antes cortado) | igual |
| Título y código | 17 pt, código mono sobre gris | 18 px, código sobre gris (antes 20 con borde) | igual |
| «n de m» | lista con check, radio 8 | igual (antes portapapeles y pill) | igual |
| Barra de avance | de borde a borde | igual | igual |
| Fila GPS | GPS activo, ±m, dirección y contacto | igual, en una línea con «…»; el contacto sale si la visita lo tiene | igual |
| Número y tema | «01 · TERRENO BASE» | «01» | diferencia justificada: las preguntas de Portal no traen tema |
| Tarjeta de pregunta | radio 9, separación 16 | radio 10, separación 16 (antes 18 y 12) | igual |
| Opciones | radio 8, texto medio, radio-botón a la derecha | igual (antes casi pill y bold) | igual |
| Elegida | borde de acento, check 20 | igual (antes check 24) | igual |
| Sí / No con ícono | gota, camión | solo texto | diferencia justificada: Portal no manda íconos por respuesta |
| Respuesta escrita con unidad | no se ve en Stitch | campo con «m²» a la derecha, mismo radio que las opciones | diferencia justificada: Portal tiene preguntas de número (Test 14/11) |
| Siguiente | barra fija con fondo y divisor, radio 10 | igual (antes flotaba sin superficie) | igual |
