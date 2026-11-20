# Auditoría mapa-v2-escritorio · Servicio › Mapa en la web ancha y la tablet

Stitch: `.stitch-work/out_v2/desktop/mapa-v2-escritorio.stitch.png` (+ `.html`) del checkout principal.
Captura: TODO
Revisor: pendiente
Fecha: 2026-11-20 (auditoría escrita contra el código; sin captura ni E2E todavía)

Rediseño aprobado por José el 20/11 («Rediseño 20/11» en INVENTARIO). Su queja con captura: los
botones desordenados en la web, el cliente repetido y el espacio perdido arriba. Las justificaciones
de abajo son mías y dicen el motivo real; ninguna es una exención de José.

| Elemento | Stitch | Implementación | Estado |
| --- | --- | --- | --- |
| Servicio y pestañas en una fila: «‹ Servicios», nombre, estado, avance, inicio, pestañas | sí | igual en la pestaña Mapa (`SlimWideHead`); la línea «Avance 40 % · Inicio 12 nov» se ve desde 1280 px | igual |
| «◔ 40 %» como chip propio | sí | dentro de la línea «Avance 40 % · …» | diferencia justificada: la línea existente ya lo dice; un chip más no cabía junto a las pestañas en 1024 px |
| Cliente repetido bajo el canal | no | no (sin «Servicio · CLIENTE» en Mapa) | igual |
| Enlace del servicio y ⋮ | no visibles | ícono de enlace y ⋮ al final de la fila | diferencia justificada: funciones existentes de la cabecera (cc-02) |
| Chips de día flotando «Todos · Vie 20/11 18 · Jue 19/11…» | sí | igual, con la cuenta del día | igual |
| Un grupo segmentado «Capas \| Editar croquis \| Más» | sí | igual (`MapToolGroup`) | igual |
| «Más» con «Compartir avance» y «Pantalla completa» | sí (diseño móvil) | igual, primero; debajo lo de antes | igual |
| «Registrar avance» | no | botón al lado del grupo, para quien edita y con calles | diferencia justificada: función existente (o-06) |
| «Hasta hoy» y trabajo | no sobre el mapa | flotando bajo los días | diferencia justificada: el corte y el trabajo cambian las cifras; ya estaban sobre el mapa |
| Panel «Capas y leyenda» flotando a la derecha con ✕ | sí | tarjeta a la derecha del mapa, siempre abierta; «Capas» pliega su sección | diferencia justificada: el panel lleva también el avance, lo pendiente y las listas; cerrarlo entero los esconde |
| Partidas con interruptor y % | sí | igual (`MapLayersPanel`) | igual |
| Fotos · 50 con sub-capas por informe y su cuenta | sí | igual (sub-capas de `reportPhotoLayers`) | igual |
| Observaciones · Pendientes / Levantadas, Dibujos · 12 | sí | igual | igual |
| «Avance de la obra · Hasta hoy, 20 nov» y barra | sí | igual (`WorkMapPanel`, «Corte: …») | igual |
| «En plazo» | sí | no | diferencia justificada: Portal no manda plazo; Stitch lo inventó |
| «12 parches registrados · 5 despachos programados» | sí | no | diferencia justificada: texto inventado; el panel muestra metros y listas reales |
| Tarjeta de parche con fotos y «Editar ficha» | sí | tarjeta del dibujo con sus fotos, sin «Editar ficha» | diferencia justificada: «Editar ficha» no existe; se edita en «Editar croquis» |
| Leyenda flotando abajo | sí | igual, por trabajo, «Pendiente de ejecución» y «Por aprobar (N)» | igual |
| Escala y «EPSG:32718 WGS84» en la leyenda | sí | no | diferencia justificada: invención de Stitch |
| Zoom, GPS y pantalla completa abajo a la derecha | sí | zoom y GPS de MapLibre; pantalla completa en «Más» | diferencia justificada: José pidió la pantalla completa dentro de «Más» |
| Barra «Lilachat Web · CONSTROAD Enterprise», «Llamar», «3 servicios activos» | sí | no | diferencia justificada: invenciones de Stitch fuera de esta pantalla |
| «MZA.», «Subestación & Depósitos», nombres de calles inventados | sí | mapa base real | diferencia justificada: invención de Stitch |
