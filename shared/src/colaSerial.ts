/**
 * Una cola que corre tareas async de a UNA, en orden de llegada.
 *
 * Existe por el almacén del teléfono (F12): SQLite admite una sola transacción
 * por conexión, y dos escrituras a la vez —el hidratador con una página de 100
 * y un `msg.new` que llega en ese momento— hacían fallar el segundo `BEGIN`.
 * El `ROLLBACK` de ese fallo deshacía la transacción del PRIMERO a mitad de
 * camino: se perdían las dos escrituras sin rastro.
 *
 * Una tarea que falla rechaza SU promesa y la cola sigue: un error de disco en
 * un mensaje no puede dejar trabadas todas las escrituras siguientes.
 */
export type EnCola = <T>(tarea: () => Promise<T>) => Promise<T>;

export function crearColaSerial(): EnCola {
  let ultima: Promise<unknown> = Promise.resolve();
  return <T>(tarea: () => Promise<T>): Promise<T> => {
    const resultado = ultima.then(tarea);
    // La cadena sigue aunque esta tarea falle; el error lo recibe quien la encoló.
    ultima = resultado.catch(() => undefined);
    return resultado;
  };
}
