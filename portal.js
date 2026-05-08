const SB_URL=‘https://oneykldgivaqcrqmrqha.supabase.co’;
const SB_KEY=‘eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZXlrbGRnaXZhcWNycW1ycWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5OTQ4NTYsImV4cCI6MjA5MzU3MDg1Nn0.Os-XjWM6nJuFOLLQhBUH0DUL40So-jkpXGx9iBequyw’;
const H={‘apikey’:SB_KEY,‘Authorization’:`Bearer ${SB_KEY}`,‘Content-Type’:‘application/json’,‘Prefer’:‘return=representation’};

async function sb(method,table,body=null,params=’’){
const res=await fetch(`${SB_URL}/rest/v1/${table}${params}`,{method,headers:H,body:body?JSON.stringify(body):null});
if(!res.ok)throw new Error(await res.text());
const t=await res.text();return t?JSON.parse(t):[];
}

const CLIENT_ID=‘06acdc81-5f0b-4481-917a-d27baf89bc51’;
let cli=null,sess=[],aDay=null;
const DN=[‘Su’,‘Mo’,‘Tu’,‘We’,‘Th’,‘Fr’,‘Sa’];

function toast(m){const t=document.getElementById(‘toast’);t.textContent=m;t.classList.add(‘show’);setTimeout(()=>t.classList.remove(‘show’),3000);}
function greet(){const h=new Date().getHours();return h<12?‘Good morning’:h<17?‘Good afternoon’:‘Good evening’;}

