/**
 * The recorder's own Lilachat: the app and the socket served in this process, WITHOUT the crons
 * (reminders, backups, birthdays, bot deliveries). The base is the shared one, so a second
 * server with crons would send every reminder twice.
 *
 * The session is minted here with the same secret this process verifies with, for a device id
 * of its own. Nothing is typed, no password, and the token never leaves the process.
 */
import { createServer, type Server } from 'node:http';
import { buildApp } from '../../server/src/app.js';
import { attachSocket } from '../../server/src/socket.js';
import { connectDb } from '../../server/src/db.js';
import { UserModel } from '../../server/src/models.js';
import { signSession } from '../../server/src/sessions.js';

export const RECORDER_DEVICE = 'tutorial-recorder';
export const PROFILE_KEY = 'lilachat.perfil';

export type RecorderSession = { jwt: string; profile: { userId: string; phone: string; name?: string; deviceId: string } };

export async function startLocalLilachat(port: number): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  await connectDb();
  const httpServer: Server = createServer(buildApp({}));
  attachSocket(httpServer, {});
  await new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve));
  const close = () => new Promise<void>((resolve) => httpServer.close(() => resolve()));
  return { baseUrl: `http://127.0.0.1:${port}`, close };
}

export async function sessionFor(phone: string): Promise<RecorderSession> {
  const user = await UserModel.findOne({ phone }, { _id: 1, name: 1 }).lean<{ _id: unknown; name?: string }>();
  if (!user) throw new Error(`No hay usuario con el teléfono ${phone}`);
  const userId = String(user._id);
  return {
    jwt: signSession({ userId, deviceId: RECORDER_DEVICE, email: phone }),
    profile: { userId, phone, name: user.name, deviceId: RECORDER_DEVICE },
  };
}
