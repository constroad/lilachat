import { io } from 'socket.io-client';
const [TOK, CHAT] = process.argv.slice(2);
const s = io('http://localhost:4099', { auth:{token:TOK}, transports:['websocket'] });
s.on('connect', ()=>{ console.log('ok'); s.emit('msg.send',{chatId:CHAT,clientKey:'k'+Date.now(),kind:'text',body:'test local'},(r)=>{ console.log('ack',JSON.stringify(r)); setTimeout(()=>process.exit(0),1500); }); });
s.on('connect_error', e=>{console.log('cerr',e.message);process.exit(1);});
