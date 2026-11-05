const $ = id => document.getElementById(id);
const defaults = {symbol:"XAU/USD",interval:"15min",rsiPeriod:2,low:1,high:99,poll:60,apiKey:""};
let timer = null, lastAlert = "", historyRows = [];
function loadSettings(){
  try { const s={...defaults,...JSON.parse(localStorage.getItem("rsi2-settings")||"{}")};
    for(const k of Object.keys(s)) if($(k)) $(k).value=s[k];
  } catch(e) {}
}
function settings(){
 return {symbol:$("symbol").value,interval:$("interval").value,rsiPeriod:Math.max(2,Math.min(100,Number($("rsiPeriod").value)||2)),
 low:Number($("low").value),high:Number($("high").value),poll:Number($("poll").value),apiKey:$("apiKey").value.trim()};
}
function save(){
 const s=settings();
 if(!(s.low>=0 && s.high<=100 && s.low<s.high)){setStatus("Confira os níveis informados");return;}
 localStorage.setItem("rsi2-settings",JSON.stringify(s));
 $("assetName").textContent=s.symbol==="XAU/USD"?"Ouro (XAU/USD)":"Euro (EUR/USD)";
 $("lowLabel").textContent=s.low;$("highLabel").textContent=s.high;
 if(!s.apiKey){setStatus("Falta a chave da API");$("reading").textContent="Cole sua chave gratuita da Twelve Data para iniciar.";return;}
 start();
}
function setStatus(t){$("status").textContent=t;}
function calcRSI(values,period){
 if(values.length<period+1)return null;
 let gains=0,losses=0;
 for(let i=1;i<=period;i++){const d=values[i]-values[i-1];if(d>0)gains+=d;else losses-=d;}
 let avgG=gains/period,avgL=losses/period;
 for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];avgG=(avgG*(period-1)+Math.max(d,0))/period;avgL=(avgL*(period-1)+Math.max(-d,0))/period;}
 if(avgL===0)return avgG===0?50:100;
 return 100-(100/(1+avgG/avgL));
}
async function refresh(){
 const s=settings();
 if(!s.apiKey){setStatus("Falta a chave da API");return;}
 setStatus("Consultando...");
 try{
  const url=new URL("https://api.twelvedata.com/time_series");
  url.search=new URLSearchParams({symbol:s.symbol,interval:s.interval,outputsize:String(Math.max(40,s.rsiPeriod*8)),apikey:s.apiKey}).toString();
  const response=await fetch(url);const data=await response.json();
  if(!response.ok||data.status==="error"||!data.values)throw new Error(data.message||"Não foi possível obter as cotações.");
  const closes=data.values.slice().reverse().map(x=>Number(x.close)).filter(Number.isFinite);
  const value=calcRSI(closes,s.rsiPeriod);
  if(value===null)throw new Error("Ainda não há candles suficientes para calcular o RSI.");
  showValue(value,s,data.values[0].datetime);
 }catch(err){setStatus("Erro na consulta");$("reading").textContent=err.message+" Confira a chave e o limite de consultas do provedor."; }
}
function showValue(v,s,stamp){
 const n=v.toFixed(2);$("rsiValue").innerHTML=`${n}<small>RSI(${s.rsiPeriod})</small>`;
 $("meterFill").style.width=`${Math.max(0,Math.min(100,v))}%`;
 let msg="RSI dentro dos níveis configurados.";
 if(v<=s.low)msg=`RSI atingiu ou ficou abaixo de ${s.low}.`;
 else if(v>=s.high)msg=`RSI atingiu ou ficou acima de ${s.high}.`;
 $("reading").textContent=msg;$("updated").textContent=`Último candle recebido: ${stamp||"horário não informado"}`;
 setStatus("Atualizado");
 historyRows.unshift({time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),value:n,symbol:s.symbol});
 historyRows=historyRows.slice(0,8);
 $("history").innerHTML=historyRows.map(x=>`<div class="history-row"><span>${x.time} · ${x.symbol}</span><span>${x.value}</span></div>`).join("");
 const side=v<=s.low?"LOW":v>=s.high?"HIGH":"";
 const alertKey=side?`${s.symbol}-${s.interval}-${side}-${stamp}`:"";
 if(side&&alertKey!==lastAlert){lastAlert=alertKey;notify(`${s.symbol}: RSI(${s.rsiPeriod}) ${side==="LOW"?"≤":"≥"} ${side==="LOW"?s.low:s.high}`,`Leitura atual: ${n}`);}
}
function notify(title,body){
 if("Notification"in window&&Notification.permission==="granted")new Notification(title,{body,icon:"icon.svg"});
}
async function enableNotifications(){
 if(!("Notification"in window)){setStatus("Notificações não suportadas neste navegador");return;}
 const p=await Notification.requestPermission();setStatus(p==="granted"?"Notificações ativadas":"Permissão não concedida");
}
function start(){if(timer)clearInterval(timer);refresh();timer=setInterval(refresh,settings().poll*1000);}
$("save").addEventListener("click",save);
$("notify").addEventListener("click",enableNotifications);
$("poll").addEventListener("change",()=>{if(timer)start();});
loadSettings();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
