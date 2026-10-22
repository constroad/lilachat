import { Router } from 'express';
import { validarNombreDePerfil } from '@lilachat/shared';
import { requireSession } from './requireSession.js';
import { UserModel } from './models.js';
import { announceJoin } from './joinNotice.js';
import { buildLilaUploader, toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { multerDeAvatar, subirFotoRedonda } from './subirAvatar.js';

/** Máximo del texto de auto-respuesta: un aviso, no un ensayo. */
const MAX_TEXTO = 300;

/** El perfil como lo ve la app: la foto ABSOLUTA, o `null` sin foto. */
function perfilPublico(user: { name?: string; phone: string; avatarUrl?: string }) {
  return { name: user.name ?? null, phone: user.phone, avatarUrl: user.avatarUrl ? toAbsoluteMediaUrl(user.avatarUrl) : null };
}

/**
 * Ajustes del usuario: la auto-respuesta de ausente (F11) y el perfil —nombre y
 * foto— (FL9). Van acá y no en un chat porque son de la persona, no de una
 * conversación.
 */
export function buildMeRouter(uploader: MediaUploader = buildLilaUploader()): Router {
  const router = Router();
  router.use(requireSession);

  router.put('/perfil', async (req, res) => {
    const validado = validarNombreDePerfil(req.body?.name);
    if (!validado.ok) return res.status(400).json({ message: validado.motivo });
    const user = await UserModel.findByIdAndUpdate(req.session!.userId, { $set: { name: validado.nombre } }, { new: true })
      .select('name phone avatarUrl')
      .lean();
    if (!user) return res.status(404).json({ message: 'No encontramos tu usuario.' });
    // A new account that signed up without a name announces itself now (`joinNotice.ts`).
    void announceJoin(req.session!.userId).catch((error) => console.error('[se-unio] no se pudo avisar:', error instanceof Error ? error.message : error));
    return res.json({ perfil: perfilPublico(user) });
  });

  // La foto en una carpeta POR PERSONA, aparte de los chats: no es media de
  // ninguna conversación.
  router.post('/perfil/foto', multerDeAvatar.single('file'), async (req, res) => {
    const subida = await subirFotoRedonda({
      uploader,
      file: req.file,
      carpeta: `perfil-${req.session!.userId}`,
      nombrePorDefecto: 'perfil.jpg',
      siNoEsImagen: 'La foto de perfil tiene que ser una imagen.',
    });
    if (!subida.ok) return res.status(subida.status).json({ message: subida.message });
    const user = await UserModel.findByIdAndUpdate(
      req.session!.userId,
      { $set: { avatarUrl: subida.url, avatarMediaId: subida.mediaId } },
      { new: true }
    )
      .select('name phone avatarUrl')
      .lean();
    if (!user) return res.status(404).json({ message: 'No encontramos tu usuario.' });
    return res.json({ perfil: perfilPublico(user) });
  });

  router.delete('/perfil/foto', async (req, res) => {
    const user = await UserModel.findByIdAndUpdate(
      req.session!.userId,
      { $unset: { avatarUrl: 1, avatarMediaId: 1 } },
      { new: true }
    )
      .select('name phone avatarUrl')
      .lean();
    if (!user) return res.status(404).json({ message: 'No encontramos tu usuario.' });
    return res.json({ perfil: perfilPublico(user) });
  });

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
      return res.status(400).json({ message: 'Escribe el texto de la auto-respuesta.' });
    }
    await UserModel.updateOne(
      { _id: req.session!.userId },
      { $set: { autoReply: { enabled, text } } }
    );
    res.json({ autoReply: { enabled, text } });
  });

  return router;
}
