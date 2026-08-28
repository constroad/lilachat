import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { InvitationModel } from '../server/src/models.js';
const TEL='902049935', REAL='jose.zena.zamora@gmail.com', QA='jose.test@yopmail.com';
const main = async () => {
  await connectDb();
  await InvitationModel.updateOne({ phone: TEL }, { $set: { email: process.argv.includes('--restaurar') ? REAL : QA } });
  console.log('listo'); await mongoose.disconnect(); process.exit(0);
};
void main();
