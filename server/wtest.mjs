import { io } from 'socket.io-client';
const s = io('https://lilachat.constroad.com', { auth:{token:process.argv[2]}, transports:['websocket','polling'] });
s.on('connect', ()=>console.log('WILSON connect', s.id));
s.on('disconnect', r=>console.log('WILSON disconnect', r));
s.on('connect_error', e=>console.log('WILSON connect_error', e.message));
setTimeout(()=>{ console.log('estado connected=', s.connected); s.close(); process.exit(0); }, 8000);
