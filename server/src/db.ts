import mongoose from 'mongoose';

/**
 * MongoDB Atlas, base `lilachat_db` en el cluster existente (decisión de José,
 * 20/08/2026 — reemplaza al mongod local del plan inicial: toda la operación ya
 * vive en Atlas y un mongod propio agregaba mantenimiento sin usuarios que lo
 * justifiquen). Base SEPARADA de `constroad_db`: el chat escribe chatty y no
 * comparte colecciones con el ERP.
 *
 * La URI lleva credenciales → va en `MONGO_URL` del `.env`, sin default:
 * config declarada y ausente FALLA diciéndolo (`deploy-mini` §6).
 */
export async function connectDb(): Promise<void> {
  const url = process.env.MONGO_URL || '';
  if (!url) throw new Error('MONGO_URL es obligatorio (Atlas, base lilachat_db)');
  await mongoose.connect(url);
  // Sin `new URL(url)`: las URIs de Mongo multi-host (host1,host2,…) no son
  // URLs válidas para WHATWG y el throw acá mató al seed DESPUÉS de conectar.
  console.log('[lilachat] mongo conectado');
}
