import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { UserModel } from '../server/src/models.js';
import { signSession } from '../server/src/sessions.js';

/** QA 27/08: manda un mensaje COMO el otro, para ver la burbuja de aviso real. */
const main = async () => {
  await connectDb();
  const otro = await UserModel.findOne({ phone: '999888777' }).lean();
  const jwt = signSession({
    userId: String(otro!._id),
    deviceId: 'qa-27-08',
    email: 'qa@constroad.com',
  });
  console.log(jwt);
  await mongoose.disconnect();
  process.exit(0);
};
void main();
