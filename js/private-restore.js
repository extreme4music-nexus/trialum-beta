/* V44 coordinated local world + friend-history restoration.
 * These stores cannot share a real browser transaction; verify every rollback
 * and stop on any incomplete recovery rather than reporting success.
 */
(function(root){
'use strict';
async function run({world,prepare,snapshotWorld,snapshotConversations,
 applyWorld,applyConversations,rollbackWorld,rollbackConversations}){
 const prepared=prepare(world);
 // Both snapshots must be obtained BEFORE any local persistent write.
 const oldWorld=await snapshotWorld();
 const oldConversations=await snapshotConversations();
 try{
  if(await applyWorld(prepared.world)!==true)throw Error('restore_world_write_failed');
  if(await applyConversations()!==true)throw Error('restore_conversations_write_failed');
  return {ok:true,report:prepared.report};
 }catch(_){
  let worldRestored=false,conversationsRestored=false;
  try{worldRestored=await rollbackWorld(oldWorld)===true;}catch(_){}
  try{conversationsRestored=await rollbackConversations(oldConversations)===true;}catch(_){}
  if(!worldRestored||!conversationsRestored)throw Error('restore_rollback_failed');
  throw Error('restore_failed_rolled_back');
 }
}
const api={run};root.TrialumPrivateRestore=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
