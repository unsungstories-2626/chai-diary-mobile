// All SDK modules use the same pinned modular Firebase v10 release.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, collection, query, where, documentId, onSnapshot, doc, setDoc, getDocs, deleteField, serverTimestamp, runTransaction, waitForPendingWrites} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
export function createCloud(config, onUser, onError) {
  const app=initializeApp(config), auth=getAuth(app);
  let db;
  try { db=initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}); }
  catch { db=initializeFirestore(app,{localCache:memoryLocalCache()}); onError(Error('Persistent cache is unavailable. Keep this tab open until changes finish syncing.')); }
  const ref=key=>doc(db,'users',auth.currentUser.uid,'months',key);
  onAuthStateChanged(auth,onUser,onError);
  getRedirectResult(auth).catch(onError);
  return {
    login:()=>signInWithPopup(auth,new GoogleAuthProvider()),
    redirect:()=>signInWithRedirect(auth,new GoogleAuthProvider()),
    logout:()=>signOut(auth),
    flush:()=>waitForPendingWrites(db),
    watch(year,onData,onFailure){
      const q=query(collection(db,'users',auth.currentUser.uid,'months'),where(documentId(),'>=',`${year}-01`),where(documentId(),'<=',`${year}-12`));
      return onSnapshot(q,{includeMetadataChanges:true},snapshot=>{
        const months={}; snapshot.forEach(d=>months[d.id]=d.data());
        onData(months,{cached:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites});
      },onFailure);
    },
    write(key,patch,initial){
      // Leaf-field merges keep changes to different days from overwriting each other.
      const data={...patch,updatedAt:serverTimestamp()};
      const fields=['updatedAt'];
      if(initial) {data.rate??=12;data.paid??=false;data.paidOn??=null;fields.push('rate','paid','paidOn');}
      for(const k of Object.keys(patch)) {
        if(k==='days') { for(const [day,taken] of Object.entries(patch.days)) {data.days={...data.days,[day]:taken?true:deleteField()};fields.push(`days.${day}`);} }
        else fields.push(k);
      }
      return setDoc(ref(key),data,{mergeFields:[...new Set(fields)]});
    },
    async all(){const result={};const snap=await getDocs(collection(db,'users',auth.currentUser.uid,'months'));snap.forEach(d=>result[d.id]=d.data());return result;},
    async copyMissing(months){
      let copied=0,skipped=0;
      for(const [key,value] of Object.entries(months)) {
        const added=await runTransaction(db,async transaction=>{
          const target=ref(key), existing=await transaction.get(target);
          if(existing.exists()) return false;
          transaction.set(target,{...value,updatedAt:serverTimestamp()});return true;
        });
        if(added) copied++;else skipped++;
      }
      return {copied,skipped};
    }
  };
}
