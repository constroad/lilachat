import { connectDb } from './server/src/db.js';
import { MessageModel } from './server/src/chatModels.js';
await connectDb();
const ms: any[] = await MessageModel.find({ chatId: '6a917994ec51eeb47f2cf92a' }).sort({ seq: 1 }).lean();
for (const m of ms) console.log(m.seq, m.kind, JSON.stringify(m.body), JSON.stringify(m.system ?? null));
process.exit(0);
