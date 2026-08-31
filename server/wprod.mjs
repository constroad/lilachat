import { io } from 'socket.io-client';
const [TOK, CHAT] = process.argv.slice(2);
const s = io('https://lilachat.constroad.com', { auth:{token:TOK}, transports:['websocket'] });
s.on('connect', ()=>{ console.log('ok'); s.emit('msg.send',{chatId:CHAT,clientKey:'kp'+Date.now(),kind:'text',body:'prod test'},(r)=>{ console.log('ack',JSON.stringify(r)); setTimeout(()=>process.exit(0),1500); }); });
