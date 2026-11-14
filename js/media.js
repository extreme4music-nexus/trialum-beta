/* TRIALUM 1.5 — offline media sheet for stills, GIF and optional video.
   Android saves directly to MediaStore; no user media is uploaded. */
(function(root){
'use strict';
const W=()=>root.TrialumWorld,Share=()=>root.TrialumShare;
let current=null,format='png',busy=false,cached=null;
function clearCache(){if(cached?.url)URL.revokeObjectURL(cached.url);cached=null;}
function tr(mk,en){return root.TrialumI18n?.language()==='en'?en:mk}
function safeName(s,type){
 const suffix=type==='png'?'png':type==='gif'?'gif':type==='mp4'?'mp4':'webm';
 return 'TRIALUM_day_'+(Number(s.lastDay)||1)+'_'+new Date().toISOString().slice(0,10)+'_'+Date.now()+'.'+suffix;
}
function modal(){
 let node=document.getElementById('trialumMediaSheet');
 if(!node){
  node=document.createElement('div');node.id='trialumMediaSheet';node.className='media-shade';
  node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Снимање и споделување');
  document.body.appendChild(node);
  node.addEventListener('click',ev=>{if(ev.target===node&&!busy)close()});
 }
 return node;
}
function close(){const node=modal();if(!busy){node.hidden=true;clearCache();}}
function open(s,opts={}){
 current={s,opts};format='png';clearCache();const node=modal();node.hidden=false;
 const p=s.pets.find(x=>x.id===s.selectedPet),skills=W()?.availableTricks?.(p)||[];
 node.innerHTML='<div class="media-sheet"><div class="media-title"><h2>📷 '+tr('Сними го биосветот','Capture your world')+'</h2>'+
 '<button id="mediaClose" aria-label="Затвори">✕</button></div>'+
 '<p>'+tr('Избери слика, анимација или кратко видео. Снимањето се прави локално.','Choose a picture, animation or short video. Everything is made locally.')+'</p>'+
 '<div class="media-types" role="group" aria-label="Формат">'+
 [['png','📷','PNG',tr('Фотографија','Photo')],['gif','🎞','GIF',tr('4 секунди','4 seconds')],['video','🎬',tr('Видео','Video'),tr('5 секунди','5 seconds')]].map(x=>
 '<button type="button" data-mediaformat="'+x[0]+'" class="'+(x[0]==='png'?'active':'')+'"><span>'+x[1]+'</span><b>'+x[2]+'</b><small>'+x[3]+'</small></button>').join('')+'</div>'+
 (p&&skills.length?'<div class="media-tricks"><label for="mediaTrick">'+tr('Изведи научен трик во снимката:','Perform a learned trick:')+'</label><select id="mediaTrick">'+
 skills.map(skill=>'<option value="'+skill+'">'+({wave:'👋 ',spin:'🔄 ',leap:'✨ ',symbols:'✦ ',logic:'🧠 ',dialogue:'💬 '}[skill]||'')+skill+'</option>').join('')+'</select></div>':'')+
 '<div id="mediaStatus" class="small" role="status" aria-live="polite">'+
 tr('PNG е подготвен веднаш. GIF се создава кадар по кадар. Видеото зависи од поддршката на телефонот.','PNG is immediate. GIF is encoded frame by frame. Video depends on device support.')+'</div>'+
 '<div id="mediaPreviewBox" class="media-preview" hidden></div>'+ 
 '<div class="media-buttons"><button id="mediaPreview">👁 '+tr('Прегледај','Preview')+'</button><button id="mediaSave" class="primary">💾 '+tr('Зачувај во Галерија','Save to Gallery')+'</button>'+
 '<button id="mediaShare">📤 '+tr('Сподели','Share')+'</button></div>'+
 '<p class="small subtle">'+tr('На Android сликите и GIF-овите одат во Screenshots, видеата во Movies/TRIALUM. JSON бекапите остануваат одделни.','On Android, PNG/GIF go to Screenshots; videos to Movies/TRIALUM. JSON backups stay separate.')+'</p></div>';
 node.querySelector('#mediaClose').onclick=close;
 node.querySelectorAll('[data-mediaformat]').forEach(b=>b.onclick=()=>{if(busy)return;format=b.dataset.mediaformat;clearCache();node.querySelector('#mediaPreviewBox').hidden=true;node.querySelectorAll('[data-mediaformat]').forEach(x=>x.classList.toggle('active',x===b))});
 node.querySelector('#mediaPreview').onclick=()=>produce('preview');
 node.querySelector('#mediaSave').onclick=()=>produce(false);
 node.querySelector('#mediaShare').onclick=()=>produce(true);
 return true;
}
function status(msg){const e=document.getElementById('mediaStatus');if(e)e.textContent=msg;}
function imageAsDataUrl(blob){
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
}
function finish(s,blob,mime,share){
 if(!blob||blob.size<10)throw Error(tr('Не е создадена валидна датотека.','No valid file was created.'));
 const ext=mime==='image/png'?'png':mime==='image/gif'?'gif':mime==='video/mp4'?'mp4':'webm';
 const name=safeName(s,ext);
 return new Promise(async(resolve,reject)=>{
  try{
   if(root.TrialumAndroid?.saveMedia){
    const data=await imageAsDataUrl(blob);
    root.TrialumAndroid.saveMedia(data,name,mime,Boolean(share));
    resolve({ok:true,message:tr('Снимката се зачувува во системската Галерија…','Saving to system Gallery…')});return;
   }
   if(share&&navigator.share&&navigator.canShare){
    const file=new File([blob],name,{type:mime});
    if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'TRIALUM'});resolve({ok:true,message:tr('Споделено','Shared')});return;}
   }
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
   resolve({ok:true,message:tr('Снимката е преземена.','Downloaded.')});
  }catch(e){reject(e);}
 });
}
function prepare(){
 const s=current.s,p=s.pets.find(x=>x.id===s.selectedPet),skill=document.getElementById('mediaTrick')?.value;
 if(p&&skill)W()?.prepareRecording?.(p.id,skill);
}
function decoratedFrame(s,time,width,height){
 const scene=W()?.frameAt(time);
 if(!scene)throw Error('Canvas recording not available');
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const c=canvas.getContext('2d',{willReadFrequently:true});
 const bar=Math.round(height*.15),screenHeight=height-bar;
 c.drawImage(scene,0,0,width,screenHeight);
 const overlay=c.createLinearGradient(0,screenHeight-35,0,height);
 overlay.addColorStop(0,'#072b3c02');overlay.addColorStop(.5,'#092f40ee');overlay.addColorStop(1,'#091b30');
 c.fillStyle=overlay;c.fillRect(0,screenHeight-35,width,bar+35);
 const p=s.pets.find(x=>x.id===s.selectedPet);
 c.fillStyle='#f1fff6';c.font='bold '+Math.max(11,Math.round(width/35))+'px system-ui';c.textAlign='left';
 c.fillText('✺ TRIALUM · '+(p?.name||'Living World'),12,height-bar/2+3,width*.74);
 c.font='bold '+Math.max(9,Math.round(width/53))+'px system-ui';c.textAlign='right';
 c.fillText('v'+(root.TrialumEngine?.VERSION||'1.5.2'),width-10,height-bar/2+3);
 return canvas;
}
async function makeGif(s){
 const fps=12,duration=4,width=480,height=305,start=performance.now()/1000;
 const frames=[];
 prepare();
 for(let i=0;i<fps*duration;i++){
  const cv=decoratedFrame(s,start+i/fps,width,height);
  frames.push(cv.getContext('2d').getImageData(0,0,width,height).data);
  if(i%6===0){status(tr('Генерирање GIF: ','Generating GIF: ')+Math.floor(100*i/(fps*duration))+'%');await new Promise(resolve=>setTimeout(resolve,0));}
 }
 status(tr('Компресирам GIF анимација…','Encoding GIF animation…'));
 const data=root.TrialumGif.encode(frames,width,height,Math.round(100/fps));
 return new Blob([data],{type:'image/gif'});
}
async function makeVideo(s){
 if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream||!MediaRecorder.isTypeSupported)throw Error(tr('Видео снимањето не е поддржано на овој уред. Избери GIF.','Video recording is not supported. Please use GIF.'));
 const types=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm'];
 const mime=types.find(t=>MediaRecorder.isTypeSupported(t));
 if(!mime)throw Error(tr('Нема поддржан видеоформат. Избери GIF.','No supported video format. Use GIF.'));
 prepare();
 const cv=document.createElement('canvas');cv.width=720;cv.height=460;
 const ctx=cv.getContext('2d');const stream=cv.captureStream(15);
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1_400_000});
 const chunks=[],begin=performance.now(),duration=5000;
 const completed=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onerror=e=>reject(e.error||Error('Recorder error'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime.split(';')[0]}))});
 recorder.start(300);
 await new Promise(resolve=>{
  function frame(now){
   const elapsed=now-begin;
   const rendered=decoratedFrame(s,now/1000,720,460);
   ctx.drawImage(rendered,0,0);
   status(tr('Видео: ','Video: ')+Math.min(100,Math.floor(elapsed/duration*100))+'%');
   if(elapsed>=duration){resolve();return;}
   requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
 });
 recorder.stop();stream.getTracks().forEach(t=>t.stop());
 const blob=await completed;
 if(blob.size<100)throw Error(tr('Неуспешно видео, пробај GIF.','Could not encode video, try GIF.'));
 return{blob,mime:blob.type||mime.split(';')[0]};
}
async function generate(s,opts){
 let blob,mime;
 if(format==='png'){
  const data=Share().dataUrl(s,opts),result=await fetch(data);blob=await result.blob();mime='image/png';
 }else if(format==='gif'){blob=await makeGif(s);mime='image/gif';}
 else{
  try{const result=await makeVideo(s);blob=result.blob;mime=result.mime;}
  catch(error){
   status(tr('Видео недостапно — автоматски пробувам GIF.','Video unavailable — falling back to GIF.'));
   format='gif';
   const option=document.querySelector('[data-mediaformat="gif"]');
   document.querySelectorAll('[data-mediaformat]').forEach(el=>el.classList.toggle('active',el===option));
   blob=await makeGif(s);mime='image/gif';
  }
 }
 return{blob,mime,format};
}
async function produce(action){
 if(busy||!current)return;busy=true;
 const btns=[...document.querySelectorAll('#trialumMediaSheet button')];
 btns.forEach(x=>x.disabled=true);
 const {s,opts}=current;
 try{
  if(!cached||cached.format!==format){
   const result=await generate(s,opts);
   clearCache();
   cached={...result,url:URL.createObjectURL(result.blob)};
  }
  const {blob,mime,url}=cached,container=document.getElementById('mediaPreviewBox');
  // A real still/animated preview, never a simulated success message.
  if(container){
   container.replaceChildren();
   const viewer=document.createElement(mime.startsWith('video/')?'video':'img');
   viewer.src=url;viewer.className='media-preview-asset';
   if(viewer.tagName==='VIDEO'){viewer.controls=true;viewer.muted=true;viewer.loop=true;viewer.playsInline=true;}
   viewer.alt=tr('Преглед на твојот биосвет','Preview of your world');
   container.appendChild(viewer);container.hidden=false;
  }
  if(action==='preview'){
   status(tr('Прегледот е готов. Можеш да зачуваш или споделиш.','Preview ready. You can save or share.'));
   return;
  }
  status(tr('Зачувување: ','Saving: ')+Math.round(blob.size/1024)+' KB');
  const result=await finish(s,blob,mime,action===true);
  status(result.message);
 }catch(e){status('⚠ '+(e?.message||tr('Грешка при снимање.','Capture failed.')));}
 finally{busy=false;btns.forEach(x=>x.disabled=false);}
}
root.TrialumMedia={open,close,makeGif,makeVideo};
root.TrialumMediaSaved=function(event){
 status(event?.ok?tr('✓ Зачувано во системската Галерија: ','✓ Saved to system Gallery: ')+(event.name||''):
  '⚠ '+(event?.message||tr('Зачувувањето не успеа.','Saving failed.')));
};
})(typeof globalThis!=='undefined'?globalThis:this);
