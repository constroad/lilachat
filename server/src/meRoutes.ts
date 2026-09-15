import { Router } from 'express';
import { requireSession } from './requireSession.js';
import { UserModel } from './models.js';

/** Máximo del texto de auto-respuesta: un aviso, no un ensayo. */
const MAX_TEXTO = 300;

/**
 * Ajustes del usuario. Por ahora solo la auto-respuesta de ausente (F11); van
 * acá y no en un chat porque son de la persona, no de una conversación.
 */
export function buildMeRouter(): Router {
  const router = Router();
  router.use(requireSession);

  router.get('/auto-reply', async (req, res) => {
    const user = await UserModel.findById(req.session!.userId)
      .select('autoReply')
      .lean<{ autoReply?: { enabled?: boolean; text?: string } } | null>();
    res.json({
      autoReply: {
        enabled: user?.autoReply?.enabled === true,
        text: user?.autoReply?.text ?? '',
      },
    });
  });

  router.put('/auto-reply', async (req, res) => {
    const enabled = req.body?.enabled === true;
    const text =
      typeof req.body?.text === 'string' ? req.body.text.slice(0, MAX_TEXTO).trim() : '';
    // Encendida sin texto no sirve: mandaría un mensaje vacío.
    if (enabled && !text) {
      return res.status(400).json({ message: 'Escribí el texto de la auto-respuesta.' });
    }
    await UserModel.updateOne(
      { _id: req.session!.userId },
      { $set: { autoReply: { enabled, text } } }
    );
    res.json({ autoReply: { enabled, text } });
  });

  return router;
}
