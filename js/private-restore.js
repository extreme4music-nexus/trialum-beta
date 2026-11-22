/* V44 cross-store private restore with durable write-ahead recovery journal.
 * IDB/private-history databases cannot share one transaction: rollback must
 * survive process termination, not only ordinary asynchronous exceptions.
 */
(function(root){
'use strict';
async function run({world,prepare,snapshotWorld,snapshotConversations,
 applyWorld,applyConversations,rollbackWorld,rollbackConversations,
 beginJournal,clearJournal}){
 const prepared=prepare(world);
 const oldWorld=await snapshotWorld();
 const oldConversations=await snapshotConversations();
 const journaled=typeof beginJournal==='function';
 if(journaled&&await beginJournal(oldWorld,oldConversations)!==true)
  throw Error('restore_journal_unavailable');
 try{
  if(await applyWorld(prepared.world)!==true)throw Error('restore_world_write_failed');
  if(await applyConversations()!==true)throw Error('restore_conversations_write_failed');
  if(journaled&&await clearJournal()!==true)throw Error('restore_journal_commit_failed');
  return {ok:true,report:prepared.report};
 }catch(_){
  let worldRestored=false,conversationsRestored=false;
  try{worldRestored=await rollbackWorld(oldWorld)===true;}catch(_){}
  try{conversationsRestored=await rollbackConversations(oldConversations)===true;}catch(_){}
  if(!worldRestored||!conversationsRestored)throw Error('restore_rollback_failed');
  if(journaled){
   try{if(await clearJournal()!==true)throw Error('restore_rollback_failed');}
   catch(_){throw Error('restore_rollback_failed');}
  }
  throw Error('restore_failed_rolled_back');
 }
}
async function recover({readJournal,verifyJournal,restoreWorld,restoreConversations,clearJournal}){
 const journal=await readJournal();
 if(journal===null||journal===undefined)return {recovered:false};
 // Reject untrusted/corrupt write-ahead state BEFORE touching either store.
 if(!verifyJournal(journal))throw Error('restore_recovery_corrupt');
 try{
  if(await restoreWorld(journal.world)!==true)throw Error('restore_recovery_incomplete');
  if(await restoreConversations(journal.friendConversations)!==true)throw Error('restore_recovery_incomplete');
  if(await clearJournal()!==true)throw Error('restore_recovery_incomplete');
 }catch(_){throw Error('restore_recovery_incomplete');}
 return {recovered:true};
}
const api={run,recover};
root.TrialumPrivateRestore=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
