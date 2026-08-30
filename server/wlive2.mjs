import { io } from 'socket.io-client';
const [TOK, CHAT] = process.argv.slice(2);
const s = io('https://lilachat.constroad.com', { auth:{token:TOK}, transports:['websocket'] });
s.on('connect', ()=>console.log('wilson ok', s.id));
s.on('connect_error', e=>console.log('err', e.message));
s.on('disconnect', r=>console.log('disc', r));
setInterval(()=>{ if(s.connected){ s.emit('typing',{chatId:CHAT,on:true}); } }, 3000);
setTimeout(()=>{ s.close(); process.exit(0); }, 180000);
