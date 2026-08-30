import { io } from 'socket.io-client';
const s = io('https://lilachat.constroad.com', { auth:{token:process.argv[2]}, transports:['websocket'] });
s.on('connect', ()=>console.log('obs online'));
s.on('presence.snapshot', f=>console.log('SNAPSHOT', JSON.stringify(f)));
s.on('presence', f=>console.log('PRESENCE', JSON.stringify(f)));
setTimeout(()=>process.exit(0), 8000);
