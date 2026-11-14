# Auditoría lv01 · Tarjeta de la visita

Stitch: `screens/d830679c9ffb4c72b4890930633d8321` (design/stitch/lv01-visita-chat.png).
Captura: design/stitch/impl/lv01-web-movil.jpg (móvil, 390 px)
Banco local con la tarjeta que arma el builder real de agentes (8223426). En producción se verificó en Test, VIS-2026-0072.
Revisor: subagente independiente (solo vio las dos imágenes). Las faltas que marcó se arreglaron y se recapturó.
Fecha: 2026-11-14 07:55

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Barra de acento | 3 pt | igual | igual |
| Radio de la tarjeta | 8–10 pt | 10 px (antes 20) | igual |
| Kicker | «VISITA TÉCNICA ·» en acento y el código en mono gris | igual (antes todo en acento, espaciado ancho) | igual |
| Estado | pastilla neutra, radio 6 | igual (antes lila y redonda) | igual |
| Título | 18 pt | 18 px | igual |
| Dirección | una línea con pin y «…» | igual (antes 2 líneas) | igual |
| Mapa | 123 pt, borde 1 px, radio 8 | 125 px, borde, radio 8 (antes 170, sin borde) | igual |
| Badge GPS | «● GPS ACTIVO · ±6 m» en mono | igual, abajo a la izquierda (a la derecha va la atribución de OSM) | igual |
| Marcadores | 20 pt, borde blanco, con nombre | 20 px, borde blanco, número o «F» | diferencia justificada: Portal no manda nombre por punto |
| Lugar | edificio con «ACCESO» | edificio con «LUGAR» al costado, sin tapar los puntos | igual |
| Línea de ruta | punteada fina | punteada fina (antes discontinua gruesa) | igual |
| Encuadre | los puntos llenan el mapa | zoom hasta 19; con puntos a pocos metros quedan juntos | diferencia justificada: depende de la distancia real |
| Cifras | fondo gris, radio 8, «6» grande y «de 10» chico en mono | igual (antes borde blanco, todo bold) | igual |
| Faltantes | al pie, con PENDIENTE | al pie, debajo de los botones (antes sobre los botones) | igual |
| Botones | rectángulo radio 8–10, 2×2 | radio 10, primario a lo ancho + 2×2 (5 botones, el 5.º es Abrir croquis) | diferencia justificada: José pidió el croquis en la tarjeta |
| «Abrir croquis» | — | una línea (antes partía en dos) | igual |
| Íconos | cámara, lista, cámara+, check | cámara, lista, imagen+, check, mapa | diferencia justificada: el set de íconos no tiene cámara+ |
| Pie «Actualizada por …» | no tiene | con la hora | diferencia justificada: la tarjeta se redibuja y la hora dice cuándo |

Segunda revisión (mismo revisor, solo imágenes): quedaban la etiqueta del lugar sobre los puntos (pasó al lado del edificio), el ícono de Entrevista (ahora lista con check), el título (18 px) y el tamaño de los marcadores (medidos en el DOM: 20 px; la estimación salió de la imagen reducida). «Foto suelta» sigue con imagen+: el set de íconos no tiene cámara+ (diferencia justificada).
