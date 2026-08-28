import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { UserModel } from '../server/src/models.js';
import { ChatModel } from '../server/src/chatModels.js';
import { signSession } from '../server/src/sessions.js';
const main = async () => {
  await connectDb();
  const yo = await UserModel.findOne({ phone: '902049935' }).lean();
  const w = await UserModel.findOne({ phone: '960397018' }).lean();
  const chat = await ChatModel.findOne({ kind: 'direct', 'members.userId': { $all: [yo!._id, w!._id] } }).lean();
  writeFileSync('/tmp/qa2.txt', `${String(chat!._id)}\n${signSession({ userId: String(w!._id), deviceId: 'qa-push', email: 'qa@constroad.com' })}`);
  console.log('listo'); await mongoose.disconnect(); process.exit(0);
};
void main();
