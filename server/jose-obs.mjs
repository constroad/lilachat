import { io } from 'socket.io-client';
const s = io('https://lilachat.constroad.com', { auth: { token: process.argv[2] }, transports:['websocket'] });
s.on('connect', ()=>console.log('jose-obs online'));
s.on('typing', f=>console.log('TYPING', JSON.stringify(f)));
s.on('presence', f=>console.log('PRESENCE', JSON.stringify(f)));
s.on('presence.snapshot', f=>console.log('SNAPSHOT', JSON.stringify(f)));
setTimeout(()=>process.exit(0), 15000);
