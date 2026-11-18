/* TRIALUM 1.2 - serverless manual-signaling WebRTC DataChannel.
 * No account, app backend, TURN server, remote scripts or automatic peer discovery.
 * Public STUN is optional for NAT discovery; without a TURN relay, many NATs cannot connect.
 * Identity is NOT authenticated: invitation codes must only be shared with trusted friends. */
(function(root){
'use strict';
let pc=null,channel=null,remote=null,profile=()=>null,onChange=()=>{},onVisit=()=>{},status='Не е поврзано';
const MAX_SIGNAL=64000,MAX_PACKET=4096;
function notify(s){status=s;onChange({status,connected:!!channel&&channel.readyState==='open',guest:remote});}
function clear(){if(channel){try{channel.close()}catch(_){}}if(pc){try{pc.close()}catch(_){}}pc=null;channel=null;remote=null;notify('Не е поврзано');}
function config(local){return {iceServers:local?[]:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};}
function safeGuest(g){if(!g||typeof g!=='object')return null;const p=g.pet||{};return {id:String(g.id||'').slice(0,60),name:String(g.name||'Пријател').slice(0,32),pet:{id:String(p.id||'').slice(0,60),name:String(p.name||'Миленик').slice(0,32),species:Math.max(0,Math.min((root.TrialumEngine?.SPECIES?.length||4)-1,Number(p.species)||0)),hue:Math.max(0,Math.min(359,Number(p.hue)||160)),growth:Math.max(0,Math.min(100,Number(p.growth)||1)),level:Math.max(1,Math.min(250,Number(p.level)||1))}};}
function send(packet){if(!channel||channel.readyState!=='open')return false;const data=JSON.stringify(packet);if(data.length>MAX_PACKET)return false;channel.send(data);return true;}
function hello(){const me=profile();if(!me)return;send({kind:'hello',v:1,id:me.id,name:me.name,pet:me.pet});}
function attach(c){channel=c;c.onopen=()=>{notify('Поврзано директно со пријател ✓');hello();};c.onclose=()=>{remote=null;notify('Врската е прекината.');};c.onerror=()=>notify('P2P каналот пријави грешка.');
 c.onmessage=event=>{if(typeof event.data!=='string'||event.data.length>MAX_PACKET)return;let msg;try{msg=JSON.parse(event.data)}catch(_){return}if(msg?.v!==1)return;
 if(msg.kind==='hello'){const guest=safeGuest(msg);if(!guest||!guest.id)return;remote=guest;notify('Поврзано со '+guest.name);return;}
 if(msg.kind==='visit'&&remote){if(String(msg.petId||'').length>60)return;onVisit(remote,{petId:String(msg.petId||''),type:msg.type==='play'?'play':'greet'});}
 }; }
function makePc(local){if(!root.RTCPeerConnection)throw Error('Овој WebView/прелистувач нема WebRTC DataChannel поддршка.');clear();pc=new RTCPeerConnection(config(local));pc.onconnectionstatechange=()=>{if(pc?.connectionState==='failed')notify('Врската не успеа (NAT/firewall). Пробајте иста Wi-Fi мрежа.');};pc.ondatachannel=e=>attach(e.channel);return pc;}
function iceReady(p){if(p.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{let done=false;const fin=()=>{if(done)return;done=true;p.removeEventListener('icegatheringstatechange',cb);resolve();};const cb=()=>{if(p.iceGatheringState==='complete')fin()};p.addEventListener('icegatheringstatechange',cb);setTimeout(fin,11000);});}
function code(type,description){return JSON.stringify({v:1,kind:type,description:{type:description.type,sdp:description.sdp}});}
function parse(str,type){if(typeof str!=='string'||str.length>MAX_SIGNAL)throw Error('Невалиден или предолг код за поврзување.');let data;try{data=JSON.parse(str)}catch(_){throw Error('Кодот не е валиден JSON.')}if(data.v!==1||data.kind!==type||data.description?.type!==type||typeof data.description.sdp!=='string'||data.description.sdp.length>MAX_SIGNAL)throw Error('Внеси '+(type==='offer'?'покана':'одговор')+' од ТРИАЛУМ.');return data.description;}
async function offer(local){const p=makePc(local);attach(p.createDataChannel('trialum-friends',{ordered:true}));const d=await p.createOffer();await p.setLocalDescription(d);notify('Копирај ја поканата и испрати ја на пријател.');await iceReady(p);return code('offer',p.localDescription);}
async function answer(input,local){const d=parse(input,'offer'),p=makePc(local);await p.setRemoteDescription(d);await p.setLocalDescription(await p.createAnswer());notify('Копирај го одговорот и врати му го на пријателот.');await iceReady(p);return code('answer',p.localDescription);}
async function finish(input){if(!pc||pc.signalingState!=='have-local-offer')throw Error('Прво создај покана на овој уред.');await pc.setRemoteDescription(parse(input,'answer'));notify('Се воспоставува директната врска…');}
function visit(petId){if(!remote)return false;return send({kind:'visit',v:1,petId:String(petId||'').slice(0,60),type:'play'});}
root.TrialumPeer={offer,answer,finish,visit,clear,status:()=>status,remote:()=>remote,connected:()=>!!channel&&channel.readyState==='open',onChange(fn){onChange=fn},onVisit(fn){onVisit=fn},setProfile(fn){profile=fn}};
if(typeof module==='object'&&module.exports)module.exports={safeGuest,parse,code};
})(typeof globalThis!=='undefined'?globalThis:this);
