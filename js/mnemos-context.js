/* Legacy V44 entrypoint; all model contexts use the same pet-owned assembler. */
(function(root){
'use strict';
const MAX=2200;
function assemble(p,s,prompt,{language='mk',traits={},emotion='curious',history=[],legacy=[]}={}){
 const provider=root.TrialumAIContext||
  (typeof require==='function'?require('./ai-context.js'):null);
 if(!provider)throw Error('unified AI context unavailable');
 return provider.assemble(p,s,prompt,{
  scope:'private',tier:'advanced',language,traits,emotion,history,legacy,maxChars:MAX
 });
}
const api={MAX,assemble};root.TrialumMnemosContext=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
