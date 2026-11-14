/* TRIALUM 1.5.5: locale, theme, onboarding and evolved Mnemos regression. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..'),source=p=>fs.readFileSync(path.join(root,p),'utf8');
const locales=['mk','en','es','fr','de','it','pt','tr','sq','ar','zh','ja','ko','ru','hi','id','pl'];
let passed=0;
async function test(title,fn){await fn();passed++;console.log('✓ '+title)}
async function main(){
 await test('17 unique offline locale files with translated essential navigation and fallback metadata',()=>{
   const codes=new Set();
   for(const code of locales){
     const catalog=JSON.parse(source('locales/'+code+'.json'));
     assert.equal(catalog.language,code);
     assert(!codes.has(code));codes.add(code);
     assert(catalog.strings&&Object.keys(catalog.strings).length>=3);
     if(!['mk','en'].includes(code)){
       assert(Object.keys(catalog.strings).length>=40,'Core language pack is incomplete: '+code);
       for(const key of ['Поставки','Миленици','Туторијал','Светла тема','Темна тема']){
         assert(typeof catalog.strings[key]==='string'&&catalog.strings[key].trim());
       }
     }
   }
   assert.equal(codes.size,17);
 });
 await test('Automatic device language selection and persistence of English fallback',async()=>{
   const context={navigator:{languages:['es-MX','en-US']},
     document:{documentElement:{lang:'mk'}},
     fetch:async url=>({ok:true,json:async()=>JSON.parse(source(url))}),
     console,localStorage:{getItem:()=>null}};
   context.globalThis=context;vm.createContext(context);
   vm.runInContext(source('js/i18n.js'),context);
   const api=context.TrialumI18n;
   assert.equal(await api.change('auto'),'es');
   assert.equal(api.preference(),'auto');
   assert.equal(api.t('Поставки'),'Ajustes');
   assert.equal(api.t('Се согласувам за локален AI'),'Allow local AI');
   assert.equal(await api.change('en'),'en');
   assert.equal(api.t('Напредна интелигенција на Мнемос'),'Mnemos advanced intelligence');
   assert.equal(await api.change('xx'),'es');
 });
 await test('System theme follows device, manual override persists, and restoring system resumes listening',()=>{
   let dark=true,listener=null,stored=null;
   const doc={documentElement:{dataset:{}},querySelector:()=>({setAttribute(){}})};
   const ctx={document:doc,localStorage:{getItem:()=>stored,setItem:(_,x)=>{stored=x}},
     matchMedia:()=>({get matches(){return dark},addEventListener:(_,fn)=>{listener=fn}})};
   ctx.globalThis=ctx;vm.createContext(ctx);
   vm.runInContext(source('js/theme.js'),ctx);
   assert.equal(ctx.TrialumTheme.effective(),'dark');
   assert(ctx.TrialumTheme.set('light'));
   assert.equal(doc.documentElement.dataset.theme,'light');
   dark=false;listener();assert.equal(doc.documentElement.dataset.theme,'light');
   assert(ctx.TrialumTheme.set('system'));assert.equal(doc.documentElement.dataset.theme,'light');
   dark=true;listener();assert.equal(doc.documentElement.dataset.theme,'dark');
   assert.equal(stored,'system');
   assert.equal(ctx.TrialumTheme.set('invalid'),false);
 });
 await test('WebView resume reapplies saved theme without replacing manual choice',()=>{
   let dark=true,shown=false;const events={};const mql={get matches(){return dark},addEventListener:(name,fn)=>{events.media=fn}};
   const el={dataset:{},style:{}},meta={setAttribute:()=>{}};
   const doc={documentElement:el,get hidden(){return !shown},querySelector:()=>meta,
     addEventListener:(name,fn)=>{events['doc-'+name]=fn}};
   const ctx={document:doc,matchMedia:()=>mql,addEventListener:(name,fn)=>{events[name]=fn},
     localStorage:{getItem:()=>null,setItem:()=>{}}};
   ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(source('js/theme.js'),ctx);
   assert.equal(el.style.colorScheme,'dark');
   assert(ctx.TrialumTheme.set('light'));
   assert.equal(el.dataset.themeMode,'light');
   dark=false;shown=true;events['doc-visibilitychange']();
   assert.equal(el.dataset.theme,'light');
   dark=true;events.pageshow();assert.equal(el.dataset.theme,'light','manual override lost on resume');
   ctx.TrialumTheme.set('system');dark=false;events.focus();
   assert.equal(el.dataset.theme,'light');
   dark=true;events.media();assert.equal(el.dataset.theme,'dark');
   const css=source('assets/style.css');
   for(const selector of ['.mast','.primary-game-nav','.hud-stat','.welcome-card','.locked-card']){
     assert(css.includes(':root[data-theme="light"] '+selector),'no light-mode style for '+selector);
   }
 });
 await test('English first-run, friends and playground essential copy has exact translations',()=>{
   const en=JSON.parse(source('locales/en.json'));
   for(const sourceText of [
     'Од неживи атоми ќе создаваш свој непознат жив свет. Нема брза победа — играта се развива со тебе.',
     'Поканата истекла или веќе е искористена.',
     'Пораките сè уште не се активирани на серверот.',
     'Заедничката игротека сè уште не е овозможена на серверот.',
     'Песочник со симболи'
   ])assert(en.strings[sourceText]&&!/[А-Яа-яЀ-ӿ]/.test(en.strings[sourceText]),'missing English '+sourceText);
 });
 await test('Light mode preserves Trialum geometry and uses readable, brighter surface tokens',()=>{
   const css=source('assets/style.css');
   assert(css.includes('155-04: Trialum\'s original layered visual language'));
   const preview=source('tests/theme-preview.html');
   assert(preview.includes('assets/style.css')&&preview.includes('mode=light')===false);
   assert(preview.includes('document.documentElement.dataset.theme')&&preview.includes('mode')&&preview.includes('primary-game-nav'));
   const rgb=hex=>hex.match(/[a-f0-9]{2}/ig).map(x=>parseInt(x,16)/255)
     .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
   const luminance=hex=>rgb(hex.replace('#','')).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   assert(luminance('#e8f3f8')>luminance('#07131f')*4,'Light background is not meaningfully brighter');
   assert(contrast('#163548','#ffffff')>=7,'Primary text must be strongly legible');
   assert(contrast('#416373','#f6fbff')>=4.5,'Muted text must be legible on light panels');
   for(const selector of ['.panel','.card','.mast','.primary-game-nav','.hud-xp','.hud-tokens','.progress']){
      assert(css.includes(':root[data-theme="light"] '+selector),'daylight design missing '+selector);
   }
 });
 await test('Intro and tutorial are skippable and replayable, without game mutations',()=>{
   const dom=new JSDOM('<!doctype html><body><button id="base">Start</button></body>',{
     url:'https://trialum.invalid/',runScripts:'outside-only'
   });
   dom.window.TrialumI18n={language:()=> 'en',t:()=>null};
   dom.window.eval(source('js/onboarding.js'));
   const api=dom.window.TrialumOnboarding;
   const baseline=dom.window.document.body.querySelector('#base').textContent;
   assert.equal(api.maybeIntro(),true);
   assert.equal(api.state().active,'intro');
   dom.window.document.querySelector('[data-tour="skip"]').click();
   assert.equal(api.state().introSeen,true);
   assert.equal(api.maybeIntro(),false);
   assert.equal(api.maybeTutorial(),true);
   for(let i=0;i<5;i++)dom.window.document.querySelector('[data-tour="next"]').click();
   assert.equal(api.state().tutorialSeen,true);
   assert.equal(api.open('tutorial'),true);
   api.close();assert.equal(api.state().active,null);
   assert.equal(dom.window.document.querySelector('#base').textContent,baseline);
 });
 await test('Mnemos unlock is retroactive and rejects unevolved or other creatures',()=>{
   const p={id:'mnemos-old',name:'Mnemos',species:9,seed:1234,evolution:{level:165},
       actionsLeft:0,joy:85,energy:90,satiety:80,bond:65,chatHistory:[]};
   const s={research:{level:20},pets:[p],selectedPet:p.id};
   const apiMock={modelStatusTier:()=> 'installed',askPetAdvanced:(...args)=>calls.push(args),
     chooseModelTier:(...args)=>imports.push(args)};
   let calls=[],imports=[];
   const context={TrialumAndroid:apiMock,TrialumI18n:{language:()=> 'en',t:()=>null},
     TrialumEngine:{SPECIES:Array.from({length:12},()=>({name:'test species'})),evolutionProgress:x=>({level:x.evolution.level}),currentPet:x=>x.pets.find(y=>y.id===x.selectedPet)},
     document:{getElementById:()=>({value:'Hello there'})},
     confirm:()=>true,TrialumWorld:{playTrick:()=>true}};
   context.globalThis=context;vm.createContext(context);vm.runInContext(source('js/advanced-intelligence.js'),context);
   const api=context.TrialumMind,ctx={toast:()=>{},render:()=>{},scheduleSave:()=>{}};
   assert(api.eligible(s,p));
   assert(!api.eligible(s,{...p,species:8}));
    assert(api.eligible(s,{...p,species:10}), 'more advanced species should retain Mnemos AI');
    assert(api.downloadEvent('error','deep','deep download failed: HTTP 404'));
    const diag=api.render(s,p);
    assert(diag.includes('mindToggle'));
   assert(!api.eligible({...s,research:{level:19}},p));
   assert(!api.eligible(s,{...p,evolution:{level:164}}));
   assert(api.render(s,p).includes('mindToggle'));
   api.handle('mindToggle',null,s,ctx);
   assert(p.mind.enabled);
   api.handle('mindImport',{dataset:{tier:'deep'}},s,ctx);
   assert.equal(imports.length,1,'user-initiated GGUF import must route through Android document picker');
   assert.equal(imports[0][0],'deep');
   api.handle('mindAsk',{dataset:{}},s,ctx);
   assert.equal(calls.length,1);
   assert.equal(calls[0][3],'compact');
   assert.equal(p.actionsLeft,0,'LLM chat must not use daily actions');
   assert(context.TrialumLocalChat.busy());
   api.handle('mindAsk',{dataset:{}},s,ctx);
   assert.equal(calls.length,1,'duplicate submit while generating is blocked');
   for(let i=0;i<18;i++){
    context.TrialumLocalChat.finish(p.id);
    api.handle('mindAsk',{dataset:{}},s,ctx);
    assert.equal(calls.length,2+i,'repeated local Qwen chat in one day');
    assert.equal(p.actionsLeft,0);
   }
   context.TrialumLocalChat.finish(p.id);
   assert.equal(p.mind.turns,19);
   assert(p.chatHistory.length<=12);
   for(let i=0;i<22;i++)api.onReply(s,p,'Hello '+i);
   assert(p.mind.memories.length<=8);
   assert.equal(p.reaction==='spin'||p.reaction==='wave',true);
   api.handle('mindToggle',null,s,ctx);
   assert.equal(p.mind.enabled,false);
 });
 await test('Source and offline cache include all newly introduced 1.5.5 assets',()=>{
   const sw=source('sw.js'),html=source('index.html');
   for(const file of ['js/theme.js','js/onboarding.js','js/advanced-intelligence.js',...locales.map(code=>'locales/'+code+'.json')]){
     assert(sw.includes(file),'uncached '+file);
     assert(fs.existsSync(path.join(root,file)));
   }
   assert(html.includes('js/theme.js')&&html.includes('js/onboarding.js')&&html.includes('js/advanced-intelligence.js'));
 });
 console.log('TRIALUM 1.5.5 regression:',passed,'passed');
}
main().catch(error=>{console.error(error);process.exitCode=1});
