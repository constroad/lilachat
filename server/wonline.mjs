import { io } from 'socket.io-client';
const s = io('https://lilachat.constroad.com', { auth:{token:process.argv[2]}, transports:['websocket'] });
s.on('connect', ()=>console.log('wilson online (solo presencia)', s.id));
setTimeout(()=>{ s.close(); process.exit(0); }, 120000);
