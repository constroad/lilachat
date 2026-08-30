import { io } from 'socket.io-client';
const [TOK, CHAT] = process.argv.slice(2);
const s = io('https://lilachat.constroad.com', { auth: { token: TOK }, transports: ['websocket'] });
s.on('connect', () => { console.log('wilson online', s.id); s.emit('sync.pull', { cursors: {} }, ()=>{}); });
// escribe cada 4s para que Jose vea "escribiendo..."
let n=0;
setInterval(() => { s.emit('typing', { chatId: CHAT, on: true }); console.log('typing on', ++n); }, 4000);
setTimeout(() => { s.close(); process.exit(0); }, 180000);
