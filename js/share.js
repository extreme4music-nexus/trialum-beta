/* TRIALUM current: local screenshots and voluntary sharing; no automatic upload. */
(function(root){
'use strict';
const clip=(v,n)=>String(v??'').slice(0,n);
function compose(s,opts={}){
 const cv=document.createElement('canvas');cv.width=1100;cv.height=754;
 const c=cv.getContext('2d',{alpha:false}),g=c.createLinearGradient(0,0,1100,754);
 g.addColorStop(0,'#07334b');g.addColorStop(.6,'#13444d');g.addColorStop(1,'#141d4d');
 c.fillStyle=g;c.fillRect(0,0,1100,754);
 const version=root.TrialumEngine?.VERSION||'1.5.0';
 const stage=root.TrialumI18n?.language?.()||'mk';
 c.fillStyle='#d1fff4';c.font='bold 32px system-ui,sans-serif';c.textAlign='left';
 c.fillText('✺ '+(stage==='en'?'TRIALUM · LIVING SPARK':'ТРИАЛУМ · ЖИВА ИСКРА'),42,47);
 c.fillStyle='#b2ede5';c.font='20px system-ui,sans-serif';c.textAlign='right';
 c.fillText((stage==='en'?'DAY ':'ДЕН ')+s.lastDay+' · '+(stage==='en'?'LAB ':'ЛАБ ')+(s.research?.level||1),1054,47);
 const src=document.getElementById('world');
 if(src)try{c.drawImage(src,0,0,src.width,src.height,0,59,1100,625)}catch(_){}
 const bar=c.createLinearGradient(0,630,0,754);
 bar.addColorStop(0,'#071d32aa');bar.addColorStop(.6,'#061629f5');bar.addColorStop(1,'#071727');
 c.fillStyle=bar;c.fillRect(0,630,1100,124);
 c.textAlign='left';c.fillStyle='#e9fff7';c.font='bold 29px system-ui,sans-serif';
 const p=s.pets.find(x=>x.id===s.selectedPet),ep=p&&root.TrialumEngine?.evolutionProgress(p);
 c.fillText(opts.achievement?'🏆 '+clip(opts.achievement.title,36):p?'🐾 '+clip(p.name,35):'⚗️ '+(stage==='en'?'My living world':'Мојот жив свет'),40,688);
 c.font='19px system-ui,sans-serif';c.fillStyle='#a4e5ec';
 c.fillText(opts.achievement?clip(opts.achievement.description,80):p?(stage==='en'?'Level ':'Ниво ')+ep.level+' · '+clip(ep.epoch,27)+' · '+(ep.trained||0)+' '+(stage==='en'?'lessons':'учења'):
  (stage==='en'?'A fantasy life simulation':'Фантастична симулација на жив свет'),42,727,810);
 c.textAlign='right';c.fillStyle='#c9c7ff';c.fillText('TRIALUM '+version,1060,727);
 return cv;
}
function dataUrl(s,o){return compose(s,o).toDataURL('image/png');}
function download(url,name){const a=document.createElement('a');a.download=name;a.href=url;document.body.append(a);a.click();a.remove();}
async function share(s,opts={}){
 const img=dataUrl(s,opts),title=opts.achievement?'ТРИАЛУМ · '+opts.achievement.title:'Мојот ТРИАЛУМ биосвет',
 name='TRIALUM_'+(opts.achievement?'achievement':'world')+'_day_'+s.lastDay+'.png';
 if(root.TrialumAndroid?.shareImage){root.TrialumAndroid.shareImage(img,title);return{ok:true,message:'Отворен е Android избор за споделување.'};}
 if(navigator.share&&navigator.canShare){
  try{
   const blob=await (await fetch(img)).blob(),file=new File([blob],name,{type:'image/png'});
   if(navigator.canShare({files:[file]})){await navigator.share({title,files:[file],text:opts.achievement?.description||'Мојот ТРИАЛУМ биосвет'});return{ok:true,message:'Сликата е споделена.'};}
  }catch(e){if(e?.name==='AbortError')return{ok:false,message:'Споделувањето е откажано.'};}
 }
 download(img,name);return{ok:true,message:'PNG сликата е подготвена.'};
}
async function save(s,opts={}){
 const img=dataUrl(s,opts),name='TRIALUM_den_'+s.lastDay+(opts.achievement?'_achievement':'')+'.png';
 if(root.TrialumAndroid?.saveImage){root.TrialumAndroid.saveImage(img,name);return{ok:true,message:'Сликата е зачувана локално на Android.'};}
 download(img,name);return{ok:true,message:'Сликата е преземена како PNG.'};
}
async function shareAchievement(s,a){if(!a?.id)return{ok:false,message:'Избери постигнување.'};return share(s,{achievement:a});}
root.TrialumShare={compose,dataUrl,share,save,shareAchievement};
})(typeof globalThis!=='undefined'?globalThis:this);
