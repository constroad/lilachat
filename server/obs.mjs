import { io } from 'socket.io-client';
const s = io('https://lilachat.constroad.com', { auth:{token:process.argv[2]}, transports:['websocket'] });
s.on('connect', ()=>console.log('obs online'));
s.on('typing', f=>console.log('>>> TYPING', JSON.stringify(f)));
s.on('connect_error', e=>console.log('err', e.message));
setTimeout(()=>process.exit(0), 12000);
