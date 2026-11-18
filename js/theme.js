/* TRIALUM 1.5.5: system-aware and manually overridable theme. */
(function(root){
'use strict';
const STORAGE='trialum_theme_preference';
const allowed=['system','dark','light'];
let mode='system';
try{const stored=root.localStorage?.getItem(STORAGE);if(allowed.includes(stored))mode=stored;}catch(_){}
const media=root.matchMedia?.('(prefers-color-scheme: dark)');
const system=()=>media?.matches?'dark':'light';
function apply(){
 const effective=mode==='system'?system():mode;
 if(root.document?.documentElement){
   root.document.documentElement.dataset.theme=effective;
   root.document.documentElement.dataset.themeMode=mode;
   // Also align native form controls and system bars with the effective theme.
   if(root.document.documentElement.style)root.document.documentElement.style.colorScheme=effective;
   const meta=root.document.querySelector('meta[name="theme-color"]');
   meta?.setAttribute('content',effective==='dark'?'#071626':'#f1f7fc');
 }
 return effective;
}
function set(request){
 if(!allowed.includes(request))return false;
 mode=request;
 try{root.localStorage?.setItem(STORAGE,mode);}catch(_){}
 apply();return true;
}
if(media?.addEventListener)media.addEventListener('change',()=>{if(mode==='system')apply();});
else if(media?.addListener)media.addListener(()=>{if(mode==='system')apply();});
// WebView can miss matchMedia callbacks while backgrounded: reapply on return.
// Reapplying a manual override never silently resets the saved preference.
root.document?.addEventListener?.('visibilitychange',()=>{if(!root.document.hidden)apply();});
root.addEventListener?.('pageshow',apply);
root.addEventListener?.('focus',apply);
apply();
root.TrialumTheme={set,apply,mode:()=>mode,effective:()=>mode==='system'?system():mode,options:allowed.slice()};
})(typeof globalThis!=='undefined'?globalThis:this);
