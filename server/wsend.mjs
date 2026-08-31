import { io } from 'socket.io-client';
const [TOK, CHAT] = process.argv.slice(2);
const s = io('https://lilachat.constroad.com', { auth:{token:TOK}, transports:['websocket'] });
s.on('connect', ()=>{ console.log('wilson ok'); s.emit('msg.send', { chatId: CHAT, clientKey: 'push-'+Date.now(), kind:'text', body:'Hola Jose, probando notificacion push '+new Date().toISOString().slice(11,19) }, (r)=>{ console.log('ack', JSON.stringify(r)); setTimeout(()=>process.exit(0), 2000); }); });
s.on('connect_error', e=>{ console.log('err', e.message); process.exit(1); });
