import mongoose from 'mongoose';

/**
 * MongoDB de **bóveda** (el mongod de la mini), base `lilachat_db`, desde el
 * 16/10/2026. Antes era Atlas: el server corría en la mini y cada consulta
 * cruzaba internet (el envío encadenaba 5 viajes antes del ack). La copia de
 * Atlas quedó CONGELADA: leerla no falla, da datos viejos.
 *
 * La URI (usuario `lilachat_app`, solo desde la mini) la carga bóveda directo
 * en `MONGO_URL` de la app `chat` en Torre; en la laptop, `lilachat_dev` por el
 * túnel (`boveda tunel`). Sin default: config ausente FALLA diciéndolo
 * (`deploy-mini` §6).
 */
export async function connectDb(): Promise<void> {
  const url = process.env.MONGO_URL || '';
  if (!url) throw new Error('MONGO_URL es obligatorio (bóveda, base lilachat_db)');
  // No index or collection is created on its own (memory `boveda-no-autoindex`): they go by hand, with a plan.
  // On 21/10 a dry-run that imported the models created the E1 indexes because this was missing.
  await mongoose.connect(url, { autoIndex: false, autoCreate: false });
  // Sin `new URL(url)`: las URIs de Mongo multi-host (host1,host2,…) no son
  // URLs válidas para WHATWG y el throw acá mató al seed DESPUÉS de conectar.
  console.log('[lilachat] mongo conectado');
}
