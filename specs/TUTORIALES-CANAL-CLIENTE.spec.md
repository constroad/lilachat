# Tutoriales del canal de cliente

> José, 08/11/2026: «créame tutoriales para el canal del cliente: cómo crear los informes (los 2
> que tenemos), el mapa al 100 % sin omitir nada, y el Drive. Me parece que no tiene las buenas
> prácticas de cómo dibujar un mapa de obra, sobre todo el progreso por capas».
> Método: skill `tutorial-video-loop` (Portal, `ACADEMY-TUTORIALS.as-is.md` §9).

## 1. Estado

- Lilachat no tenía tutoriales: ni grabador, ni guiones, ni lugar donde verlos. Esto es el
  catálogo y la guía. El grabador y el visor son la fase siguiente (§5).
- Cada video HACE la tarea en el espacio Test y se graba en móvil (390×844), porque el canal de
  cliente se usa en obra.

## 2. Catálogo (en el orden del trabajo)

| # | Tutorial | Hace | Queda en la base | Min |
| --- | --- | --- | --- | --- |
| 1 | Dibujar la calle de la obra | Busca el lugar o pega el enlace del cliente, toca la calle, arrastra los extremos, pone el ancho y la etapa, y guarda | Una calle | 3 |
| 2 | Partir la obra en etapas y trabajos | Crea la etapa y el trabajo; con «Tocar calles» los pinta sobre cada calle | Etapa, trabajo, tramos | 3 |
| 3 | Tramos de una calle | En «Ver tramos», agrega un tramo de 0+000 a 0+120 con sus trabajos y su ancho | Un tramo | 2½ |
| 4 | Control de pista (CTL-PIS) | Crea el informe, elige el pedido y las unidades, y por cada unidad registra llegada, temperaturas y sus 4 fotos con GPS; después publica | Informe y fotos ubicadas | 4½ |
| 5 | Confirmar el avance de las unidades | Lee «Avance que marcan las unidades», ajusta el tramo si hace falta y confirma | Avance pendiente de aprobar | 2 |
| 6 | Control de imprimación (CTL-IMP) | Crea el informe, registra la tasa de riego por tramo con bandejas y fotos, y publica | Informe y fotos ubicadas | 4 |
| 7 | Registrar avance a mano | Elige la calle y el trabajo, y marca hasta dónde con ±10 m o «Mi GPS», con foto | Avance pendiente | 2½ |
| 8 | Caminar la calle con GPS | Usa «Empezar», «Pausa», «Seguir», «Deshacer» y «Terminar» | Una calle | 2 |
| 9 | Ver la obra: filtros, fotos y avance | Recorre los filtros de etapa, trabajo y fecha, y la capa «Fotos»; abre las fotos de un punto | Nada: es un recorrido | 2 |
| 10 | Compartir y exportar el avance | Elige un corte, crea el enlace seguro y lo suma al PDF del informe; después exporta | Un enlace y una hoja en el PDF | 3 |
| 11 | El Drive del servicio | Sube fotos y videos, los agrega desde el Drive a un informe y ve quién subió qué | Archivos en el Drive | 2½ |

El 9 es un recorrido: el mapa de lectura no tiene una acción principal.

## 3. Buenas prácticas para dibujar el mapa (van en los guiones 1–3 y 7)

1. **Primero el lugar, después la calle.**
   - Pega el enlace de Google Maps que mandó el cliente, o busca la dirección.
   - Si el servicio ya trae su ubicación, el mapa abre ahí.
   - No dibujes desde la oficina guiándote por el GPS del teléfono.
2. **Una calle del mapa = una vía real.**
   - Usa «Tocar la calle»: sigue el eje real y le pone su nombre.
   - Usa «A mano» solo para un pasaje que el mapa no tiene.
   - Usa «Caminar GPS» cuando el eje no se ve en el mapa (trocha, obra nueva).
3. **Recorta, no inventes.**
   - La calle se toca entera y se arrastran los extremos hasta donde va la obra.
   - Los ±10 m sirven para el ajuste fino.
   - El 0+000 es TU inicio, no el inicio de la vía en el mapa.
4. **El ancho va siempre.** Sin ancho no hay m² ni volumen, y Portal no puede calcular el metrado.
5. **Etapas para el tiempo, trabajos para las capas.**
   - Etapa: el frente o la fase del contrato («Etapa 1 · Cuadras 1–5»).
   - Trabajo: cada capa que se mide por separado: base, imprimación, carpeta asfáltica.
   - Una calle lleva varios trabajos, y cada uno avanza por su cuenta.
6. **Avance por capas, en el orden de la obra.**
   - Primero la base, después la imprimación y al final la carpeta.
   - Una capa no puede ir más adelante que la de abajo. Si el mapa lo muestra así, está mal
     registrado.
7. **El avance sale de la evidencia.**
   - Cada foto de informe va con su ubicación.
   - En el Control de pista, las fotos de cada unidad ya marcan el tramo; solo hay que
     confirmarlo.
   - En el Control de imprimación, las fotos del riego marcarán el tramo cuando Portal lo active
     (`MAPA-OBRA.spec.md`, propuesta del 08/11).
   - El avance a mano queda para lo que no tiene informe.
8. **Nada suma hasta que se confirma.**
   - Lo que sugieren las unidades está pendiente hasta que el ingeniero lo confirma.
   - Lo confirmado lo aprueba el residente en Portal.
9. **Revisa con la capa «Fotos»** que cada tramo con avance tenga fotos encima. Un tramo sin
   fotos es avance sin respaldo.

## 4. La data del espacio Test que hace verdadero lo narrado

- Servicio QA-CTLPIS, con el cliente Consorcio Vial del Pacífico.
- «QA-MAPA calle — borrar»: 191 m, con un tramo de 0 a 120 m y el trabajo «Asfalto QA».
- «QA-MAPA calle 2 — borrar»: 103 m, en Jirón Moquegua, sin etapa.
- «Etapa QA», y un Control de pista con 4 unidades: 3 en la calle y 1 fuera.
- Falta: un Control de imprimación con fotos ubicadas y dos días de avance aprobado (o-09).
- En cámara no puede verse «QA» ni «borrar». El grabador renombra para cámara (skill §6) o se
  siembra un servicio demo con nombres reales de obra.

## 5. Lo que falta construir (fase siguiente)

- **Grabador**:
  - Playwright con Chrome for Testing, overlay con los tokens de la app y voz `say` (Paulina);
  - WebM, después MP4 en el server;
  - portado de Portal con su motor puro y sus tests.
- **Dónde se ven**: en el media de Lilachat, no en el repo. Falta decidir el lugar del canal
  donde aparecen (ver §6).
- **Ensayo**: cada guion corre como E2E sin voz cuando cambia su pantalla.

## 6. Abierto (decisión de José)

- Dónde aparecen en el canal de cliente: una pestaña «Ayuda» del servicio, un botón «?» en cada
  pantalla, o la Academia de Portal.
