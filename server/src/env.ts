/**
 * Carga el `.env`, y se importa PRIMERO de todo.
 *
 * En desarrollo el server corre con `node --env-file=.env`, pero **el plist de
 * launchd no pasa esa bandera**: solo declara `NODE_ENV` y `PORT`. Sin esto, en
 * la mini `process.env` no tiene `MONGO_URL` ni `JWT_SECRET` y el proceso se
 * apaga al arrancar — con el deploy en verde, la release activada y el servicio
 * muriéndose en bucle. Torre enlaza el `.env` compartido dentro de la release,
 * así que el archivo está al lado; faltaba leerlo.
 *
 * **Vive en su propio módulo y no dentro de `config.ts` por el orden de ESM**:
 * los imports se evalúan en el orden en que están escritos, y `app.js` viene
 * antes que `config.js` en `index.ts`. Cualquier módulo que lea una variable al
 * importarse la vería vacía. Un archivo aparte, importado en la primera línea,
 * es lo único que garantiza que el `.env` ya esté cargado.
 *
 * `process.loadEnvFile` es de Node 22 y no necesita dependencia. El `try` es
 * para los tests y para un entorno sin archivo, donde las variables llegan
 * directamente y no hay nada que leer.
 */
try {
  process.loadEnvFile();
} catch {
  /* sin `.env` acá: se usan las variables del entorno tal cual */
}
