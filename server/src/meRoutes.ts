import { Router } from 'express';
import { isPresenceMode, validarNombreDePerfil, type PresenceMode } from '@lilachat/shared';
import { requireSession } from './requireSession.js';
import { UserModel } from './models.js';
import { announceJoin } from './joinNotice.js';
import { contactIdsOf, presenceFrameOf, prefsFromUser, rememberPresencePrefs } from './presenceModes.js';
import { emitPresence } from './reparto.js';
import { toAbsoluteMediaUrl, type MediaUploader } from './mediaClient.js';
import { defaultMediaUploader } from './localMediaUploader.js';
import { multerDeAvatar, subirFotoRedonda } from './subirAvatar.js';
import { personalSwitch } from './pushPreview.js';

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
export function buildMeRouter(uploader: MediaUploader = defaultMediaUploader()): Router {
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

  // The presence I choose and my «últ. vez» (pending 15): saved, kept for the socket, told to my contacts.
  router.get('/presence', async (req, res) => {
    const user = await UserModel.findById(req.session!.userId).select('presenceMode lastSeenHidden').lean();
    res.json(prefsFromUser(user));
  });

  router.put('/presence', async (req, res) => {
    const userId = String(req.session!.userId);
    if (!isPresenceMode(req.body?.mode)) return res.status(400).json({ message: 'Elige En línea, Ausente, Ocupado o Invisible.' });
    const prefs = { mode: req.body.mode as PresenceMode, lastSeenHidden: req.body?.lastSeenHidden === true };
    await UserModel.updateOne({ _id: userId }, { $set: { presenceMode: prefs.mode, lastSeenHidden: prefs.lastSeenHidden } });
    rememberPresencePrefs(userId, prefs);
    res.json(prefs);
    void contactIdsOf(userId).then((contacts) => emitPresence(contacts, presenceFrameOf(userId))).catch(() => undefined);
  });

  // «Confirmaciones de lectura» (R31/10): on unless turned off; groups always tell «leído».
  personalSwitch(router, '/read-receipts', 'readReceiptsOff', 'Elige si se envían o no.');
  // R31/10-B8: the notices' preview.
  personalSwitch(router, '/notification-preview', 'pushPreviewOff', 'Elige si se muestra o no.');

  return router;
}
