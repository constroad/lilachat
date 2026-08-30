import { io } from 'socket.io-client';
const [JTOK, WTOK, CHAT] = process.argv.slice(2);
const jose = io('https://lilachat.constroad.com', { auth:{token:JTOK}, transports:['websocket'] });
jose.on('connect', ()=>console.log('JOSE conectado'));
jose.on('typing', f=>console.log('JOSE recibio TYPING', JSON.stringify(f)));
jose.on('presence', f=>console.log('JOSE recibio PRESENCE', JSON.stringify(f)));
const wilson = io('https://lilachat.constroad.com', { auth:{token:WTOK}, transports:['websocket'] });
wilson.on('connect', ()=>{ console.log('WILSON conectado'); setTimeout(()=>{ console.log('WILSON emite typing'); wilson.emit('typing',{chatId:CHAT,on:true}); }, 2000); });
setTimeout(()=>process.exit(0), 10000);
