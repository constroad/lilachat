import { Router } from 'express';
import { Types } from 'mongoose';
import { catchUp, draftEvent, EncryptedChatError, NotAMemberError } from './assistantService.js';
import { ReceiptModel } from './chatModels.js';
import { asyncRoute, requireSession } from './requireSession.js';

/**
 * Las rutas del asistente (F8).
 *
 * Hay un **freno por usuario** además del permiso: el asistente cuesta dinero
 * por llamada, y un botón que se puede tocar veinte veces seguidas es una
 * factura esperando a pasar. Vive en memoria del proceso, que alcanza para una
 * familia — no hace falta una colección para esto.
 */
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 6;
const llamadas = new Map<string, number[]>();

function permitir(userId: string, ahora = Date.now()): boolean {
  const recientes = (llamadas.get(userId) ?? []).filter((at) => ahora - at < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) {
    llamadas.set(userId, recientes);
    return false;
  }
  recientes.push(ahora);
  llamadas.set(userId, recientes);
  return true;
}

/** Para los tests y para no arrastrar estado entre corridas. */
export function resetAssistantLimits(): void {
  llamadas.clear();
}

const asObjectId = (value: unknown): Types.ObjectId | null =>
  Types.ObjectId.isValid(String(value)) ? new Types.ObjectId(String(value)) : null;

export function buildAssistantRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.use((req, res, next) => {
    if (!permitir(String(req.session!.userId))) {
      res.status(429).json({ message: 'Dale un respiro a Lila. Prueba en un minuto.' });
      return;
    }
    next();
  });

  router.post('/catch-up', asyncRoute(async (req, res) => {
    const chatId = asObjectId(req.body?.chatId);
    // El id inválido se trata como el chat ajeno: mismo 403, sin confirmar nada.
    if (!chatId) {
      res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
      return;
    }

    try {
      // Desde MI cursor de lectura: resumirle a alguien lo que ya leyó es ruido,
      // y en un chat de años sería carísimo.
      const receipt = await ReceiptModel.findOne({ chatId, userId: req.session!.userId })
        .select('readSeq')
        .lean();

      const resultado = await catchUp({
        chatId,
        userId: req.session!.userId,
        sinceSeq: receipt?.readSeq ?? 0,
      });

      if (!resultado.ok) {
        res.status(resultado.code === 'sin_configurar' ? 503 : 502).json({
          message: resultado.message,
        });
        return;
      }
      res.json({ text: resultado.text, messageCount: resultado.messageCount ?? 0 });
    } catch (error) {
      if (error instanceof NotAMemberError) {
        res.status(403).json({ message: error.message });
        return;
      }
      // 409 y no 403: no es que falte permiso, es que el contenido no existe
      // en el server. Distinguirlos deja que la interfaz lo explique bien.
      if (error instanceof EncryptedChatError) {
        res.status(409).json({ message: error.message });
        return;
      }
      throw error;
    }
  }));

  router.post('/event-draft', asyncRoute(async (req, res) => {
    const chatId = asObjectId(req.body?.chatId);
    const text = String(req.body?.text ?? '').trim();
    if (!chatId) {
      res.status(403).json({ message: 'No tienes acceso a esa conversación.' });
      return;
    }
    if (!text) {
      res.status(400).json({ message: 'Escribe de qué es el evento.' });
      return;
    }

    try {
      const resultado = await draftEvent({ chatId, userId: req.session!.userId, text });
      if (!resultado.ok) {
        // 422: se entendió el pedido, no se pudo armar el evento. Distinto de
        // un 500, que haría pensar que el servidor está roto.
        res.status(422).json({ message: resultado.message });
        return;
      }
      res.json({ draft: resultado.draft });
    } catch (error) {
      if (error instanceof NotAMemberError) {
        res.status(403).json({ message: error.message });
        return;
      }
      // 409 y no 403: no es que falte permiso, es que el contenido no existe
      // en el server. Distinguirlos deja que la interfaz lo explique bien.
      if (error instanceof EncryptedChatError) {
        res.status(409).json({ message: error.message });
        return;
      }
      throw error;
    }
  }));

  return router;
}
