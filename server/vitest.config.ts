import { defineConfig } from 'vitest/config';

/**
 * Config de los tests del server.
 *
 * **Un proceso por archivo, y de a uno.** Trece archivos de test llaman a
 * `mongoose.connect()` sobre la MISMA instancia global, y cada uno hace
 * `mongoose.disconnect()` en su `afterAll`. Corriendo en paralelo, la
 * desconexión de un archivo mata las consultas en vuelo de otro:
 *
 *     Operation interrupted because client was closed
 *
 * Los 161 tests PASAN y el proceso igual sale con 1, porque vitest cuenta ese
 * error de fondo. En CI eso frena el job de deploy —`needs: verificar`— y el
 * deploy nunca se dispara: el síntoma es «no pasa nada», no «falló un test».
 *
 * Se arregla acá y no repartiendo `mongoose.disconnect()` por trece archivos:
 * el aislamiento es del RUNNER, y depender de que nadie vuelva a escribir un
 * `connect` global es depender de la memoria de quien escriba el próximo test.
 */
export default defineConfig({
  test: {
    // `forks` da un proceso por archivo: cada uno con su propio mongoose.
    pool: 'forks',
    // Y de a uno: dos procesos a la vez pelean por el mongod en memoria y por
    // los puertos que abren los tests de socket.
    fileParallelism: false,
    // Los de socket levantan servidores reales y son más lentos que el default.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
