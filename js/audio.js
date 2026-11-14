/* Original generative ambient music and invented creature speech; ZzFX MIT for sfx. */
(function(root){
'use strict';
let musicTimer=null, enabled=false, music=false, volume=.55, sequence=0, appVisible=true;
const norm=(v)=>Math.min(1,Math.max(0,v));
const context=()=>typeof zzfxX!=='undefined'?zzfxX:null;
function unlock(){if(!appVisible)return Promise.resolve();const ctx=context();if(ctx&&ctx.state==='suspended')return ctx.resume().catch(()=>{});return Promise.resolve();}
function setVolume(v){volume=norm(v);if(typeof zzfxV!=='undefined')zzfxV=volume*.28;}
function setEnabled(v){enabled=!!v;if(enabled)unlock();else stopMusic();}
function sfx(name){if(!appVisible||!enabled||typeof zzfx!=='function')return;try{unlock();const presets={tap:[.6,.02,720,.01,.03,.08],select:[.6,.01,570,.01,.06,.2,1,1.2,0,-20],feed:[.8,.04,390,.05,.06,.2,0,1.4,-.1],play:[.9,.03,850,.01,.05,.15,1,1.3,200],wash:[.5,.08,1200,.01,.1,.3,3,1,-80],build:[.8,.03,290,.01,.09,.28,0,1.5,100],error:[.5,.01,210,.01,.08,.17,2,1,-35],grow:[.8,.02,440,.01,.12,.3,0,1,90],day:[.7,.01,660,.02,.06,.2,0,1.2,40]};zzfx(...(presets[name]||presets.tap));}catch(_){}}
function tone(freq,start,duration,amp=.05,shape='sine'){const c=context();if(!c||!appVisible||!enabled)return;const now=c.currentTime+Math.max(0,start),osc=c.createOscillator(),out=c.createGain(),filt=c.createBiquadFilter();osc.type=shape;osc.frequency.setValueAtTime(freq,now);filt.type='lowpass';filt.frequency.value=1700;out.gain.setValueAtTime(.0001,now);out.gain.exponentialRampToValueAtTime(Math.max(.0002,amp*volume),now+.05);out.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(filt);filt.connect(out);out.connect(c.destination);osc.start(now);osc.stop(now+duration+.04);}
function speak(p){if(!enabled||!p)return;unlock();const seed=(p.seed||12)+(p.voice||p.species||0)*17+sequence++;const notes=[142,176,209,235,286,319,380],phonemes=['ло','кви','три','бу','ми','па','ру','зии','мо','нуу','шли','кии'];const count=2+seed%4;let utterance=[];for(let i=0;i<count;i++){const f=notes[(seed+i*7+i*i)%notes.length]*(1+(p.species||0)*.14);tone(f,i*.13,.16+((seed+i)%3)*.04,.115,'triangle');tone(f*1.95,i*.13,.08,.025,'sine');utterance.push(phonemes[(seed+i*i+3*i)%phonemes.length]);}p.lastSpeech=utterance.join('-')+'!';p.speechAt=performance.now();sfx('tap');}
function melodyStep(){if(!enabled||!music)return;const chord=[0,3,5,7,10];const base=[130.8,146.83,164.81,174.61][Math.floor(sequence/12)%4];const note=chord[(sequence*3+Math.floor(sequence/3))%chord.length];let freq=base*Math.pow(2,note/12);tone(freq,.03,.7,.042,'sine');if(sequence%4===0)tone(freq/2,0,2.6,.035,'triangle');if(sequence%6===3)tone(freq*1.5,.3,1.2,.022,'sine');sequence++;}
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}
function setMusic(v){music=!!v;stopMusic();if(music&&enabled&&appVisible){unlock();melodyStep();musicTimer=setInterval(melodyStep,860)};}
function sync(settings){setVolume(settings.volume??.55);setEnabled(settings.sound);setMusic(settings.music);}
// Pause audio work while WebView is backgrounded without changing the saved
// music/sound preferences. Resume only the player's explicitly enabled music.
function setAppVisible(visible){
 const next=Boolean(visible);
 if(appVisible===next)return;
 appVisible=next;
 if(!next){
  stopMusic();
  const ctx=context();
  if(ctx&&ctx.state==='running')ctx.suspend?.().catch?.(()=>{});
 }else if(enabled&&music)setMusic(true);
}
root.document?.addEventListener?.('visibilitychange',()=>{
 setAppVisible(root.document.visibilityState!=='hidden'&&!root.document.hidden);
});
function speakWhileVisible(p){if(appVisible)speak(p);}
root.TrialumAudio={unlock,setVolume,setEnabled,setMusic,setAppVisible,sfx,speak:speakWhileVisible,sync};
})(globalThis);
