export const pad = n => String(n).padStart(2, '0');
export function indiaToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const monthKey = date => date.slice(0, 7);
export function monthLength(key) { const [y,m] = key.split('-').map(Number); return new Date(y,m,0).getDate(); }
export function shiftMonth(key, delta) { const [y,m] = key.split('-').map(Number); const d = new Date(y,m-1+delta,1); return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
export function monthLabel(key, short = false) { const [y,m] = key.split('-').map(Number); return new Date(y,m-1,1).toLocaleDateString('en-IN',{month:short?'short':'long',...(short?{}:{year:'numeric'})}); }
export function firstWeekday(key) { const [y,m] = key.split('-').map(Number); return (new Date(y,m-1,1).getDay()+6)%7; }
export const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
export const emptyMonth = () => ({rate:12,days:{},paid:false,paidOn:null});
export function normalizeMonth(raw, key, today = indiaToday()) {
  const out = emptyMonth();
  if (Number.isFinite(raw?.rate) && raw.rate > 0 && raw.rate <= 1000) out.rate = Math.round(raw.rate*100)/100;
  for(let d=1; d<=monthLength(key); d++) if (raw?.days?.[pad(d)] === true && `${key}-${pad(d)}` <= today) out.days[pad(d)] = true;
  out.paid = raw?.paid === true;
  out.paidOn = typeof raw?.paidOn === 'string' ? raw.paidOn : null;
  return out;
}
export function summary(key, data, today = indiaToday()) {
  const m = normalizeMonth(data, key, today);
  const teas = Object.keys(m.days).length;
  let past = 0, pastTaken = 0;
  for(let d=1;d<=monthLength(key);d++) if(`${key}-${pad(d)}` < today) { past++; if(m.days[pad(d)]) pastTaken++; }
  return {...m,teas,amount:Math.round(teas*m.rate*100)/100,without:past-pastTaken};
}
export function parseConfig(text) {
  const start=text.indexOf('{'), end=text.lastIndexOf('}');
  if(start<0 || end<start) throw Error('Paste the firebaseConfig object from Firebase project settings.');
  const json=text.slice(start,end+1).replace(/^\s*\/\/.*$/gm,'').replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g,'$1"$2":').replace(/,\s*}/g,'}');
  const raw=JSON.parse(json);
  const config={};
  for(const k of ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId']) if(typeof raw[k]==='string') config[k]=raw[k];
  for(const k of ['apiKey','authDomain','projectId','appId']) if(!config[k] || /PASTE|YOUR_/i.test(config[k])) throw Error(`Your config is missing a real ${k}.`);
  if(!/^[a-z0-9.-]+$/i.test(config.authDomain)) throw Error('authDomain must be a hostname, without https:// or a path.');
  return config;
}