function getSM(){
const prog=cli.structured_program;
if(!prog?.days)return{};
const days=prog.days,sc=(cli.schedule||’’).toLowerCase();
const dm={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
const m=[],map={};
Object.keys(dm).forEach(k=>{if(sc.includes(k)&&!m.includes(dm[k]))m.push(dm[k]);});
m.sort((a,b)=>a-b);
m.forEach((d,i)=>{if(i<days.length)map[d]=i;});
return map;
}

async function init(){
try{
const clients=await sb(‘GET’,‘clients’,null,`?id=eq.${CLIENT_ID}`);
cli=clients[0];
sess=await sb(‘GET’,‘sessions’,null,`?client_id=eq.${CLIENT_ID}&order=created_at.desc`);
document.getElementById(‘cname’).textContent=`${cli.first} ${cli.last||''}`.trim();
document.getElementById(‘clvl’).textContent=`${cli.level||''} · ${cli.duration||60} min`;
const sm=getSM(),ti=new Date().getDay();
aDay=sm[ti]!==undefined?sm[ti]:null;
render();
}catch(e){
document.getElementById(‘main’).innerHTML=`<p style="padding:20px;color:#f87171">Error: ${e.message}</p>`;
}
}

function render(){
const prog=cli.structured_program,days=prog?.days||[],sm=getSM();
const now=new Date(),ds=now.toLocaleDateString(‘en-US’,{month:‘short’,day:‘numeric’,year:‘numeric’});
const tL=sess.some(s=>s.date===ds);
const sow=new Date(now);sow.setDate(now.getDate()-now.getDay());

let week=’<div class="week">’;
for(let i=0;i<7;i++){
const d=new Date(sow);d.setDate(sow.getDate()+i);
const di=d.getDay(),isTod=d.toDateString()===now.toDateString(),pdi=sm[di];
const hasW=pdi!==undefined;
const dStr=d.toLocaleDateString(‘en-US’,{month:‘short’,day:‘numeric’,year:‘numeric’});
const isLog=sess.some(s=>s.date===dStr);
const cls=`wd${isTod&&aDay!==null?' active':hasW?' workout':''}${isLog?' done':''}`;
const wn=hasW&&days[pdi]?days[pdi].name.split(’ ‘)[0]:’’;
const dotC=isTod&&aDay!==null?‘rgba(255,255,255,0.6)’:isLog?’#34d399’:hasW?’#60a5fa’:‘transparent’;
week+=`<div class="${cls}" onclick="selDay(${pdi??'null'})"> <div style="font-size:9px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${isTod&&aDay!==null?'rgba(255,255,255,0.8)':'rgba(180,200,235,0.4)'}">${DN[di]}</div> <div style="font-size:16px;font-weight:700;margin:2px 0;color:${isTod&&aDay!==null?'#fff':'#eef2fa'}">${d.getDate()}</div> <div style="width:5px;height:5px;border-radius:50%;margin:3px auto 0;background:${dotC}"></div> ${wn?`<div style="font-size:7px;color:rgba(100,160,255,0.6);margin-top:2px">${wn}</div>`:''} </div>`;
}
week+=’</div>’;

let wc=’’;
if(aDay===null){
wc=`<div class="rest"><div style="font-size:40px;margin-bottom:12px">😴</div><div style="font-size:18px;font-weight:700;margin-bottom:6px">Rest Day</div><div style="font-size:13px;color:rgba(180,200,235,0.45)">No workout today.<br>Recovery is part of the program!</div></div>`;
} else {
const day=days[aDay],hist=cli.exercise_history||{};
const exs=day.exercises.map((ex,i)=>{
const key=ex.name.toLowerCase().replace(/\s+/g,’_’),last=hist[key];
const isSS=/^SS/i.test(ex.name),nm=ex.name.replace(/^SS\w+:\s*/i,’’);
return `<div class="ex${isSS?' ss':''}"> ${isSS?'<span style="font-size:8px;font-weight:700;letter-spacing:2px;color:#fbbf24;background:rgba(251,191,36,0.1);border-radius:4px;padding:2px 6px;display:inline-block;margin-bottom:7px">SUPERSET</span>':''} <div style="font-size:15px;font-weight:600;margin-bottom:3px">${nm}</div> <div style="font-size:12px;color:#60a5fa;margin-bottom:8px">${ex.prescription}${ex.load?`  ·  <span style="color:rgba(180,200,235,0.45)">${ex.load}</span>`:''}</div> ${last?`<div style="font-size:11px;color:#60a5fa;background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.2);border-radius:6px;padding:5px 10px;display:inline-block;margin-bottom:10px">Last: ${last.reps||’—’}  ·  ${last.weight||’—’}</div>`:''} <div class="inputs"> <div><input id="r${i}" placeholder="${last?.reps||'Sets x Reps'}"><div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(180,200,235,0.45);text-align:center;margin-top:4px">Sets x Reps</div></div> <div><input id="w${i}" placeholder="${last?.weight||'Weight / Load'}"><div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(180,200,235,0.45);text-align:center;margin-top:4px">Weight / Load</div></div> </div> </div>`;
}).join(’’);
wc=`<div style="background:#0d1018;border:1px solid rgba(120,160,255,0.18);border-radius:16px;padding:18px 20px;margin-bottom:14px;position:relative;overflow:hidden"> <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#2563eb,#60a5fa,#93c5fd)"></div> <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(180,200,235,0.45);margin-bottom:6px">Today's Workout</div> <div style="font-size:22px;font-weight:700">${day.name}</div> <div style="font-size:12px;color:rgba(180,200,235,0.45);margin-top:4px">${day.exercises.length} exercises${tL?' &nbsp;·&nbsp; <span style="color:#34d399">✓ Logged today</span>':''}</div> </div>${exs} <textarea class="note" id="snote" placeholder="Add a note (optional)..."></textarea> <button class="log-btn" id="lbtn" onclick="logIt()">⚡ &nbsp;Log This Workout</button>`;
}

let hh=’’;
if(sess.length>0){
hh=`<div style="margin-top:28px"><div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(180,200,235,0.45);margin-bottom:12px">Recent Sessions</div>`
+sess.slice(0,5).map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(120,160,255,0.08)"> <div><div style="font-size:13px;font-weight:600">${s.date}</div>${s.workout?.length?`<div style="font-size:11px;color:rgba(180,200,235,0.45);margin-top:2px">${s.workout.slice(0,3).map(w=>w.name.replace(/^SS\w+:\s*/i,’’)).join(’ · ‘)}${s.workout.length>3?` +${s.workout.length-3} more`:’’}</div>`:''}</div> <span style="font-size:10px;color:#34d399;font-weight:700">✓ DONE</span> </div>`).join(’’)+’</div>’;
}

document.getElementById(‘main’).innerHTML=
`<div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(180,200,235,0.45);margin-bottom:6px">Client Portal</div> <div style="font-size:26px;font-weight:700;line-height:1.2;margin-bottom:6px;font-family:'Syne',sans-serif">${greet()},<br>${cli.first} 👋</div> <div style="font-size:13px;color:rgba(180,200,235,0.45);margin-bottom:24px">${aDay!==null?'Here\'s your workout for today.':'Rest up — no workout today.'}</div> ${week}${wc}${hh}`;
}

function selDay(idx){if(idx===null||idx===undefined)return;aDay=idx;render();}

async function logIt(){
const btn=document.getElementById(‘lbtn’);
if(!btn)return;
btn.disabled=true;btn.textContent=‘Saving…’;
const day=cli.structured_program.days[aDay];
const ds=new Date().toLocaleDateString(‘en-US’,{month:‘short’,day:‘numeric’,year:‘numeric’});
const note=document.getElementById(‘snote’)?.value.trim()||’’;
const hist=Object.assign({},cli.exercise_history||{}),wo=[];
day.exercises.forEach((ex,i)=>{
const r=document.getElementById(`r${i}`)?.value.trim();
const w=document.getElementById(`w${i}`)?.value.trim();
if(r||w){hist[ex.name.toLowerCase().replace(/\s+/g,’_’)]={reps:r||’’,weight:w||’’,date:ds};wo.push({name:ex.name,reps:r||’’,weight:w||’’});}
});
try{
await sb(‘POST’,‘sessions’,{client_id:CLIENT_ID,date:ds,note,workout:wo});
await sb(‘PATCH’,‘clients’,null,`?id=eq.${CLIENT_ID}`);
await fetch(`${SB_URL}/rest/v1/clients?id=eq.${CLIENT_ID}`,{method:‘PATCH’,headers:H,body:JSON.stringify({exercise_history:hist})});
cli.exercise_history=hist;
sess=await sb(‘GET’,‘sessions’,null,`?client_id=eq.${CLIENT_ID}&order=created_at.desc`);
const ov=document.createElement(‘div’);
ov.style.cssText=‘position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.8);pointer-events:none;’;
ov.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:16px;animation:pop .5s cubic-bezier(.34,1.56,.64,1) forwards;opacity:0"> <div style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#34d399);display:flex;align-items:center;justify-content:center;font-size:44px">⚡</div> <div style="font-size:24px;font-weight:700;letter-spacing:3px;color:#fff;font-family:'Syne',sans-serif">CRUSHED IT</div> <div style="font-size:13px;color:rgba(52,211,153,0.8)">Workout saved ✓</div> </div>`;
document.body.appendChild(ov);
setTimeout(()=>{ov.style.transition=‘opacity .4s’;ov.style.opacity=‘0’;setTimeout(()=>ov.remove(),400);},1400);
render();
}catch(e){btn.disabled=false;btn.textContent=‘⚡  Log This Workout’;toast(‘Error — try again’);}
}

init();
