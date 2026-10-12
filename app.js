import {pad,indiaToday,monthKey,monthLength,shiftMonth,monthLabel,firstWeekday,money,emptyMonth,normalizeMonth,summary,parseConfig} from './core.js';
import {firebaseConfig,allowRedirectSignIn} from './firebase-config.js';
const $=id=>document.getElementById(id);
const LOCAL_KEY='chai-diary-months-v1', CONFIG_KEY='chai-diary-firebase-v1', THEME_KEY='chai-diary-theme-v1';
let today=indiaToday(), selected=monthKey(today), view='calendar', months={}, deviceMonths={}, user=null, cloud=null, unsubscribe=null, watchYear=null, loaded=false, cloudReady=false, cached=false, pending=false, loadFailed=false, deviceReadFailed=false, toastTimer, deferredInstall=null, actionCallback=null, writesInFlight=0;
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const isMonthKey=key=>/^\d{4}-(0[1-9]|1[0-2])$/.test(key);
function error(message){$('error-banner').textContent=message;$('error-banner').hidden=false;}
function clearError(){$('error-banner').hidden=true;}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function friendly(e){
  const code=e?.code||'';
  if(code.includes('permission-denied')) return 'Cloud access was denied. Publish firestore.rules in your Firebase project, then reload. Your change was not saved.';
  if(code.includes('unauthorized-domain')) return `Add ${location.hostname} to Firebase Authentication → Settings → Authorized domains.`;
  if(code.includes('operation-not-allowed')) return 'Enable Google in Firebase Authentication → Sign-in method.';
  if(code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return 'Sign-in was cancelled. Tap Sign in with Google to try again.';
  if(code.includes('network-request-failed') || code.includes('unavailable')) return 'Could not connect. Check your internet connection and try again.';
  return e?.message || 'Something went wrong. Please try again.';
}
function loadDevice(){
  try {const raw=JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}');if(!raw||Array.isArray(raw)||typeof raw!=='object') throw Error();deviceMonths={};for(const [k,v] of Object.entries(raw)) if(isMonthKey(k)) deviceMonths[k]=normalizeMonth(v,k);deviceReadFailed=false;if(!user)loadFailed=false;}
  catch {deviceMonths={};error('Device storage could not be read. Avoid making changes until browser storage is available; your existing saved data has not been replaced.');deviceReadFailed=true;if(!user)loadFailed=true;}
}
function current(){return summary(selected,months[selected],today);}
function refreshToday(){const next=indiaToday();if(next!==today){today=next;render();}}
function render(){
  const s=current(), now=monthKey(today), locked=!loaded||loadFailed;
  document.body.classList.toggle('loading',!loaded);
  $('month-heading').textContent=monthLabel(selected);
  $('month-mini').textContent=`${monthLength(selected)} days`;
  $('prev-month').disabled=selected<='2000-01';$('next-month').disabled=selected>=now;
  $('total-amount').textContent=locked?'—':money(s.amount);
  $('calculation').textContent=locked?'Loading your diary…':`${s.teas} ${s.teas===1?'cup':'cups'} × ${money(s.rate)} per cup`;
  $('tea-count').textContent=locked?'—':s.teas;$('tea-rate').textContent=money(s.rate);
  $('paid-badge').textContent=s.paid?'✓ Paid':'Unpaid';$('paid-badge').className=`badge${s.paid?' paid':''}`;
  $('pay-month').innerHTML=icon(s.paid?'history':'check')+`<span>${s.paid?'Undo paid status':'Mark as paid'}</span>`;
  $('pay-month').disabled=locked||(!s.paid && !s.teas);
  $('edit-rate').disabled=locked;
  const isCurrent=selected===now, taken=isCurrent&&s.days[today.slice(-2)];
  $('today-tea').classList.toggle('marked',!!taken);
  $('today-tea').innerHTML=icon(taken?'check':'cup')+`<span>${!isCurrent?'Back to today':taken?'Today’s tea is marked':'Mark today’s tea'}</span><span class="plus">${taken?'✓':'+'}</span>`;
  $('today-tea').disabled=locked;
  $('today-note').textContent=isCurrent?`${new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',weekday:'short',day:'numeric',month:'short'}).format(new Date())} · ${taken?'Tap again to undo':'One tea, one tap'}`:'Open the current month for today’s entry';
  $('payment-note').textContent=s.paid?`Paid${s.paidOn?' on '+s.paidOn.split('-').reverse().join('/') : ''} · Unmark paid to edit`:'Mark paid after you settle with the tea boy';
  $('calendar').replaceChildren();
  for(let i=0;i<firstWeekday(selected);i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');$('calendar').append(blank);}
  for(let d=1;d<=monthLength(selected);d++) {
    const dd=pad(d), date=`${selected}-${dd}`, isToday=date===today, wasTaken=!!s.days[dd];
    const b=document.createElement('button');b.className=`day${wasTaken?' taken':''}${isToday?' today':''}`;b.dataset.day=dd;b.disabled=date>today||locked;
    b.setAttribute('aria-pressed',String(wasTaken));b.setAttribute('aria-label',`${d} ${monthLabel(selected)}${isToday?', today':''}: ${date>today?'future date':wasTaken?'tea taken, tap to undo':'no tea recorded, tap to mark'}`);
    if(isToday)b.setAttribute('aria-current','date');
    b.innerHTML=`<span>${d}</span><span class="day-symbol">${wasTaken?icon('check'):''}</span>`;
    $('calendar').append(b);
  }
  $('no-tea-count').textContent=`${s.without} past days unmarked`;
  $('share-bill').disabled=locked;$('export-month').disabled=locked;
  renderStatus();renderHistory();renderAccount();
}
function renderStatus(){
  const label=!loaded?'Loading your diary…':loadFailed?'Unable to load records':user?(pending?'Changes waiting to sync':cached?(navigator.onLine?'Showing cached cloud records':'Offline · cached cloud records'):'Cloud synced'):(navigator.onLine?'Saved on this device':'Offline · saved on this device');
  $('sync-label').textContent=label;$('storage-strip').className=`storage-strip ${user?'cloud':''} ${pending?'pending':''}`;
  $('connect-shortcut').textContent=user?'Account ↗':cloudReady?'Sign in to sync ↗':'Connect cloud ↗';
}
function renderHistory(){
  const year=selected.slice(0,4), now=monthKey(today);let cups=0,total=0,unpaid=0;
  $('history-year').textContent=year;$('prev-year').disabled=Number(year)<=2000;$('next-year').disabled=Number(year)>=Number(today.slice(0,4));
  $('history-list').replaceChildren();
  for(let m=1;m<=12;m++){
    const key=`${year}-${pad(m)}`, exists=!!months[key],s=summary(key,months[key],today);cups+=s.teas;total+=s.amount;if(!s.paid)unpaid+=s.amount;
    const b=document.createElement('button');b.className=`history-row ${key===now?'current':''}`;b.dataset.month=key;b.disabled=key>now||!loaded||loadFailed;
    b.innerHTML=`<span>${monthLabel(key,true)}${key===now?' · now':''}</span><span>${exists?s.teas:'—'}</span><span>${exists?money(s.amount):'—'}</span><span class="badge ${!exists?'empty':s.paid?'paid':''}">${key>now?'Upcoming':!exists?'No entries':s.paid?'Paid':'Unpaid'}</span>`;
    $('history-list').append(b);
  }
  $('year-cups').textContent=loaded&&!loadFailed?cups:'—';$('year-total').textContent=loaded&&!loadFailed?money(total):'—';$('year-unpaid').textContent=loaded&&!loadFailed?money(unpaid):'—';
}
function renderAccount(){
  $('avatar').textContent=user?(user.displayName||user.email||'U').slice(0,1).toUpperCase():'R';
  if(user?.photoURL){try{const url=new URL(user.photoURL);if(url.protocol==='https:'){const img=document.createElement('img');img.src=url.href;img.alt='';img.referrerPolicy='no-referrer';$('avatar').replaceChildren(img);}}catch{}}
  $('user-info').hidden=!user;$('user-info').textContent=user?`${user.displayName||'Your Google account'} · ${user.email||''}`:'';
  $('google-login').hidden=!cloudReady||!!user;$('google-logout').hidden=!user;
  $('upload-device').hidden=!user||!Object.keys(deviceMonths).length;$('migration-note').hidden=$('upload-device').hidden;
  $('cloud-description').textContent=user?'Your cloud diary is separate from device-only records. Use this Google account and Firebase project on your other devices.':cloudReady?'Cloud is ready. Sign in with Google to open your cloud diary. Device-only records stay separate.':'Connect Firebase and sign in with Google to sync between your phone and computer.';
  $('save-config').disabled=!!user||writesInFlight>0;
}
function subscribe(){
  const year=selected.slice(0,4);
  if(!user){months={...deviceMonths};loaded=true;loadFailed=deviceReadFailed;render();return;}
  if(watchYear===year&&unsubscribe)return;
  unsubscribe?.();watchYear=year;loaded=false;loadFailed=false;months={};render();
  const uid=user.uid;
  unsubscribe=cloud.watch(year,(data,meta)=>{
    if(user?.uid!==uid || watchYear!==year)return;
    months={};for(const [k,v] of Object.entries(data))if(isMonthKey(k)) months[k]=normalizeMonth(v,k);
    pending=meta.pending;cached=meta.cached;loaded=true;loadFailed=false;render();
  },e=>{loaded=true;loadFailed=true;error(friendly(e));render();});
}
function goMonth(key){if(key<'2000-01'||key>monthKey(today))return;selected=key;subscribe();render();}
function setView(next){view=next;$('calendar-panel').hidden=next!=='calendar';$('history-panel').hidden=next!=='history';for(const x of ['calendar','history']){$(`nav-${x}`).classList.toggle('active',next===x);if(next===x)$(`nav-${x}`).setAttribute('aria-current','page');else $(`nav-${x}`).removeAttribute('aria-current');}render();}
function showDialog(id){$(id).showModal();document.body.classList.add('no-scroll');}
function closeDialog(dialog){dialog.close();document.body.classList.remove('no-scroll');}
function ask(title,body,confirm,onConfirm,rate=null){
  $('action-title').textContent=title;$('action-body').textContent=body;$('action-confirm').textContent=confirm;
  $('rate-field').hidden=rate===null;$('rate-input').disabled=rate===null;
  if(rate!==null)$('rate-input').value=rate;
  actionCallback=onConfirm;showDialog('action-dialog');
}
function requireEditable(){if(current().paid){toast('This month is paid. Undo paid status before editing.');return false;}return loaded&&!loadFailed;}
function savePatch(key,patch,success){
  if(!loaded||loadFailed)return;
  clearError();
  const before=months[key]||emptyMonth();
  const next={...before,...patch,days:{...before.days,...(patch.days||{})}};
  for(const [d,v] of Object.entries(next.days))if(v!==true)delete next.days[d];
  if(!user){
    const updated={...deviceMonths,[key]:next};
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify(updated));deviceMonths=updated;months={...updated};render();toast(`${success} · saved on device`);}catch{error('Could not save to this device. Browser storage may be full or blocked. Your change was not saved.');}
    return;
  }
  // Firestore supplies the optimistic local snapshot and rolls it back on rejection.
  const initial=!months[key],uid=user.uid;
  if(initial&&cached){toast('Connect to the internet and wait for cloud sync before starting an uncached month.');return;}
  if(initial&&writesInFlight){toast('Wait for the first cloud entry to finish saving.');return;}
  writesInFlight++;pending=true;renderStatus();renderAccount();
  cloud.write(key,patch,initial).then(()=>{if(user?.uid===uid)toast(`${success} · saved to cloud ✓`);}).catch(e=>{if(user?.uid===uid)error(friendly(e));}).finally(()=>{writesInFlight--;renderAccount();});
  if(!navigator.onLine)toast('Queued on this device · will sync when online');
}
function toggleDay(day){refreshToday();const key=selected,date=`${key}-${day}`;if(date>today||!requireEditable())return;
  if(current().days[day])ask('Remove this cup?',`Remove tea for ${Number(day)} ${monthLabel(key)} from your bill?`,'Remove tea',()=>{if(selected===key&&requireEditable())savePatch(key,{days:{[day]:false}},'Tea removed');});
  else savePatch(key,{days:{[day]:true}},'Tea marked');
}
function download(filename,body,type){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function settings(){renderAccount();showDialog('settings-dialog');}
$('calendar').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b&&!b.disabled)toggleDay(b.dataset.day);});
$('today-tea').addEventListener('click',()=>{refreshToday();if(selected!==monthKey(today)){goMonth(monthKey(today));return;}toggleDay(today.slice(-2));});
$('prev-month').onclick=()=>goMonth(shiftMonth(selected,-1));$('next-month').onclick=()=>goMonth(shiftMonth(selected,1));$('jump-today').onclick=()=>{refreshToday();goMonth(monthKey(today));};
$('nav-calendar').onclick=()=>setView('calendar');$('nav-history').onclick=()=>setView('history');
for(const id of ['nav-settings','account','connect-shortcut'])$(id).onclick=settings;
document.querySelector('.brand').onclick=e=>{e.preventDefault();setView('calendar');goMonth(monthKey(today));};
$('prev-year').onclick=()=>goMonth(`${Number(selected.slice(0,4))-1}-${selected.slice(-2)}`);
$('next-year').onclick=()=>{const y=Number(selected.slice(0,4))+1;goMonth(`${y}-${y===Number(today.slice(0,4))?today.slice(5,7):selected.slice(-2)}`);};
$('history-list').onclick=e=>{const b=e.target.closest('[data-month]');if(b&&!b.disabled){goMonth(b.dataset.month);setView('calendar');window.scrollTo({top:0,behavior:'smooth'});}};
$('edit-rate').onclick=()=>{if(!requireEditable())return;const key=selected;ask('Price per cup',`Set the tea price for ${monthLabel(key)}.`,'Save rate',()=>{const rate=Number($('rate-input').value);if(Number.isFinite(rate)&&rate>0&&rate<=1000&&selected===key&&requireEditable())savePatch(key,{rate:Math.round(rate*100)/100},'Rate updated');},current().rate);};
$('pay-month').onclick=()=>{const key=selected,s=current();ask(s.paid?'Undo paid status?':'All settled?',s.paid?`${monthLabel(key)} will be marked unpaid and editable again.`:`Confirm you paid ${money(s.amount)} for ${s.teas} cups in ${monthLabel(key)}. Paid months are locked until you undo this status.`,s.paid?'Mark unpaid':'Yes, mark paid',()=>{if(selected!==key)return;const latest=current();if(latest.amount!==s.amount||latest.paid!==s.paid||JSON.stringify(latest.days)!==JSON.stringify(s.days)){toast('This bill changed. Review it and confirm payment again.');return;}savePatch(key,{paid:!s.paid,paidOn:s.paid?null:indiaToday()},s.paid?'Marked unpaid':'Payment recorded');});};
$('share-bill').onclick=async()=>{const s=current();const text=`Tea bill – ${monthLabel(selected)}: ${s.teas} teas × ${money(s.rate)} = ${money(s.amount)}\nStatus: ${s.paid?'Paid'+(s.paidOn?' on '+s.paidOn:''):'Unpaid'}\nTea dates: ${Object.keys(s.days).sort().map(Number).join(', ')||'None'}`;try{if(navigator.share)await navigator.share({title:'My tea bill',text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);toast('Bill copied · paste it into WhatsApp');}else{download(`tea-bill-${selected}.txt`,text,'text/plain');toast('Bill downloaded');}}catch(e){if(e.name!=='AbortError'){download(`tea-bill-${selected}.txt`,text,'text/plain');toast('Bill downloaded instead');}}};
$('export-month').onclick=()=>{const s=current();const rows=['Date,Tea taken,Rate INR,Amount INR'];for(let d=1;d<=monthLength(selected);d++){const dd=pad(d),date=`${selected}-${dd}`;if(date<=today)rows.push(`${date},${s.days[dd]?'Yes':'No'},${s.rate},${s.days[dd]?s.rate:0}`);}rows.push('',`Total teas,${s.teas}`,`Total INR,${s.amount}`,`Status,${s.paid?'Paid':'Unpaid'}`,`Paid on,${s.paidOn||''}`);download(`tea-${selected}.csv`,'\uFEFF'+rows.join('\r\n'),'text/csv;charset=utf-8');toast('Monthly CSV downloaded');};
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>closeDialog(b.closest('dialog')));
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('close',()=>document.body.classList.remove('no-scroll'));d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);}});});
$('action-form').onsubmit=e=>{e.preventDefault();const callback=actionCallback;actionCallback=null;closeDialog($('action-dialog'));callback?.();};
$('current-host').textContent=location.hostname;
$('save-config').onclick=()=>{try{const config=parseConfig($('config-input').value);localStorage.setItem(CONFIG_KEY,JSON.stringify(config));location.reload();}catch(e){toast(friendly(e));}};
$('google-login').onclick=async()=>{const b=$('google-login');b.disabled=true;b.textContent='Opening Google…';try{await cloud.login();if($('settings-dialog').open)closeDialog($('settings-dialog'));}catch(e){if(e.code==='auth/popup-blocked'&&allowRedirectSignIn){await cloud.redirect().catch(e=>toast(friendly(e)));}else if(e.code==='auth/popup-blocked'){toast('Allow pop-ups for this site, then tap Sign in again. Open in Chrome or Safari, not inside WhatsApp.');}else toast(friendly(e));}finally{b.disabled=false;b.textContent='Sign in with Google';}};
$('google-logout').onclick=async()=>{if(pending||writesInFlight){toast('Wait until pending changes sync before signing out.');return;}try{await cloud.logout();toast('Signed out · showing device-only records');}catch(e){toast(friendly(e));}};
$('upload-device').onclick=async()=>{if(!navigator.onLine){toast('Reconnect before copying records to cloud.');return;}const b=$('upload-device');b.disabled=true;try{const result=await cloud.copyMissing(deviceMonths);toast(`${result.copied} months copied · ${result.skipped} existing cloud months skipped`);}catch(e){toast('Copy stopped: '+friendly(e));}finally{b.disabled=false;}};
$('backup').onclick=async()=>{const b=$('backup');b.disabled=true;try{if(user&&!navigator.onLine)throw Error('Reconnect to download all cloud months.');const data=user?await cloud.all():deviceMonths;const clean={};for(const [key,value] of Object.entries(data))if(isMonthKey(key))clean[key]=normalizeMonth(value,key);download(`chai-diary-backup-${indiaToday()}.json`,JSON.stringify({app:'Chai Diary',version:1,exportedOn:indiaToday(),mode:user?'cloud':'device',months:clean},null,2),'application/json');toast('Backup downloaded');}catch(e){toast(friendly(e));}finally{b.disabled=false;}};
function setTheme(theme,persist=false){if(theme==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=theme;document.querySelectorAll('[data-theme-choice]').forEach(b=>{b.classList.toggle('active',b.dataset.themeChoice===theme);b.setAttribute('aria-pressed',String(b.dataset.themeChoice===theme));});if(persist)try{localStorage.setItem(THEME_KEY,theme);}catch{toast('Theme changed for this visit only');}}
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>setTheme(b.dataset.themeChoice,true));
window.addEventListener('online',renderStatus);window.addEventListener('offline',renderStatus);
window.addEventListener('storage',e=>{if(e.key===LOCAL_KEY){loadDevice();if(!user){months={...deviceMonths};render();}}});
window.addEventListener('focus',refreshToday);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday();});setInterval(refreshToday,60000);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('install-app').hidden=false;});$('install-app').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install-app').hidden=true;}};
async function boot(){
  loadDevice();try{setTheme(localStorage.getItem(THEME_KEY)||'system');}catch{setTheme('system');}
  let config=null;try{const stored=localStorage.getItem(CONFIG_KEY);config=parseConfig(stored||JSON.stringify(firebaseConfig));}catch{}
  months={...deviceMonths};loaded=!config;render();
  if(config){try{const {createCloud}=await import('./cloud.js');cloud=createCloud(config,u=>{if($('action-dialog').open)closeDialog($('action-dialog'));actionCallback=null;unsubscribe?.();unsubscribe=null;watchYear=null;user=u;pending=false;cached=false;loadFailed=false;clearError();subscribe();},e=>{error(friendly(e));loaded=true;render();});cloudReady=true;renderAccount();}catch(e){loaded=true;error('Cloud could not start. Device mode is available. Check your Firebase config and internet, then reload. '+friendly(e));render();}}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
