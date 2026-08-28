import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { UserModel } from '../server/src/models.js';
import { ChatModel } from '../server/src/chatModels.js';

/** QA 27/08: chat con alguien SIN nombre cuyo numero SI esta en la agenda del emulador. */
const YO = '900000006';
const OTRO = '999888777';

const main = async () => {
  await connectDb();
  const yo = await UserModel.findOne({ phone: YO }).lean();
  const otro = await UserModel.findOneAndUpdate(
    { phone: OTRO },
    { $setOnInsert: { phone: OTRO } },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  let chat = await ChatModel.findOne({
    kind: 'direct',
    'members.userId': { $all: [yo!._id, otro!._id] },
  }).lean();
  if (!chat) {
    chat = (
      await ChatModel.create({
        kind: 'direct',
        members: [{ userId: yo!._id }, { userId: otro!._id }],
        lastSeq: 0,
      })
    ).toObject();
  }
  console.log('chat con', OTRO, ':', String(chat!._id));
  await mongoose.disconnect();
  process.exit(0);
};
void main();
