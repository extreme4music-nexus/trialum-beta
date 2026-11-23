/* v44 owner requirement 07: only foreground Mini in shared rooms, no background AI after close. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base='android-template/app/src/main/java/com/trialum/ziivaiskra/';
const read=p=>fs.readFileSync(require('node:path').join(__dirname,'..',p),'utf8');
function test(name,fn){fn();console.log('PASS',name)}
const activity=read(base+'MainActivity.kt');
const model=read(base+'ModelRuntime.kt');
const service=read(base+'TrialumBackgroundSpeechService.kt');
const playground=read('js/playground-ai.js');
test('Android Activity stops independent AI on app stop rather than resumes',()=>{
 const stop=activity.split('override fun onStop()')[1].split('override fun onDestroy()')[0];
 assert(stop.includes('TrialumBackgroundSpeechService.STOP'));
 assert(!stop.includes('TrialumBackgroundSpeechService.RESUME'));
 assert(stop.includes('modelRuntime.onHidden()'));
 assert(activity.includes('modelRuntime.destroy()'));
});
test('Android JS bridge cannot start background inference in this beta',()=>{
 const block=activity.split('@JavascriptInterface fun setPlaygroundBackgroundAi(')[1]
  .split('@JavascriptInterface fun modelStatus()')[0];
 assert(block.includes('return !enabled'));
 assert(!block.includes('startForegroundService'));
 assert(block.includes('TrialumBackgroundSpeechService.STOP'));
});
test('legacy background service rejects both START and RESUME commands',()=>{
 const s=service.split('override fun onStartCommand(')[1]
  .split('private fun channel()')[0];
 for(const action of ['START','RESUME']){
  const segment=s.split(action+' -> {')[1].split('}')[0];
  assert(segment.includes('stopSelf()'),action);
  assert(segment.includes('START_NOT_STICKY'),action);
 }
});
test('native GGUF model is loaded per request, released in finally and canceled on hidden',()=>{
 assert(model.includes('Llama.loadModel('));
 assert(model.includes('Llama.releaseModel(native)'));
 assert(model.includes('generation?.cancel()'));
 assert(model.includes('fun destroy() { onHidden(); scope.cancel() }'));
 assert(model.includes('if (!visible || (playground && playgroundCancelled))'));
});
test('only smallest mini may speak in any playground; advanced remains private',()=>{
 assert(model.includes('if (playground && tier != "mini")'));
 assert(activity.includes('modelRuntime.ask(petId, petName, text, "mini", context, true)'));
 assert(playground.includes("scope==='shared'?'playground-shared':'playground-local'"));
});
test('front-end disarms legacy background toggle and cancels on navigation and hide',()=>{
 assert(playground.includes("root.addEventListener?.('pagehide',()=>stop())"));
 assert(playground.includes("root.document?.addEventListener?.('freeze',()=>stop())"));
 assert(playground.includes("if(root.document?.visibilityState==='hidden')stop()"));
 const ctrl=playground.split('function toggleBackground(')[1].split('function forget(')[0];
 assert(ctrl.includes("setPlaygroundBackgroundAi?.(false"));
 assert(!ctrl.includes("setPlaygroundBackgroundAi(true"));
});
console.log('V44 AI LIFECYCLE GATES PASSED');
