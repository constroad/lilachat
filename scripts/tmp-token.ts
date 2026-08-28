import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDb } from '../server/src/db.js';
import { UserModel, DeviceModel } from '../server/src/models.js';
const main = async () => {
  await connectDb();
  const yo = await UserModel.findOne({ phone: '902049935' }).lean();
  const devs = (await DeviceModel.find({ userId: yo!._id }).lean()) as { pushToken?: string }[];
  const con = devs.filter((d) => d.pushToken);
  console.log(`devices: ${devs.length} · con token FCM: ${con.length}`);
  if (con[0]?.pushToken) {
    console.log(`token: ${con[0].pushToken.slice(0, 30)}…`);
    writeFileSync('/tmp/fcm-token.txt', con[0].pushToken);
  }
  await mongoose.disconnect(); process.exit(0);
};
void main();
