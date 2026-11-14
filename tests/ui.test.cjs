/* JSDOM integration test: mount actual HTML and exercise tabs/buttons.
   This catches runtime errors that syntax/unit tests miss. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const ROOT=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const scripts=[
 'js/theme.js','js/i18n.js','js/onboarding.js','js/engine.js','js/evolution.js','js/progression.js','js/longplay.js','js/fauna-lab.js','js/debug-tools.js',
 'js/playground.js','js/peer.js','js/social.js','js/messages.js','js/shared-playground.js','js/shared-scene.js','js/creature-art.js','js/world.js','js/share.js','js/gif-encoder.js','js/media.js','js/play-games.js','js/expansion-ui.js','js/advanced-intelligence.js','js/longplay-ui.js','js/app.js'
];
function create(){
 const dom=new JSDOM(html,{url:'https://appassets.androidplatform.net/assets/web/index.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 const noop=()=>{};
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:()=>({width:70})},{get(target,prop){return target[prop]||noop},set(target,prop,value){target[prop]=value;return true}});
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;
 w.requestAnimationFrame=()=>0;
 w.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,String(url)),'utf8'))});
 w.alert=noop;w.confirm=()=>true;w.prompt=()=>null;
 for(const file of scripts.slice(0,-1))w.eval(fs.readFileSync(path.join(ROOT,file),'utf8'));
 const E=w.TrialumEngine;
 const world=E.newGame('real');world.settings.language='mk'; // Existing MK assertions remain deterministic; locale auto mode is tested separately.
 world.stage=7;world.lastDay=400;world.createdAt=Date.now()-399*E.DAY_MS;
 world.insight=100000;world.compounds=100000;world.biomass=100000;world.energy=100;world.cells=10000;
 for(const e of E.ELEMENTS)world.elements[e]=1000;
 world.research.level=40;world.research.knowledge=50000;for(const k of Object.keys(world.research.fields))world.research.fields[k]=5000;
 world.labActions=20;
 world.habitats=[{id:'hab-1',name:'Тест аквариум',biome:'lagoon',capacity:80,minerals:{macro:60,micro:55},chem:{ph:7.1,temp:24,oxygen:93,toxins:1},cleanliness:95,flora:[],dayActions:5,bornDay:1,floraSlots:6}];
 world.activeHabitat='hab-1';
 world.logs.push({kind:'milestone',day:10,text:'Создадена пробна клетка'});
 E.ensureLongplay(world);
 w.TrialumStorage={load:async()=>world,save:async()=>({ok:true,backend:'TEST'}),clear:async()=>{},parseImport:(s)=>JSON.parse(s)};
 w.TrialumAudio={sync:noop,sfx:noop,speak:noop,setVolume:noop};
 w.eval(fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8'));
 return{w,world,dom,E};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Pure renderer lifecycle probe. No loaded world means no RAF. Hidden/off-tab
// canvases must have ZERO queued animation callbacks even with a saved world.
function assertPaintLifecycle(){
 const dom=new JSDOM('<canvas id="world"></canvas>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let requested=0,cancelled=0;
 w.HTMLCanvasElement.prototype.getContext=()=>({});
 w.requestAnimationFrame=()=>++requested;
 w.cancelAnimationFrame=()=>{cancelled++;};
 w.eval(fs.readFileSync(path.join(ROOT,'js/world.js'),'utf8'));
 const W=w.TrialumWorld;
 assert.equal(requested,0,'home renderer must not start before a world exists');
 W.setSceneVisible(false);W.setState({});
 assert.equal(requested,0,'off-tab home scene must never start RAF');
 W.setSceneVisible(true);W.setSceneVisible(true);
 assert.equal(requested,1,'visible home scene must have one scheduled RAF only');
 W.setSceneVisible(false);
 assert.equal(cancelled,1,'leaving home must cancel the queued frame');
 W.setSceneVisible(true);
 assert.equal(requested,2);
 Object.defineProperty(w.document,'hidden',{configurable:true,value:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(cancelled,2,'WebView backgrounding must suspend painting');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(requested,3,'WebView foregrounding resumes painting once');
 W.setState(null);
 assert.equal(cancelled,3,'clearing the world stops background render');
 dom.window.close();
}
function assertPlaygroundPaintLifecycle(){
 const dom=new JSDOM('<canvas id="playgroundScene"></canvas><canvas id="sharedScene"></canvas>',
  {url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let requested=0,cancelled=0;
 w.HTMLCanvasElement.prototype.getContext=()=>({});
 w.requestAnimationFrame=()=>++requested;
 w.cancelAnimationFrame=()=>{cancelled++;};
 w.eval(fs.readFileSync(path.join(ROOT,'js/playground.js'),'utf8'));
 w.eval(fs.readFileSync(path.join(ROOT,'js/shared-scene.js'),'utf8'));
 w.TrialumPlayground.mount({},{});
 assert.equal(requested,1,'local playground must schedule one paint frame');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(cancelled,1,'local playground must stop painting in Android background');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(requested,2,'local playground resumes once on foreground');
 w.TrialumPlayground.stop();
 assert.equal(cancelled,2,'local playground must stop on navigation');
 w.TrialumSharedScene.mount();
 assert.equal(requested,3,'shared playground must schedule one paint frame');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(cancelled,3,'shared playground stops when Android is backgrounded');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(requested,4,'shared playground resumes once');
 w.TrialumSharedScene.stop();
 assert.equal(cancelled,4,'shared playground stops on navigation');
 dom.window.close();
}
function assertAudioLifecycle(){
 const dom=new JSDOM('<body></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;let started=0,stopped=0;
 w.setInterval=()=>++started;
 w.clearInterval=()=>{stopped++;};
 w.eval(fs.readFileSync(path.join(ROOT,'js/audio.js'),'utf8'));
 const audio=w.TrialumAudio;
 audio.sync({sound:true,music:true,volume:.5});
 assert.equal(started,1,'ambient music starts after explicit sound+music choice');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(stopped,1,'hidden Android WebView stops the music timer');
 audio.setMusic(true);
 assert.equal(started,1,'setting music while hidden must never restart playback');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(started,2,'returning to foreground restores opted-in music once');
 audio.setMusic(false);
 assert.equal(stopped,2,'manual music opt-out cancels the timer');
 Object.defineProperty(w.document,'hidden',{configurable:true,value:true});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 Object.defineProperty(w.document,'hidden',{configurable:true,value:false});
 w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(started,2,'opted-out music must remain silent after resuming WebView');
 dom.window.close();
}
function assertViewportLifecycle(){
 function probe(name,html,source,start,stop){
  const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, observers=[];let requested=0,cancelled=0;
  w.HTMLCanvasElement.prototype.getContext=()=>({});
  w.requestAnimationFrame=()=>++requested;
  w.cancelAnimationFrame=()=>{cancelled++;};
  w.IntersectionObserver=class {
   constructor(callback){this.callback=callback;observers.push(this);}
   observe(){}
   disconnect(){this.disconnected=true;}
   emit(visible){if(!this.disconnected)this.callback([{isIntersecting:visible}]);}
  };
  w.eval(fs.readFileSync(path.join(ROOT,source),'utf8'));
  start(w);
  assert.equal(requested,1,name+' schedules one visible frame');
  assert.equal(observers.length,1,name+' watches the viewport');
  observers[0].emit(false);
  assert.equal(cancelled,1,name+' cancels a frame when scrolled out of view');
  observers[0].emit(true);
  assert.equal(requested,2,name+' resumes only once when scrolled back');
  stop(w);
  assert.equal(cancelled,2,name+' cancels pending paint on teardown');
  dom.window.close();
 }
 probe('home','<canvas id="world"></canvas>','js/world.js',
  w=>w.TrialumWorld.setState({}),
  w=>w.TrialumWorld.setState(null));
 probe('local','<canvas id="playgroundScene"></canvas>','js/playground.js',
  w=>w.TrialumPlayground.mount({},{}),
  w=>w.TrialumPlayground.stop());
 probe('shared','<canvas id="sharedScene"></canvas>','js/shared-scene.js',
  w=>w.TrialumSharedScene.mount(),
  w=>w.TrialumSharedScene.stop());
}
async function run(){
 assertPaintLifecycle();
 assertAudioLifecycle();
 assertViewportLifecycle();
 assertPlaygroundPaintLifecycle();
 const {w,world,dom}=create(),errors=[];
 w.addEventListener('error',e=>{errors.push(e.message);e.preventDefault()});
 await delay(35);
 const d=w.document;
 assert(d.getElementById('hudXP'),'XP HUD missing');
 assert(d.getElementById('hudTokens'),'tokens HUD missing');
 assert.equal(d.querySelectorAll('.primary-game-nav>.tab').length,5,'main nav should have 5 tabs');
 // Reproduce Samsung Android video: shrinking the aquarium changes scrollY.
 // Layout-induced scroll events must NOT re-expand or re-collapse the scene.
 const scene=d.querySelector('.world');assert(scene,'Aquarium missing');
 Object.defineProperty(w,'scrollY',{configurable:true,writable:true,value:0});
 const scrollAt=y=>{w.scrollY=y;w.dispatchEvent(new w.Event('scroll'));};
 const touchAt=(type,y)=>{
  const event=new w.Event(type,{bubbles:true});
  Object.defineProperty(event,'touches',{value:type==='touchend'?[]:[{clientY:y}]});
  w.dispatchEvent(event);
 };
 scrollAt(210);assert(!scene.classList.contains('scene-compact'),'Browser scroll adjustment alone must not collapse scene');
 touchAt('touchstart',410);touchAt('touchmove',340);
 assert(scene.classList.contains('scene-compact'),'User downward swipe should collapse aquarium');
 scrollAt(21);scrollAt(0);
 assert(scene.classList.contains('scene-compact'),'Reflow-induced scrollY drop must not reopen aquarium');
 touchAt('touchmove',275);
 assert(scene.classList.contains('scene-compact'),'Continued downward swipe must not oscillate');
 touchAt('touchmove',358);scrollAt(20);
 assert(!scene.classList.contains('scene-compact'),'Intentional upward swipe at page top should expand aquarium');
 scrollAt(215);
 assert(!scene.classList.contains('scene-compact'),'Scroll anchoring after expansion must not re-collapse without user input');
 touchAt('touchend',0);scrollAt(0);
 console.log('✓ Android video regression: sticky aquarium does not bounce on touch scroll or layout reflow');
 const click=tab=>{let t=d.querySelector('[data-tab="'+tab+'"]');if(!t){const more=d.querySelector('.primary-game-nav [data-tab="more"]');assert(more,'missing More navigation');more.click();t=d.querySelector('[data-tab="'+tab+'"]');}assert(t,'missing menu '+tab);t.click();};
 function check(tab,need){
   click(tab);const text=d.getElementById('tabContent').textContent;
   assert(text.includes(need),'tab '+tab+' did not render: '+text.slice(0,350));
   assert(!text.includes('Проблем со мени'),'tab '+tab+' crashed');
   console.log('✓ '+tab+' renders');
 }
 check('habitats','Биохемија');
 assert.equal(scene.hidden,false,'Home/Habitats must display the home canvas');
 assert(d.querySelector('[data-do="habCare"]'),'habitat care buttons missing');
 assert(d.querySelector('[data-do="startBuild"]'),'habitat construction missing');
 assert(d.querySelector('[data-do="longHabUpgrade"]'),'habitat upgrades missing');
 check('more','Повеќе можности');
 check('dna','ДНК');
 assert(d.querySelector('[data-do="transformDNA"]'),'DNA evolution missing');
 check('playgames','Google Play Games');
 assert(d.getElementById('tabContent').textContent.includes('Android'),'Browser-only Play Games must be safely disabled');
 console.log('✓ Google Play Games offline fallback UI');
 check('playground','Игротека');
 assert(scene.hidden,'Local playground must not show the sticky home aquarium');
 check('shared','Заедничка игротека');
 assert(scene.hidden,'Shared playground must not show the sticky home aquarium');
 assert.equal(d.querySelector('#tabs [data-tab="more"]')?.getAttribute('aria-current'),'page',
  'secondary screens must expose their active More destination to screen readers');
 touchAt('touchstart',400);touchAt('touchmove',250);scrollAt(215);
 assert(!scene.classList.contains('scene-compact'),
  'touch scrolling in shared screen must not manipulate the hidden home scene');
 check('habitats','Биохемија');
 assert(!scene.hidden&&!scene.classList.contains('scene-compact'),
  'returning Home after a shared-screen swipe must restore the expanded aquarium');
 assert.equal(d.querySelector('#tabs [data-tab="habitats"]')?.getAttribute('aria-current'),'page',
  'screen reader must identify Habitats as the active primary destination');
 check('messages','Пријателски пораки');
 assert(w.TrialumMessages?.render,'Message inbox module missing from APK UI');
 assert(!d.querySelector('[data-do="msgSend"]'),'Unauthenticated offline world must NOT show send buttons');
 assert(w.TrialumPlayground?.ensure,'Playground module missing');
 check('friends','Пријатели');
 assert(d.querySelector('[data-do="p2pOffer"]'),'friend invite missing');
 assert(d.querySelector('[data-do="p2pAnswer"]'),'friend answer missing');
 check('diary','Хронолошки дневник');
 const search=d.getElementById('diarySearch');
 search.value='постои нешто непознато';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(d.querySelectorAll('#diaryList .log-entry:not([hidden])').length,0,'diary search failed');
 check('settings','Дебагирање');
 const toggle=d.querySelector('[data-do="debugToggle"]');assert(toggle);toggle.click();
 assert(world.settings.debugEnabled,'debug toggle did not enable testing');
 assert(d.querySelector('[data-do="debugDays"]'),'debug day buttons missing');
 const daysBefore=world.lastDay;d.querySelector('[data-do="debugDays"][data-days="1"]').click();
 assert(world.lastDay>daysBefore,'+1 day did not advance simulation');
 check('pets','Миленици');
 assert(d.getElementById('selectedPetMount'),'Pet care panel must be scoped to Pets');
 assert(d.getElementById('selectedPanel')?.closest('#tabContent'),'Pet care panel must not be duplicated in global sidebar');
 check('research','Истражувања');
 assert(w.TrialumMedia?.open,'Media picker module missing');
 assert(w.TrialumMedia.open(world),'Media chooser failed to open');
 assert(d.querySelectorAll('[data-mediaformat]').length===3,'PNG / GIF / video choices missing');
 assert(d.getElementById('mediaPreview'),'Media preview button missing');
 w.TrialumMedia.close();
 assert(w.TrialumCreatureArt?.draw,'2.5D creature renderer missing');
 assert(w.TrialumWorld?.frameAt,'Animated frame capture missing');
 assert(w.TrialumGif?.encode,'Offline GIF encoding missing');
 const bytes=w.TrialumGif.encode([new Uint8ClampedArray(16*16*4).fill(128)],16,16,8);
 assert.equal(String.fromCharCode(...bytes.slice(0,6)),'GIF89a');
 assert.equal(bytes[bytes.length-1],0x3b);
 console.log('✓ 2.5D renderer and valid GIF container smoke checks');
 check('lab','Жива лабораторија');
 assert.equal(scene.hidden,false,'Initial Lab/Home screen restores the home scene');
 check('food','Лабораторија за храна');
 assert(scene.hidden,'Unrelated labs should not duplicate the full world scene');
 check('plants','Ботаничка');
 check('notifications','Известувања');
 await w.TrialumI18n.change('en');w.TrialumI18n.translateDOM(d.body);
 assert(d.querySelector('#tabs').textContent.includes('Research'),'English navigation did not translate');
 await w.TrialumI18n.change('mk');w.TrialumI18n.translateDOM(d.body);
 assert(d.querySelector('#tabs').textContent.includes('Истражувања'),'Macedonian did not restore');
 console.log('✓ MK / EN language switching without changing world');

 // Regression: Android backup picker callback must apply a valid world, and
 // a canceled restore or malformed file must never replace the current world.
 check('settings','Дебагирање');
 assert(d.getElementById('backupFeedback'),'Backup & Restore feedback slot missing');
 assert(d.getElementById('tabContent').textContent.includes('Бекап и враќање'),'Macedonian Backup & Restore label missing');
 const imported=JSON.parse(JSON.stringify(world));
 imported.settings.theme='light';
 imported.profileName='RESTORED_NATIVE_TEST_WORLD';
 w.TrialumTheme.set('dark');
 const originalName=world.profileName;
 w.confirm=()=>false;
 await w.TrialumNativeBackupReceived(JSON.stringify(imported));
 assert.equal(d.documentElement.dataset.theme,'dark','Canceled backup restore changed theme');
 click('friends');
 assert(!d.getElementById('tabContent').textContent.includes('RESTORED_NATIVE_TEST_WORLD'),'Cancel must preserve current world');
 w.confirm=()=>true;
 await w.TrialumNativeBackupReceived(JSON.stringify(imported));
 assert.equal(d.documentElement.dataset.theme,'light','Restored backup theme not applied');
 assert.equal(w.TrialumTheme.mode(),'light','Restored backup theme preference lost');
 click('friends');
 assert(d.getElementById('tabContent').textContent.includes('RESTORED_NATIVE_TEST_WORLD'),'Android native restore must replace world after confirmation');
 click('settings');
 await w.TrialumNativeBackupReceived('{bad json');
 assert(d.getElementById('backupFeedback').textContent.includes('не успеа'),'Malformed JSON must show a visible error');
 assert.equal(w.TrialumNativeBackupEvent({ok:false,message:'Тест: грешка'}),undefined);
 assert(d.getElementById('backupFeedback').textContent.includes('Тест: грешка'),'Native picker errors must be surfaced');
 await w.TrialumI18n.change('en');w.TrialumI18n.translateDOM(d.getElementById('tabContent'));
 assert(d.getElementById('tabContent').textContent.includes('Backup & Restore'),'English Backup & Restore heading missing');
 assert(d.querySelector('[data-do="export"]').textContent.includes('Create Backup'),'English create backup button missing');
 assert(d.querySelector('[data-do="import"]').textContent.includes('Restore Backup'),'English restore backup button missing');
 console.log('✓ Native JSON restore, cancel, invalid file feedback and MK/EN Backup & Restore');

 if(process.env.TRIALUM_LOCALE_AUDIT){
  await w.TrialumI18n.change('en');
  for(const page of ['lab','habitats','pets','research','more','dna','food','plants','playground','shared','friends','messages','achievements','diary','notifications','settings']){
   click(page);w.TrialumI18n.translateDOM(d.getElementById('tabContent'));
   const copy=d.getElementById('tabContent').cloneNode(true);
   copy.querySelectorAll('.log-entry,.chat-message,.pet-option,.user-authored,[data-no-translate],#languagePicker option').forEach(n=>n.remove());
   const words=(copy.textContent.match(/[А-Яа-яЀ-ӿ]{3,}/g)||[]);
   const leftovers=[...new Set(words)];
   console.log('LOCALE_AUDIT',page,words.length,leftovers.slice(0,38).join(' | '));
   assert.equal(leftovers.length,0,'English UI still contains untranslated Cyrillic on '+page+': '+leftovers.join(', '));
  }
 }

 assert.equal(errors.length,0,'Browser runtime errors: '+errors.join('\n'));
 dom.window.close();
 console.log('TRIALUM v1.4.1 UI: 11 menus + debug + diary filtering PASS');
}
run().catch(e=>{console.error(e);process.exit(1)});
