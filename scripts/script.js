/*****YTPRO*******
Author: Prateek Chaubey
Version: 4.0.2
URI: https://github.com/prateek-chaubey/YTPRO
Last Updated On: 1 May , 2026 , 19:25 IST
*/




if(window.eruda == null && localStorage.getItem("devMode") == "true"){
//ERUDA
var script = document.createElement('script'); script.src="//youtube.com/ytpro_cdn/npm/eruda"; document.body.appendChild(script); script.onload=()=>{eruda.init();}
}
/**/

if(!YTProVer){

/*Few Stupid Inits*/
var YTProVer="4.09";
var ytoldV="";
var isF=false;   //what is this for?
var isAp=false; // oh it's for bg play 
const originalPause = HTMLMediaElement.prototype.pause; // well long story short , save the original pause function
window.PIPause = false; // for pausing video when in PIP
window.isPIP=false;
window.pauseAllowed = true; // allow pause by default
var sTime=[];
var webUrls=["m.youtube.com","youtube.com","yout.be","accounts.google.com"];

var YTPROCodecs={
video:["AV1","VP8","VP9","H264"],
audio:["Opus","Mp4a"]
}

let touchstartY = 0;
let touchendY = 0;
let initialDistance=null;
let holdTimer=null;
let holdActive=false;
let holdStartX=0;
let holdStartY=0;
const HOLD_SPEED_DEFAULT=2;
const HOLD_SPEED_MAX=4;
const HOLD_SPEED_MIN=0.25;
const HOLD_DELAY=500;
const HOLD_MOVE_TOL=12;

//swipe controls
var sens=0.005;
var vol=Android.getVolume();
var brt = Android.getBrightness()/100;

/*Fullscreen brightness/volume swipe (v2; replaces the overlay sliders
disabled 2026-09-09). Left 40% = brightness, right 40% = volume; middle
20% and top/bottom chrome stay untouched. Detection lives in body capture
listeners, no overlay element is created, so native controls (gear, seek,
pause, speed, screenshot) are never blocked. Two fingers yield to pinch
zoom, horizontal dominance yields to native seeking, <10px movement stays
a tap. Brightness/volume are refetched on touchstart so the gauge is never
stale.*/
(function(){
if(document.body.__ytproSliderBound){ return; }
document.body.__ytproSliderBound=true;

var st={x0:0,y0:0,b0:0,v0:0,side:0,on:false,fb:null,ht:0};
var SWIPE_TOL=10;
var Z_TOP=10;
var Z_BOT=85;

function tgt(e){
var cn="";
try{ cn=(e.target&&e.target.className&&e.target.className.toString)?e.target.className.toString():""; }catch(err){ cn=""; }
return cn.indexOf("video-stream")>-1||cn.indexOf("player-controls-background")>-1;
}
function isFs(){
return !!(document.fullscreenElement||document.webkitFullscreenElement);
}
function startVals(){
try{ st.b0=Math.max(0,Math.min(1,Android.getBrightness()/100)); }catch(err){ st.b0=0.5; }
try{ st.v0=Math.max(0,Math.min(1,Android.getVolume())); }catch(err){ st.v0=0.5; }
brt=st.b0; vol=st.v0;
}
function show(){
if(!st.fb||!document.getElementById("ytproSwipeFb")){
st.fb=document.createElement("div");
st.fb.id="ytproSwipeFb";
st.fb.setAttribute("style","position:fixed;top:18%;left:50%;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:7px;background:rgba(0,0,0,.72);color:#fff;padding:7px 14px;border-radius:20px;font-size:14px;font-weight:600;pointer-events:none;");
st.fb.innerHTML="<span style='display:flex;align-items:center;'>"+(st.side<0?brtSvg:volSvg)+"</span><span id='ytproSwipeVal'></span><span style='display:inline-block;width:70px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);margin-left:4px;'><span id='ytproSwipeBar' style='display:block;height:100%;width:50%;border-radius:3px;background:#fff;'></span></span>";
document.body.appendChild(st.fb);
}
st.fb.style.opacity="1";
}
function refresh(){
if(!st.fb){ return; }
var val=Math.round((st.side<0?brt:vol)*100);
var tv=document.getElementById("ytproSwipeVal");
if(tv){ tv.textContent=val+"%"; }
var bw=document.getElementById("ytproSwipeBar");
if(bw){ bw.style.width=Math.max(0,Math.min(100,val))+"%"; }
}
function hide(){
st.on=false; st.side=0;
if(st.ht){ clearTimeout(st.ht); st.ht=0; }
if(st.fb){
st.fb.style.transition="opacity .25s ease-out";
st.fb.style.opacity="0";
st.ht=setTimeout(function(){ if(st.fb){ st.fb.remove(); st.fb=null; } },260);
}
}

document.body.addEventListener("touchstart",function(e){
if(localStorage.getItem("gesC")!="true"){ return; }
if(!isFs()){ return; }
if(e.touches.length!==1){ st.on=false; st.side=0; return; }
if(!tgt(e)){ return; }
var t=e.touches[0];
var px=(t.clientX/window.innerWidth)*100;
st.x0=t.clientX; st.y0=t.clientY;
st.side=(px<40)?-1:((px>=60)?1:0);
st.on=false;
startVals();
},{capture:true,passive:true});
document.body.addEventListener("touchmove",function(e){
if(localStorage.getItem("gesC")!="true"){ return; }
if(!isFs()){ return; }
if(!st.side){ return; }
if(e.touches.length!==1){ return; }
if(!tgt(e)){ return; }
var t=e.touches[0];
var dx=t.clientX-st.x0;
var dy=st.y0-t.clientY;
if(!st.on){
if(Math.max(Math.abs(dx),Math.abs(dy))<SWIPE_TOL){ return; }
if(Math.abs(dx)>Math.abs(dy)){ st.side=0; return; }
st.on=true;
}
var py=(t.clientY/window.innerHeight)*100;
if(py<Z_TOP||py>Z_BOT){ return; }
e.preventDefault();
if(st.side<0){
brt=Math.max(0,Math.min(1,st.b0+dy*sens));
try{ Android.setBrightness(brt); }catch(err){}
}else{
vol=Math.max(0,Math.min(1,st.v0+dy*sens));
try{ Android.setVolume(vol); }catch(err){}
}
show();
refresh();
},{capture:true,passive:false});
document.body.addEventListener("touchend",function(e){
if(st.on){ hide(); }
},{capture:true,passive:true});
document.body.addEventListener("touchcancel",function(e){
hide();
},{capture:true,passive:true});
})();
if(localStorage.getItem("gesC") == null || localStorage.getItem("gesM") == null || localStorage.getItem("bgplay") == null){
localStorage.setItem("autoSpn","true");
localStorage.setItem("bgplay","true");
localStorage.setItem("gesC","true");
localStorage.setItem("gesM","false");
localStorage.setItem("fzoom","false");
localStorage.setItem("devMode","false");

localStorage.setItem("block_60fps","false");
localStorage.setItem("freezeHome","false");

YTPROCodecs.video.forEach((x)=>{
localStorage.setItem(x,"true");
});

YTPROCodecs.audio.forEach((x)=>{
localStorage.setItem(x,"true");
});

}
if(localStorage.getItem("holdSpeed") == null){localStorage.setItem("holdSpeed","true");}
if(localStorage.getItem("ytproSpeedBtn") == null){localStorage.setItem("ytproSpeedBtn","true");}
if(localStorage.getItem("fzoom") == "true"){
document.getElementsByName("viewport")[0].setAttribute("content","");
}

// Freeze Homepage: when ON, returning to home does not re-fetch/re-rank the
// feed. The first home browse response is cached in memory only (not persisted)
// and replayed on return; manual scroll-down continuations still load normally.
// Session-only cache means a fresh app open always shows a new home feed.
var freezeHomeCache=null;
if(!window.__ytproFreezeHome){
window.__ytproFreezeHome=true;
var _ytproFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  if(localStorage.getItem("freezeHome")=="true"){
    try{
      var u=(typeof input==="string")?input:(input&&input.url?input.url:"");
      if(u&&u.indexOf("youtubei/v1/browse")>-1&&init&&init.body){
        var b=(typeof init.body==="string")?init.body:(init.body?init.body.toString():"");
        var isHome=/"browseId"\s*:\s*"FEwhat_to_watch"/.test(b);
        var isCont=/"continuation"/.test(b);
        if(isHome&&!isCont){
          if(freezeHomeCache!=null){
            return Promise.resolve(new Response(freezeHomeCache,{status:200,statusText:"OK",headers:{"Content-Type":"application/json"}}));
          }
          return _ytproFetch(input,init).then(function(r){
            var c=r.clone();
            c.text().then(function(t){freezeHomeCache=t;}).catch(function(){});
            return r;
          });
        }
      }
    }catch(e){}
  }
  return _ytproFetch(input,init);
};
}


if(window.location.pathname.indexOf("shorts") > -1){
ytoldV=window.location.pathname;
}
else{
ytoldV=(new URLSearchParams(window.location.search)).get('v') ;
}


/*Dark and Light Mode*/
var c="#000";
var d="#f2f2f2";
var dc="#fff";
var isD=false;
var dislikes="...";


if(document.cookie.indexOf("f6=40000") > -1){
dc ="#000";c ="#fff";d="rgba(255,255,255,0.1)";
isD=true;
}else{
dc ="#fff";c="#000";d="rgba(0,0,0,0.05)";
isD=false;
}

var downBtn=`<svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="none">
<path
d="M16.59 9H15V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5H7.41a1 1 0 0 0-.7 1.7l4.59 4.59a1 1 0 0 0 1.42 0l4.59-4.59a1 1 0 0 0-.72-1.7Z"
stroke="${c}"
stroke-width="1.8"
stroke-linecap="round"
stroke-linejoin="round"
/>
<rect x="5" y="17.2" width="14" height="1.8" rx="0.9" fill="${c}" />
</svg>
`;










function override() {

var videoElem = document.createElement('video');
var origCanPlayType = videoElem.canPlayType.bind(videoElem);
videoElem.__proto__.canPlayType = makeModifiedTypeChecker(origCanPlayType);

var mse = window.MediaSource;

if (mse === undefined) return;
var origIsTypeSupported = mse.isTypeSupported.bind(mse);
mse.isTypeSupported = makeModifiedTypeChecker(origIsTypeSupported);
}


function makeModifiedTypeChecker(origChecker) {


return function (type) {
if (type === undefined) return '';
var disallowed_types = [];
if (localStorage['H264'] === 'false') {
disallowed_types.push('avc');
}
if (localStorage['VP8'] === 'false') {
disallowed_types.push('vp8');
}
if (localStorage['VP9'] === 'false') {
disallowed_types.push('vp9', 'vp09');
}
if (localStorage['AV1'] === 'true') {
disallowed_types.push('av01', 'av99');
}
if (localStorage['Opus'] === 'false') {
disallowed_types.push('opus');
}
if (localStorage['Mp4a'] === 'false') {
disallowed_types.push('mp4a');
}

// If video type is in disallowed_types, say we don't support them
for (var i = 0; i < disallowed_types.length; i++) {
if (type.indexOf(disallowed_types[i]) !== -1) return '';
}

if (localStorage['block_60fps'] === 'true') {
var match = /framerate=(\d+)/.exec(type);
if (match && match[1] > 30) return '';
}

return origChecker(type);
};
}

override();





function insertAfter(referenceNode, newNode) {
try{
referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}catch{}
}


/*wait for the element , using observer*/
async function waitForElement(selector,vid) {
return new Promise((resolve) => {
const element = document.querySelector(selector);
if(element){
if(vid && element.src != "") return resolve(element);
if(!vid) return resolve(element);
}
const observer = new MutationObserver(() => {
const el = document.querySelector(selector);
if (el){

if(vid && el.src) resolve(el),observer.disconnect();;
if(!vid) resolve(el),observer.disconnect();;
}
});
observer.observe(document.body, {
childList: true,
subtree: true
});
});
}


/*Add Settings Tab*/
var injectYtproSettingsEntry=(function(){
  /* YTPro settings entry: a native-style row "YT PRO Settings" inserted right
     below the "Premium" benefit row on the account / "You" page. The old fixed
     top-left gear (setDiv) is permanently retired per user requirement
     (2026-09-11): it floated over the video on every page and was confused
     with YouTube's own settings. Never resurrect that gear.
     Tapping this row reuses the existing #settings hash route -> ytproSettings(). */
  var SEL='a, ytm-composite-link, ytm-settings-row, ytm-account-item, [role="link"], [role="listitem"], li';
  function findPremiumRow(){
    try{
      var nodes=document.querySelectorAll(SEL);
      for(var i=0;i<nodes.length;i++){
        var el=nodes[i];
        if(!el.isConnected){ continue; }
        var t=(el.textContent||"").trim();
        /* Premium 品牌名一般不本地化;只取像菜单项的短文本,避免命中长卡片 */
        if(t.length>0 && t.length<60 && /premium/i.test(t)){ return el; }
      }
    }catch(e){}
    return null;
  }
  return function(){
    var existing=document.getElementById("ytproSettingsEntry");
    if(existing && existing.isConnected){
      /* already injected; re-inject only if detached (Premium row was rebuilt) */
      if(existing.previousSibling && existing.previousSibling.isConnected){ return; }
      try{ existing.remove(); }catch(e){}
    }
    var prem=findPremiumRow();
    if(!prem || !prem.parentNode){ return; } /* not on the account page */
    var item=prem.cloneNode(true);
    item.setAttribute("id","ytproSettingsEntry");
    /* rename deepest text node(s) matching "premium", keep icon/chevron structure */
    try{
      var tw=document.createTreeWalker(item,NodeFilter.SHOW_TEXT,null,false);
      var n;
      while((n=tw.nextNode())){
        if(n.nodeValue && /premium/i.test(n.nodeValue)){ n.nodeValue="YT PRO Settings"; }
      }
    }catch(e){}
    /* neutralise any href, reuse #settings route to open the YTPro panel */
    try{ item.removeAttribute("href"); }catch(e){}
    try{ item.setAttribute("href","javascript:void(0)"); }catch(e){}
    item.addEventListener("click",function(e){
      e.preventDefault();
      e.stopPropagation();
      window.location.hash="settings";
    },{capture:true});
    item.addEventListener("touchstart",function(e){ e.stopPropagation(); },{passive:true,capture:true});
    prem.parentNode.insertBefore(item, prem.nextSibling);
  };
})();

var addSettingsTab=()=>{
// 用户强约束(2026-09-11): 常驻浮层齿轮 setDiv 永久移除,不再创建。
// YTPro 设置入口改为"我的"页 Premium 福利下方的原生风格列表项"YT PRO Settings",
// 见 injectYtproSettingsEntry()。之后绝对不可恢复此浮层齿轮。
injectYtproSettingsEntry();
};




/*Dislikes To Locale, Credits: Return YT Dislikes*/
function getDislikesInLocale(num){
var nn=num;
if (num < 1000){
nn = num;
}
else{
const int = Math.floor(Math.log10(num) - 2);
const decimal = int + (int % 3 ? 1 : 0);
const value = Math.floor(num / 10 ** decimal);
nn= value * 10 ** decimal;
}
let userLocales;
if (document.documentElement.lang) {
userLocales = document.documentElement.lang;
} else if (navigator.language) {
userLocales = navigator.language;
} else {
try {
userLocales = new URL(
Array.from(document.querySelectorAll("head > link[rel='search']"))
?.find((n) => n?.getAttribute("href")?.includes("?locale="))
?.getAttribute("href")
)?.searchParams?.get("locale");
} catch {
userLocales = "en";
}
}
return Intl.NumberFormat(userLocales, {
notation: "compact",
compactDisplay: "short",
}).format(nn);
}



/*Skips the bad part :)*/
async function skipSponsor(){
var sDiv=document.createElement("div");
sDiv.setAttribute("style",`height:3px;pointer-events:none;width:100%;position:absolute;z-index:99;`)
sDiv.setAttribute("id","sDiv");
var player = document.getElementsByClassName("video-stream")[0];
var dur=player.duration;

if(isNaN(dur)) return;

for(var x in sTime){
var s1=document.createElement("div");
var s2=sTime[x];
s1.setAttribute("style",`height:3px;width:${(100/dur) * (s2[1]-s2[0])}%;background:#0f8;position:absolute;z-index:9;left:${(100/dur) * s2[0]}%;`)
sDiv.appendChild(s1);
}




var e=await waitForElement("yt-progress-bar",false);


if(document.getElementById("sDiv") == null){
if(document.getElementsByClassName('ytPlayerProgressBarHost')[0] != null){
document.getElementsByClassName('ytPlayerProgressBarHost')[0].appendChild(sDiv);
}else{
try{document.getElementsByClassName('ytProgressBarLineProgressBarLine')[0].appendChild(sDiv);}catch{}
}
}




}





/*Fetch The Dislikes*/
async function fDislikes(url){ 
var Url=new URL(url);
var vID="";
if(Url.pathname.indexOf("shorts") > -1){
vID=Url.pathname.substr(8,Url.pathname.length);
}
else if(Url.pathname.indexOf("watch") > -1){
vID=Url.searchParams.get("v");
}


fetch("https://returnyoutubedislikeapi.com/votes?videoId="+vID)
.then(response => {
return response.json();
}).then(jsonObject => {
if('dislikes' in jsonObject){
dislikes=getDislikesInLocale(parseInt(jsonObject.dislikes));
}
}).catch(error => {});

}



/*Check For Sponsorships*/
async function checkSponsors(Url){


if(Url.indexOf("watch") > -1){

sTime=[];

await fetch("https://sponsor.ajay.app/api/skipSegments?videoID="+new URL(Url).searchParams.get("v"))
.then(response => {
return response.json();
}).then(jsonObject => {
for(var x in jsonObject){
var time=jsonObject[x].segment;
sTime.push(time);
}
}).catch(error => {});



/*Skip the Sponsor*/
var player = await waitForElement(".video-stream",true);


player.ontimeupdate=()=>{
skipSponsor();
var cur=player.currentTime;
for(var x in sTime){
var s2=sTime[x];
if(Math.floor(cur) == Math.floor(s2[0])){
if(localStorage.getItem("autoSpn") == "true"){
player.currentTime=s2[1];
addSkipper(s2[0]);
}
}
}
};





}

}


//DEBUG
/*
s1: FoQR9rLpRy8
s2: PN51tJhZscE
*/
/*Add Skip Sponsor Element*/
function addSkipper(sT){
var sSDiv=document.createElement("div");
sSDiv.setAttribute("style",`
height:50px;${(screen.width > screen.height) ? "width:50%;" : "width:80%;"}overflow:auto;background:rgba(130,130,130,.3);
backdrop-filter:blur(6px);
position:absolute;bottom:40px;
line-height:50px;
left:calc(15% / 2 );padding-left:10px;padding-right:10px;
z-index:99999999999999;text-align:center;border-radius:25px;
color:white;text-align:center;
`);
sSDiv.innerHTML=`<span style="height:30px;line-height:30px;margin-top:10px;display:block;font-family:monospace;font-size:16px;float:left;">Skipped Sponsor</span>
<span style="height:30px;line-height:44px;float:right;padding-right:30px;margin-top:10px;display:block;padding-left:30px;border-left:1px solid white;">
<svg data-action="rewind" xmlns="http://www.w3.org/2000/svg" width="23" height="23" style="margin-top:0px;" fill="currentColor" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
<path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
</svg>
<svg data-action="close" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="margin-left:30px;" fill="#f24" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
</svg>
</span>`;
document.getElementById("player-control-container").appendChild(sSDiv);


sSDiv.addEventListener("click",(e)=>{
  var el=e.target.closest("[data-action]");
  
  if(!el) return;
  var action=el.dataset.action;
  
  if(action == "close"){
el.parentElement.parentElement.remove();
  }else if(action == "rewind"){
  el.parentElement.parentElement.remove();
  document.getElementsByClassName('video-stream')[0].currentTime=sT+1; 
  }
  
});


setTimeout(()=>{sSDiv.remove();},5000);
}


fDislikes(window.location.href);
checkSponsors(window.location.href);


if((window.location.pathname.indexOf("watch") > -1) || (window.location.pathname.indexOf("shorts") > -1)){
var unV=setInterval(() => {


/*Unmute The Video*/ 

document.getElementsByClassName('video-stream')[0].muted=false;

if(!document.getElementsByClassName('video-stream')[0].muted){
clearInterval(unV);

}

}, 5);

}

/*Funtion to set Element Styles*/
function sty(e,v){
var s={
display:"flex",
alignItems:"center",
justifyContent:"center",
fontWeight:"550",
height:"40px",
minHeight:"40px",
minWidth:"80px",
padding:"0 12px",
width:"auto",
borderRadius:"20px",
background:d,
fontSize:"12px",
marginRight:"5px",
textAlign:"center",
flexShrink:"0",
boxSizing:"border-box",
};
for(x in s){
e.style[x]=s[x];
}
}


/*Get Codecs*/
function getYTPROCodecs(){
var t=`<p style="text-align:center;font-size:14px;">此功能为实验性，配置不当可能导致 YTPro 异常。默认启用全部编解码器，点击下方按钮即可切换。</p><br> <vc  style="font-size:14px;">视频编解码器</vc><br>`;

for(var y in YTPROCodecs.video){

var x=YTPROCodecs.video[y];

t+=`<button data-action="setRemoveCodec" data-value="${x}" ${("true" == localStorage.getItem(x)) ? `style="background:${c};color:${dc};"` : "" } >${x}
<svg  ${("true" != localStorage.getItem(x)) ? `style="display:none"` : "" } xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${dc}"  viewBox="0 0 16 16">
<path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
</svg>
</button>`;
}

t+=`<br><br><vc  style="font-size:14px">音频编解码器</vc><br>`
for(var y in YTPROCodecs.audio){

var x=YTPROCodecs.audio[y];

t+=`<button data-action="setRemoveCodec" data-value="${x}" ${("true" == localStorage.getItem(x)) ? `style="background:${c};color:${dc};"` : "" } >${x}
<svg ${("true" != localStorage.getItem(x)) ? `style="display:none"` : "" } xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${dc}"  viewBox="0 0 16 16">
<path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z"/>
</svg>
</button>`;
}

t+=`<br><br>
<div>屏蔽 60FPS <span data-action="block_60fps" style="${sttCnf(0,0,"block_60fps")}" ><b style="${sttCnf(0,1,"block_60fps")}" ></b></span></div> `;

t+=`<br><br><button data-action="done" style="margin-top:10px;width:25%;float:right;text-align:center;background:${c};color:${dc};" >完成</button>`;


return t;

}


function setRemoveCodec(x,y){


if(localStorage[x] == "true"){
localStorage.setItem(x,"false");
y.style.background=isD ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)";
y.style.color=c;
y.children[0].style.display="none";
}else{
localStorage.setItem(x,"true");
y.style.background=c;
y.style.color=dc;
y.children[0].style.display="block";
}




}


/*The settings tab*/
async function ytproSettings(){
var ytpSet=document.createElement("div");
var ytpSetI=document.createElement("div");
ytpSet.setAttribute("id","settingsprodiv");
ytpSetI.setAttribute("id","ssprodivI");
ytpSet.setAttribute("style",`
height:100%;width:100%;position:fixed;top:0;left:0;
display:flex;justify-content:center;
background:rgba(0,0,0,0.7);
z-index:9999;
`);
ytpSet.addEventListener("click",
function(ev){

if(!(ev.target == ytpSetI  || ytpSetI.contains(ev.target))){

history.back();
}
});

ytpSetI.setAttribute("style",`
height:65%;width:calc(95% - 20px);overflow:auto;
background:${isD ? "#212121" : "#f1f1f1"};
position:fixed;
bottom:20px;
z-index:99999999999999;padding:10px;text-align:center;border-radius:25px;color:${c};text-align:center;
color:${isD ? "#ccc" : "#444"};`);

ytpSetI.innerHTML=`<style>
@import url('https://fonts.googleapis.com/css2?family=Delius&display=swap');
#settingsprodiv a{text-decoration:underline;} #settingsprodiv li{list-style:none; display:flex;align-items:center;justify-content:center;color:#fff;border-radius:25px;padding:10px;background:#000;margin:5px;}
#ssprodivI div{
height:10px;
width:calc(100% - 20px);
padding:10px;
font-size:1.45rem;
text-align:left;
display:flex;
align-items:center;
position:relative;
margin-top:3px;
}
#ssprodivI div span{
display:block;
height:23px;
width:40px;
border-radius:40px;
right:10px;
position:absolute;
background:#151515;
}
#ssprodivI div span b{
display:block;
height:19px;
width:19px;
position:absolute;
right:2px;
top:2px;
border-radius:50px;
background:#fff;
}
#ssprodivI div input::placeholder{color:${ isD ? "white" : "#000"};}
#ssprodivI div input,#ssprodivI div button{
height:35px;
background:${isD ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"};
width:100%;
border:0;
border-radius:20px;
padding:10px;
font-size:1.25rem;
}
#ssprodivI button{
background:transparent;
font-size:1.45rem;
width:calc(100% - 20px);
height:40px;
color:${isD ? "#ccc" : "#444"};
margin-top:3px;
text-align:left;
}
#ssprodivI button svg{
float:right;
}
#ssprodivI .credit{
font-family: "Delius", cursive;
font-style: normal;
display:flex;
justify-content:center;
align-items:center;
text-align:center;
font-size:1.55rem;
font-weight:bolder;
color:${isD ? "#fff" : "#000"};
position:fixed;
bottom:20px;
width:calc(95% - 20px);
left:calc(2.5% + 0px);
background:${d};
border-radius:0 0 25px 25px;
backdrop-filter:blur(10px);
height:15px;
}
#ssprodivI .disableCodecs{
height:auto;
min-height:100px;
padding-bottom:12px;
background:${isD ? "#212121" : "#f1f1f1"};
position:fixed;
display:block;
width:calc(95% - 20px);
left:calc(2.5% + 0px);
bottom:20px;
z-index:999999;
box-shadow:0px 0px 5px black;
border-radius:25px;
display:none;
}
#ssprodivI .disableCodecs:before{
height:100%;
width:100%;
background:rgba(0,0,0,.6);
position:fixed;
top:0;
left:0;
z-index:-999;
}
#ssprodivI .disableCodecs{
column:50%;
}
#ssprodivI .disableCodecs button{
width:48%;
column:50%;
margin-right:2%;
color:${c};
}
</style>`;
ytpSetI.innerHTML+=`<br><b style='font-size:18px' >YT PRO Settings</b>
<span style="font-size:10px">v${YTProVer}</span>
<br><br>
<div data-action="follow" style="min-height:35px;height:auto;width:95%;margin:auto;background:#ee2a7b44;border-radius:30px;margin-bottom:15px;border:1px solid #ee2a7b;display:flex;padding:5px;gap:8px;">

<img style="flex-shrink: 0;height:40px;width:40px;border-radius:50%;" src="https://raw.githubusercontent.com/prateek-chaubey/YTPro/refs/heads/main/.github/img/habitius.webp" >
<div style="display:flex;flex-direction:column;align-items:flex-start;height:100%;width:auto;flex-shrink:0;font-size:14px;background:re;padding:0;"><b>请在 Instagram 关注 Habitius</b>获取每日习惯、生活方式与健康小贴士 </div>

<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${isD ? "#ccc" : "#444"}" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
</svg>

</div>

<div><input type="url" placeholder="输入 YouTube 链接" id="ytproUrlInput" ></div>
<br>
<button data-action="hearts">喜欢的视频
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${isD ? "#ccc" : "#444"}" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
</svg>
</button>
<br>
<button data-action="checkUpdate">检查更新
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${isD ? "#ccc" : "#444"}"  viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
</svg>
</button>
<br>
<div>自动跳过赞助片段 <span data-action="sttCnf" data-value="autoSpn" style="${sttCnf(0,0,"autoSpn")}" ><b style="${sttCnf(0,1,"autoSpn")}"></b></span></div>
<br>
<div>手势控制 <span data-action="sttCnf" data-value="gesC" style="${sttCnf(0,0,"gesC")}" ><b style="${sttCnf(0,1,"gesC")}"></b></span></div>
<br>
<div>小窗手势 <span data-action="sttCnf" data-value="gesM" style="${sttCnf(0,0,"gesM")}" ><b style="${sttCnf(0,1,"gesM")}"></b></span></div>
<br>
<div>强制缩放 <span data-action="sttCnf" data-value="fzoom"  style="${sttCnf(0,0,"fzoom")}" ><b style="${sttCnf(0,1,"fzoom")}" ></b></span></div> 
<div>长按调速 <span data-action="sttCnf" data-value="holdSpeed" style="${sttCnf(0,0,"holdSpeed")}" ><b style="${sttCnf(0,1,"holdSpeed")}"></b></span></div>
<div>倍速按钮 <span data-action="sttCnf" data-value="ytproSpeedBtn" style="${sttCnf(0,0,"ytproSpeedBtn")}" ><b style="${sttCnf(0,1,"ytproSpeedBtn")}"></b></span></div>
<div>长按速度值 <span data-action="holdSpeedVal" style="position:absolute;right:10px;height:auto;width:auto;min-width:56px;padding:2px 12px;border-radius:14px;background:${isD ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"};color:${isD ? "#fff" : "#151515"};font-size:1.1rem;font-weight:600;text-align:center;">${holdSpeedValue()}x</span></div>
<br>
<div>后台播放 <span data-action="sttCnf" data-value="bgplay" style="${sttCnf(0,0,"bgplay")}" ><b style="${sttCnf(0,1,"bgplay")}" ></b></span></div> 
<br>
<div>隐藏 Shorts <span data-action="sttCnf" data-value="shorts" style="${sttCnf(0,0,"shorts")}" ><b style="${sttCnf(0,1,"shorts")}" ></b></span></div> 
<br>
<button data-action="disableCodecs">禁用编解码器
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${isD ? "#ccc" : "#444"}" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
</svg>
</button>
<br>
<button data-action="issues">反馈问题
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${isD ? "#ccc" : "#444"}" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
</svg>
</button>
<br>
<button style="font-weight:bolder;" data-action="sponsor">成为赞助者
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${isD ? "#ccc" : "#444"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 2l6 6-6 6"/>
</svg>

</button>
<br>
<div>开发者模式 <span data-action="sttCnf" data-value="devMode" style="${sttCnf(0,0,"devMode")}" ><b style="${sttCnf(0,1,"devMode")}"></b></span></div>
<div>冻结主页 <span data-action="sttCnf" data-value="freezeHome" style="${sttCnf(0,0,"freezeHome")}" ><b style="${sttCnf(0,1,"freezeHome")}" ></b></span></div>
<br><br>
<p style="font-size:1.25rem;width:calc(100% - 20px);margin:auto;text-align:left"><b style="font-weight:bold">免责声明</b>：本项目为教育用途，演示如何向 WebView 注入 JavaScript 以提升使用效率。<br>
源码见 <a href="https://www.youtube.com/redirect?q=https://github.com/prateek-chaubey/YTPRO" style="font-family:monospace;" > https://github.com/prateek-chaubey/YTPRO</a>
<br><br></p><br><br><br>

<div class="disableCodecs">

</div>


<div class="credit" >
<z style="margin-right:6px">Made with </z>

<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#fff" viewBox="-1 -1 18 18">
<path fill-rule="evenodd" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314" 
stroke="black" ${ !isD ? "stroke-width='1'" : "" } stroke-linejoin="round" stroke-linecap="round"/>
</svg>



<z style="margin-left:6px">by Prateek Chaubey</z>
</div>
`;


document.body.appendChild(ytpSet);
ytpSet.appendChild(ytpSetI);


document.getElementById("ytproUrlInput").addEventListener("keyup",searchUrl);




var actionsList={
  follow:()=>{
    Android.oplink("https://www.instagram.com/habitius.daily");
  },
  hearts:()=>{
    window.location.hash='#hearts';
  },
  checkUpdate:()=>{
    checkUpdates();
  },
  sttCnf:(button,action)=>{
    sttCnf(button,action);
  },
  holdSpeedVal:(el)=>{
    var vals=[1.5,2,2.5,3,3.5,4];
    var i=vals.indexOf(holdSpeedValue());
    if(i<0){ i=vals.indexOf(HOLD_SPEED_DEFAULT); }
    if(i<0){ i=0; }
    var next=vals[(i+1)%vals.length];
    localStorage.setItem("holdSpeedValue",String(next));
    el.textContent=next+"x";
  },
  issues:()=>{
    Android.oplink('https://github.com/prateek-chaubey/YTPRO/issues');
  },
  disableCodecs:()=>{
    document.getElementsByClassName('disableCodecs')[0].style.display='block';document.getElementsByClassName('disableCodecs')[0].innerHTML=getYTPROCodecs();
  },
  sponsor:()=>{
    Android.oplink('https://github.com/sponsors/prateek-chaubey');
  },
  done:(el)=>{
    el.parentElement.style.display='none';
  },
  setRemoveCodec:(el,value)=>{
    setRemoveCodec(value,el)
  },
  block_60fps:(el)=>{
    sttCnf(el,"block_60fps");
  }
}

//buttons and switches
ytpSetI.querySelectorAll("[data-action]").forEach(button =>{
  button.addEventListener("click",()=>{
    
    if(button.dataset.action== "sttCnf"){
    actionsList[button.dataset.action](button,button.dataset.value);
    }else{
    actionsList[button.dataset.action](button);
    }
  })
});


//disable Codecs
ytpSetI.querySelector(".disableCodecs").addEventListener("click",(e)=>{
  var el = e.target.closest("[data-action]");
  if(!el) return;
  
  actionsList[el.dataset.action](el,el.dataset.value);

})



}



function searchUrl(e){
  
  
if(e.keyCode === 13 || e === "Enter"){

var url=e.target.value;
const regex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:(?:watch)?\?(?:.*&)?v(?:i)?=|(?:embed|v|vi|shorts|live)\/))([a-zA-Z0-9_-]{11})/;
  
const match = url.match(regex);
var id=match ? match[1] : null;
if(id){
  return navigateInternalYtMweb(id);
}


var a=document.createElement("a");
a.href=url;
document.body.appendChild(a);
try{document.getElementById("settingsprodiv").remove();}catch{}
a.click();

}
}

function checkUpdates(){
if(parseFloat(Android.getInfo()) < parseFloat(YTProVer) ){
updateModel();
}else{
Android.showToast("已是最新版本");
}

fetch('https://youtube.com/ytpro_cdn/npm/ytpro', {cache: 'reload'});
fetch('https://youtube.com/ytpro_cdn/npm/ytpro/bgplay.js', {cache: 'reload'});
fetch('https://youtube.com/ytpro_cdn/npm/ytpro/innertube.js', {cache: 'reload'});
}


/*Set Configration*/
function sttCnf(x,z,y){

/*Way too complex to understand*/
if(isD){
var s=["#000","#717171","#fff"];
}else{
var s=["#fff","#909090","#151515"];
}



if(typeof y == "string"){

if(localStorage.getItem(y) != "true"){
if(z == 1){
return `background:${s[0]};left:2px;`;
}else{
return `background:${s[1]};`;
}
}else{
if(z == 1){
return `background:${s[0]};`;
}else{
return `background:${s[2]};`;
}
}
}
if(localStorage.getItem(z) == "true"){
localStorage.setItem(z,"false");
x.style.background=s[1];
x.children[0].style.left="2px";
x.children[0].style.background=s[0];
}
else{
localStorage.setItem(z,"true");
x.style.background=s[2];
x.children[0].style.left="auto";
x.children[0].style.right="2px";
x.children[0].style.background=s[0];
}

if(z == "ytproSpeedBtn"){
/*off: drop the pill right away; on: the injector re-creates it on the next
DOM mutation, and calling it here covers the case where nothing mutates*/
if(localStorage.getItem("ytproSpeedBtn") == "false"){
ytproRemoveSpeedPill();
}else{
injectSpeedControls();
}
}

if(localStorage.getItem("fzoom") == "false"){
document.getElementsByName("viewport")[0].setAttribute("content","width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no,");
}else{
document.getElementsByName("viewport")[0].setAttribute("content","");
}



if(localStorage.getItem("bgplay") == "true"){
Android.setBgPlay(true);
}else{
Android.setBgPlay(false);
}


if(localStorage.getItem("gesC") != "true"){
try{
document.getElementById("brtS").remove();
document.getElementById("volS").remove();
}catch{}
  
}

if(localStorage.getItem("devMode") == "false"){
try{eruda.destroy();}catch{}
}else if(!window.eruda && localStorage.getItem("devMode") == "true"){
var script = document.createElement('script'); script.src="//youtube.com/ytpro_cdn/npm/eruda"; document.body.appendChild(script); script.onload=()=>{ eruda.init();}
}



}




/*Format File Size*/
function formatFileSize(bytes){
var s=parseInt(bytes);
let ss = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
for (var i=0; s > 1024; i++) s /= 1024;
return `${s.toFixed(1)} ${ss[i]}`;
}

/*Video Downloader*/
async function ytproDownVid(){

window.ytproSabrDownload();

}





function showHideAdaptives(){
var z=document.querySelectorAll(".adpFormats");
z.forEach((x)=>{
if(x.style.display=="none"){
x.style.display="flex";
}else{
x.style.display="none";
}

});

}

/*Add the meme type and extensions lol*/
function downCap(x,t){
Android.downvid(t,x,"plain/text");
}

/*Send to Download Manager*/
function YTDownVid(o,ex){
var mtype="";
if(ex ==".png"){
mtype="image/png";
}else if(ex ==".mp4"){
mtype="video/mp4";
}
else if(ex ==".mp3"){
mtype="audio/mp3";
}

//console.log(o.getAttribute("data-ytprourl"))

Android.downvid((o.getAttribute("data-ytprotit")+ex),o.getAttribute("data-ytprourl"),mtype);
}








var stopProp = false;
var zoomIn=false;
var scale=1;


/*Checks the Direction of the Swipe*/
function checkDirection(e) {
if ((touchendY > touchstartY) && (touchendY - touchstartY > 20)) {
minimize(true);
}else if ((touchendY < touchstartY) && (touchstartY - touchendY > 20)) {
minimize(false);
//console.log((touchstartY - touchendY ))
}
}

/*for zoom in and out*/
function getDistance(touches) {
const [a, b] = touches;
return Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY);
}



/*touch start*/
document.body.addEventListener('touchstart', e => {
touchstartY = e.changedTouches[0].screenY;
if (e.touches.length === 2) {
initialDistance = getDistance(e.touches);
}
}, { capture: true });




/*touch move*/
document.body.addEventListener('touchmove', (e) => {


if(stopProp){
e.stopPropagation();
}

if (e.touches.length === 2 && initialDistance !== null) {
const currentDistance = getDistance(e.touches);
const z = currentDistance / initialDistance;

stopProp=true;


if((e.target.className.toString().includes("video-stream") || e.target.className.toString().includes("player-controls-background")) && document.fullscreenElement){

if (z > 1.05) {
var Vv=document.getElementsByClassName('video-stream')[0];
zoomIn=true;
scale=Math.max((screen.height / Vv.offsetHeight) , (screen.width / Vv.offsetWidth)); 
addMaxButton();
} else if (z < 0.95) {
zoomIn=false;
scale=1;
addMaxButton();
}
}



}
},{capture:true});






/*touch end*/
document.body.addEventListener('touchend', e => {


touchendY = e.changedTouches[0].screenY;

if((e.target.className.toString().includes("video-stream") || e.target.className.toString().includes("player-controls-background")) && !document.fullscreenElement && localStorage.getItem("gesM") == "true"){
checkDirection();
}

if (e.touches.length < 2) {
initialDistance = null; // reset

setTimeout(()=>{
stopProp=false;
},500)

}

}, { capture: true });





/*YTPro unified playback-rate state. Every speed entry point (preset panel,
native slider, native speed menu) just writes video.playbackRate; the
ratechange listener in bindSpeedWatch syncs YTProSpeed and the pill label
back, so no entry point can drift out of step. Priority order:
active hold gesture (temporary) > session rate > 1x on a new video.*/
const YTPRO_SPEED_PRESETS=[0.5,0.75,0.9,1,1.25,1.5,1.75,2,4,8];
var YTProSpeed={
  current:1,
  videoId:null,
  set:function(rate){
    this.current=rate;
    var v=document.querySelector(".video-stream");
    if(v){ try{ v.playbackRate=rate; }catch(err){} }
    try{
      var s=document.getElementById("slider");
      if(s){ s.value=String(rate); }
    }catch(err){}
    this.updateLabel(rate);
  },
  updateLabel:function(rate){
    var r=(typeof rate=="number")?rate:this.current;
    var p=document.getElementById("ytproSpeedPill");
    if(p){ p.textContent=r+"x"; }
    var panel=document.getElementById("ytproSpeedPanel");
    if(panel){
      panel.querySelectorAll("[data-rate]").forEach(function(it){
        var on=Math.abs(parseFloat(it.getAttribute("data-rate"))-r)<0.001;
        it.style.background=on?"rgba(255,255,255,.35)":"rgba(255,255,255,.12)";
        it.style.fontWeight=on?"700":"600";
      });
    }
  },
  ensureVideoReset:function(video){
    var id=ytproWatchId();
    if(this.videoId===id) return;
    this.videoId=id;
    this.current=1;
    if(video){ try{ video.playbackRate=1; }catch(err){} }
    this.updateLabel(1);
  }
};

function ytproWatchId(){
  try{
    var v=new URLSearchParams(window.location.search).get("v");
    if(v){ return v; }
  }catch(err){}
  return window.location.pathname;
}

function bindSpeedWatch(video){
  if(!video || video.__ytproRateWatch){ return; }
  video.__ytproRateWatch=true;
  video.addEventListener("ratechange",function(){
    if(holdActive){ return; }
    var r=video.playbackRate||1;
    if(Math.abs(r-YTProSpeed.current)>0.001){ YTProSpeed.current=r; }
    YTProSpeed.updateLabel(r);
  });
  video.addEventListener("loadeddata",function(){
    YTProSpeed.ensureVideoReset(video);
  });
}

/*Long-press to temporarily boost playback speed*/
function isHoldTarget(e){
  try{
    var cn = (e.target && e.target.className && e.target.className.toString) ? e.target.className.toString() : "";
    return (cn.indexOf("video-stream") > -1 || cn.indexOf("player-controls-background") > -1);
  }catch(err){ return false; }
}

function holdSpeedValue(){
  var v=parseFloat(localStorage.getItem("holdSpeedValue"));
  if(isNaN(v)){ v=HOLD_SPEED_DEFAULT; }
  if(v < HOLD_SPEED_MIN){ v=HOLD_SPEED_MIN; }
  if(v > HOLD_SPEED_MAX){ v=HOLD_SPEED_MAX; }
  return v;
}

function startHold(){
  holdTimer=null;
  var video=document.getElementsByClassName('video-stream')[0];
  if(!video) return;
  holdActive = true;
  try{ video.playbackRate = holdSpeedValue(); }catch(err){}
  showHoldIndicator();
}

function cancelHold(){
  if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; }
}

function releaseHold(){
  cancelHold();
  if(holdActive){
    var video=document.getElementsByClassName('video-stream')[0];
    if(video){ try{ video.playbackRate = YTProSpeed.current; }catch(err){} }
    holdActive=false;
  }
  hideHoldIndicator();
}

function showHoldIndicator(){
  var el=document.getElementById("ytproHoldIndicator");
  if(!el){
    el=document.createElement("div");
    el.id="ytproHoldIndicator";
    el.setAttribute("style",`position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(0,0,0,.7);color:#fff;padding:8px 14px;border-radius:20px;font-size:14px;font-weight:600;pointer-events:none;`);
    document.body.appendChild(el);
  }
  el.textContent = holdSpeedValue() + "x";
  el.style.display = "block";
}

function hideHoldIndicator(){
  var el=document.getElementById("ytproHoldIndicator");
  if(el) el.style.display = "none";
}

document.body.addEventListener('touchstart', e => {
  if(localStorage.getItem("holdSpeed") != "true") return;
  if(e.touches.length !== 1){ releaseHold(); return; }
  if(!isHoldTarget(e)) return;
  cancelHold();
  var t=e.touches[0];
  holdStartX=t.pageX; holdStartY=t.pageY;
  holdTimer=setTimeout(startHold, HOLD_DELAY);
}, { capture:true, passive:true });

document.body.addEventListener('touchmove', e => {
  if(!holdTimer) return;
  if(e.touches.length !== 1){ cancelHold(); return; }
  var t=e.touches[0];
  if(Math.hypot(t.pageX-holdStartX, t.pageY-holdStartY) > HOLD_MOVE_TOL){
    cancelHold();
  }
}, { capture:true, passive:true });

document.body.addEventListener('touchend', e => {
  releaseHold();
}, { capture:true, passive:true });

document.body.addEventListener('touchcancel', e => {
  releaseHold();
}, { capture:true, passive:true });

navigation.addEventListener("navigate", e => {
if(e.destination.url.indexOf("watch") > -1 || e.destination.url.indexOf("shorts") > -1){
  dislikes="...";
fDislikes(e.destination.url);
checkSponsors(e.destination.url);
}
// 路由跳转时重新评估齿轮显隐，确保任何页面都不渲染注入齿轮
addSettingsTab();
});

// YouTube SPA 路由跳转（pushState/popstate/浏览器前进后退）时，重新评估
// 齿轮显隐，确保任何页面都不残留注入齿轮。
// MutationObserver 依赖 DOM 变化，纯 hash 或无 DOM 变更的跳转可能漏触发。
window.addEventListener("popstate", function(){
  addSettingsTab();
});
window.addEventListener("yt-navigate-finish", function(){
  addSettingsTab();
});


/*minimize function to mini the video*/
function minimize(yes){


const createIframe=()=>{

var iframe=document.createElement("iframe");
iframe.setAttribute("id",`miniIframe`);
iframe.setAttribute("style",`
height:99.999%;width:100%;
background:${c};
top:0px;
line-height:50px;
position:fixed;
left:0;
z-index:999;
border:0;
`);


iframe.src="https://m.youtube.com/";
document.body.appendChild(iframe);


var iwindow = iframe.contentWindow || iframe.contentDocument.defaultView;
var doc = iwindow.document;

if (doc.readyState  == 'complete' ) {
if (iwindow.trustedTypes && iwindow.trustedTypes.createPolicy && !iwindow.trustedTypes.defaultPolicy) {
iwindow.trustedTypes.createPolicy('default', {createHTML: (string) => string,createScriptURL: string => string, createScript: string => string, });
}
}

iwindow.navigation.addEventListener("navigate", e => {
if(e.destination.url.indexOf("youtube.com") > -1){
if(e.destination.url.indexOf("/watch") > -1 || e.destination.url.indexOf("/shorts") > -1){
window.location.href=e.destination.url;
}
var script = doc.createElement("script");
var scriptSource=`window.addEventListener('DOMContentLoaded', function() {
var script2 = document.createElement('script');
script2.src="//youtube.com/ytpro_cdn/npm/ytpro";
document.body.appendChild(script2);
});
`;
}
else{
window.location.href=e.destination.url;
}


});

var script = doc.createElement("script");
var scriptSource=`window.addEventListener('DOMContentLoaded', function() {
var script2 = document.createElement('script');
script2.src="//youtube.com/ytpro_cdn/npm/ytpro";
document.body.appendChild(script2);
});
`;

/*
var script = document.createElement('script'); 
script.src="//cdn.jsdelivr.net/npm/eruda"; 
document.body.appendChild(script);
script.onload = function () { eruda.init() } ;
*/


  
var source = doc.createTextNode(scriptSource);
script.appendChild(source);
doc.body.appendChild(script);

return iframe;

}



var iframe = document.getElementById("miniIframe") || createIframe();
var player=document.getElementById("player-container-id");




//var ogCss=getComputedStyle(player);

if(yes){

iframe.style.display="block";


player.setAttribute("ogTop",getComputedStyle(player).top)


player.style.transform="scale(0.65)";
player.style.top=(window.screen.height-(player.getBoundingClientRect().height*2.5))+"px";
player.style.zIndex="9999";


}else{

iframe.style.display="none";



player.style.transform="scale(1)";
player.style.top=player.getAttribute("ogTop");
player.style.zIndex="normal";

player.removeAttribute("ogTop");


}
}



var volSvg=`<svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 24 24" width="16" focusable="false" aria-hidden="true" style="pointer-events: none;filter:drop-shadow(0px 0px 1px black);position:absolute;top:10%"><path fill="#fff" d="M11.485 2.143 3.913 6.687A6 6 0 001 11.832v.338a6 6 0 002.913 5.144l7.572 4.543A1 1 0 0013 21V3a1.001 1.001 0 00-1.515-.857Zm6.88 2.079a1 1 0 00-.001 1.414 9 9 0 010 12.728 1 1 0 001.414 1.414 11 11 0 000-15.556 1 1 0 00-1.413 0Zm-2.83 2.828a1 1 0 000 1.415 5 5 0 010 7.07 1 1 0 001.415 1.415 6.999 6.999 0 000-9.9 1 1 0 00-1.415 0Z"></path></svg>`;
var brtSvg=`<svg xmlns="http://www.w3.org/2000/svg" enable-background="new 0 0 24 24" height="16" viewBox="0 0 24 24" width="16" style="filter:drop-shadow(0px 0px 1px black);position:absolute;top:10%;"><rect fill="none" height="24" width="24"/><path fill="#fff" d="M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0 c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2 c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1 C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06 c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41 l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41 c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36 c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z"/></svg>`;


/*THE 0NE AND 0NLY FUNCTION*/
async function pkc(){

if(window.location.href.indexOf("youtube.com/watch") > -1){


try{
var elm=document.getElementsByTagName("dislike-button-view-model")[0].children[0]; 
elm.children[0].children[0].style.width="auto";
elm.children[0].children[0].style.paddingRight="15px";

if(!document.getElementById("diskl")){
  var diskl=document.createElement("span");
  diskl.setAttribute("id","diskl");
  diskl.innerHTML=dislikes;
  diskl.style.marginLeft="5px";
  
insertAfter(elm.getElementsByClassName("yt-spec-button-shape-next__icon")[0],diskl);

}else{
document.getElementById("diskl").innerHTML=dislikes;
}

}catch(e){}













/*Check If Element Already Exists*/
if(document.getElementById("ytproMainDivE") == null){



var ytproMainDivA=document.createElement("div");
ytproMainDivA.setAttribute("id","ytproMainDivE");
ytproMainDivA.setAttribute("style",`
width:100%;display:block;min-height:50px;
`);

insertAfter(document.getElementsByClassName('slim-video-action-bar-actions')[0],ytproMainDivA);

var ytproMainDiv=document.createElement("div");
ytproMainDiv.setAttribute("style",`
width:100%;display:flex;flex-wrap:wrap;align-items:center;
justify-content:flex-start;padding:5px 10px;box-sizing:border-box;
`);
ytproMainDivA.appendChild(ytproMainDiv);

/*Heart Button*/
var ytproFavElem=document.createElement("div");
sty(ytproFavElem);
if(!isHeart()){
ytproFavElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0V0z" fill="none"/><path fill="${c}" d="M19.66 3.99c-2.64-1.8-5.9-.96-7.66 1.1-1.76-2.06-5.02-2.91-7.66-1.1-1.4.96-2.28 2.58-2.34 4.29-.14 3.88 3.3 6.99 8.55 11.76l.1.09c.76.69 1.93.69 2.69-.01l.11-.1c5.25-4.76 8.68-7.87 8.55-11.75-.06-1.7-.94-3.32-2.34-4.28zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg><span style="margin-left:8px">收藏<span>`;
}else{
ytproFavElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0V0z" fill="none"/><path fill="${c}" d="M13.35 20.13c-.76.69-1.93.69-2.69-.01l-.11-.1C5.3 15.27 1.87 12.16 2 8.28c.06-1.7.93-3.33 2.34-4.29 2.64-1.8 5.9-.96 7.66 1.1 1.76-2.06 5.02-2.91 7.66-1.1 1.41.96 2.28 2.59 2.34 4.29.14 3.88-3.3 6.99-8.55 11.76l-.1.09z"/></svg><span style="margin-left:8px">已收藏<span>`;
}
ytproMainDiv.appendChild(ytproFavElem);
ytproFavElem.addEventListener("click",()=>{ytProHeart(ytproFavElem);});



/*Hand the download off to the external downloader (YTDLnis) instead of the
built-in flow: share the current video URL via the Android bridge. Falls
back to the built-in download panel if the bridge is unavailable.*/
function ytproSendToDownloader(){
  var u=window.location.href.replace("m.youtube.com","www.youtube.com");
  try{
    Android.sendToDownloader(u);
  }catch(err){
    window.location.hash="download";
  }
}

/*Download Button*/
var ytproDownVidElem=document.createElement("div");
sty(ytproDownVidElem);
ytproDownVidElem.innerHTML=`${downBtn.replace('width="18"','width="24"').replace('height="18"','height="24"')}<span style="margin-left:2px">下载<span>`;
ytproMainDiv.appendChild(ytproDownVidElem);
ytproDownVidElem.addEventListener("click",
function(){
ytproSendToDownloader();
});

/*Copy / share helpers: current title + canonical URL.*/
function ytproCurrentTitle(){
  try{
    var t="";
    if(window.location.pathname.indexOf("shorts") > -1){
      t=document.getElementsByClassName('ytShortsVideoTitleViewModelShortsVideoTitle')[0].textContent;
    }else{
      t=document.getElementsByClassName('slim-video-metadata-header')[0].textContent;
    }
    return t.replace(/\s+/g," ").trim();
  }catch(e){ return ""; }
}
function ytproCanonUrl(){
  return window.location.href.replace("m.youtube.com","www.youtube.com");
}
function ytproShareText(){
  return ytproCurrentTitle()+"\n"+ytproCanonUrl();
}

/*Copy Link Button*/
var ytproCopyVidElem=document.createElement("div");
sty(ytproCopyVidElem);
ytproCopyVidElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path fill="${c}" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg><span style="margin-left:2px">复制链接<span>`;
ytproMainDiv.appendChild(ytproCopyVidElem);
ytproCopyVidElem.addEventListener("click",
function(){
var text=ytproShareText();
try{
  Android.copyLink(text);
  Android.showToast("已复制链接（含标题）");
}catch(e){
  var ta=document.createElement("textarea");
  ta.value=text;
  ta.style.position="fixed";ta.style.opacity="0";
  document.body.appendChild(ta);
  ta.select();
  try{document.execCommand("copy");}catch(x){}
  ta.remove();
}
});

/*Share Button*/
var ytproShareVidElem=document.createElement("div");
sty(ytproShareVidElem);
ytproShareVidElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path fill="${c}" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg><span style="margin-left:2px">分享<span>`;
ytproMainDiv.appendChild(ytproShareVidElem);
ytproShareVidElem.addEventListener("click",
function(){
try{
  Android.shareText(ytproShareText());
}catch(e){}
});

/*PIP Button*/
var ytproPIPVidElem=document.createElement("div");
sty(ytproPIPVidElem);
ytproPIPVidElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" width="22"><path fill="${c}" d="M18 7h-6c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V8c0-.55-.45-1-1-1zm3-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm-1 16.01H4c-.55 0-1-.45-1-1V5.98c0-.55.45-1 1-1h16c.55 0 1 .45 1 1v12.03c0 .55-.45 1-1 1z"/></svg><span style="margin-left:8px">画中画<span>`;
ytproMainDiv.appendChild(ytproPIPVidElem);
ytproPIPVidElem.addEventListener("click",
function(){
PIPlayer(true);
});

/*Open in Browser Button*/
var ytproOpenVidElem=document.createElement("div");
sty(ytproOpenVidElem);
ytproOpenVidElem.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" width="22"><path fill="${c}" d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg><span style="margin-left:8px">在浏览器中打开<span>`;
ytproMainDiv.appendChild(ytproOpenVidElem);
ytproOpenVidElem.addEventListener("click",
function(){
var u=window.location.href.replace("m.youtube.com","www.youtube.com");
try{
var v=document.getElementsByClassName("video-stream")[0];
if(v){ v.pause(); }
}catch{}
Android.oplink(u);
});
/*Aspect Ratio Button*/
var ytproAspectElem=document.createElement("div");
sty(ytproAspectElem);
ytproAspectElem.id="ytproAspectBtn";
ytproAspectElem.innerHTML=aspectLabel();
ytproMainDiv.appendChild(ytproAspectElem);
ytproAspectElem.addEventListener("click",cycleAspect);





}





}else if(window.location.href.indexOf("youtube.com/shorts") > -1){


let b = document.getElementById("brtS");
let v = document.getElementById("volS");
if (b) b.remove();
if (v) v.remove();


if(document.getElementById("ytproMainSDivE") == null){
var ys=document.createElement("div");
ys.setAttribute("id","ytproMainSDivE");
ys.setAttribute("style",`width:50px;height:auto;position:relative;display:block;`);


/*Download Button*/
ysDown=document.createElement("div");
ysDown.setAttribute("style",`
height:48px;width:48px;display:flex;align-items:center;justify-content:center;
filter:drop-shadow(0 0 1px #0009);
border-radius:50%;
`);
ysDown.innerHTML=downBtn.replaceAll(`${c}`,`#fff`).replace(`width="24"`,`width="30"`).replace(`height="24"`,`height="30"`);


ysDown.addEventListener("click",
function(){
ytproSendToDownloader();
});


/*Heart Button*/
ysHeart=document.createElement("div");
ysHeart.setAttribute("style",`
height:48px;width:48px;
display:flex;align-items:center;justify-content:center;
filter:drop-shadow(0 0 1px #0009);
border-radius:50%;margin-bottom:0px;
`);


if(!isHeart()){
ysHeart.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0V0z" fill="none"/><path fill="#fff" d="M19.66 3.99c-2.64-1.8-5.9-.96-7.66 1.1-1.76-2.06-5.02-2.91-7.66-1.1-1.4.96-2.28 2.58-2.34 4.29-.14 3.88 3.3 6.99 8.55 11.76l.1.09c.76.69 1.93.69 2.69-.01l.11-.1c5.25-4.76 8.68-7.87 8.55-11.75-.06-1.7-.94-3.32-2.34-4.28zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>`;
}else{
ysHeart.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0V0z" fill="none"/><path fill="#fff" d="M13.35 20.13c-.76.69-1.93.69-2.69-.01l-.11-.1C5.3 15.27 1.87 12.16 2 8.28c.06-1.7.93-3.33 2.34-4.29 2.64-1.8 5.9-.96 7.66 1.1 1.76-2.06 5.02-2.91 7.66-1.1 1.41.96 2.28 2.59 2.34 4.29.14 3.88-3.3 6.99-8.55 11.76l-.1.09z"/></svg>`;
}


ysHeart.addEventListener("click",
function(){
ytProHeart(ysHeart);
});





try{
  
  if(document.getElementsByClassName("reel-player-overlay-actions")[0].children[0]){
  
document.getElementsByClassName("reel-player-overlay-actions")[0].insertBefore(ys,document.getElementsByClassName("reel-player-overlay-actions")[0].children[1]);

ys.appendChild(ysDown);
ys.appendChild(ysHeart);
}
}catch{}

}

try{document.querySelectorAll('dislike-button-view-model')[0].children[0].children[0].children[0].children[1].children[0].innerHTML=dislikes;}catch{}





/*Watch The old and New URL*
if(ytoldV != window.location.pathname){
fDislikes();
ytoldV=window.location.pathname;
}*/


}else{
/*Non-video pages must not keep any YTPro player controls around*/
ytproRemoveSpeedControls();
}

}


setInterval(pkc,0);





/*SHOW HEARTS*/
async function showHearts(){
var ytproH=document.createElement("div");
var ytproHh=document.createElement("div");
ytproHh.setAttribute("id","heartytprodiv");
ytproH.setAttribute("id","outerheartsdiv");
ytproH.setAttribute("style",`
height:100%;width:100%;position:fixed;top:0;left:0;
display:flex;justify-content:center;
background:rgba(0,0,0,0.4);
z-index:99;
`);

ytproHh.setAttribute("style",`
height:50%;width:85%;overflow:auto;background:${isD ? "#212121" : "#f1f1f1"};
position:absolute;bottom:20px;
z-index:9;padding:20px;text-align:center;border-radius:25px;text-align:center;
`);
ytproHh.innerHTML=`<style>#heartytprodiv a{text-decoration:none;} #heartytprodiv li{list-style:none; display:flex;align-items:center;border-radius:15px;padding:0px;background:${d};margin:5px;}</style>`;
ytproHh.innerHTML+="喜欢的视频<ul id='listurl'>";


ytproHh.innerHTML+="<style>.thum{height:70px;border-radius:5px;}.thum img{float:left;height:70px;width:125px;border-radius:15px 0 0 15px;flex-shrink: 0;}</style>";

document.body.appendChild(ytproH);
ytproH.appendChild(ytproHh);

ytproH.addEventListener("click",
function(ev){
if(!event.composedPath().includes(ytproHh)){
history.back();
}
});



if(localStorage.getItem("hearts") == null){
ytproHh.innerHTML+="暂无收藏视频";
}else{

var v=JSON.parse(localStorage.getItem("hearts"));

if(Object.keys(v).length === 0){
return ytproHh.innerHTML+="暂无收藏视频";
}

for(var n=Object.keys(v).length - 1; n >  -1 ; n--){
var x=Object.keys(v)[n];
ytproHh.innerHTML+=`<li class="thum" >
<img data-action="navigateInternalYtMweb" data-id="${x}" src="${v[x].thumb}" ><br>
<div style="width:calc(100% - 170px);margin-left:5px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical; -webkit-line-clamp:3;overflow:hidden;text-overflow:ellipsis;" data-action="navigateInternalYtMweb" data-id="${x}" >${v[x].title}</div>
<div style="width:calc(100% - (100% - 35px))">
<svg data-action="remHeart" data-id="${x}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" style="margin-left:0px;" fill="#f24" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
</svg>
</span>
</div>
</li>`;
await new Promise(r => setTimeout(r, 1));
}


ytproHh.addEventListener("click",(e)=>{
  var el=e.target.closest("[data-action]");
  
  if(!el) return;
  if(el.dataset.action == "navigateInternalYtMweb"){
    navigateInternalYtMweb(el.dataset.id);
  }else if(el.dataset.action == "remHeart"){
    remHeart(el,el.dataset.id);
  }
  
});

}





}


function navigateInternalYtMweb(videoId) {
    window.location.hash="";
    const link = document.createElement('a');
    link.href = `/watch?v=${videoId}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
}


/*Dil hata diya vro*/
function remHeart(y,x){
if(localStorage.getItem("hearts")?.indexOf(x) > -1){
y.parentElement.parentElement.remove();
var j=JSON.parse(localStorage.getItem("hearts") || "{}");
delete j[x];
localStorage.setItem("hearts",JSON.stringify(j));
}

}

function ytProHeart(x){


var vid=(new URLSearchParams(window.location.search)).get('v') || window.location.pathname.replace("/shorts/","");

var video=document.getElementsByClassName('video-stream')[0];
var canvas = document.createElement('canvas');
canvas.style.width = "1600px"; 
canvas.style.height = "900px";
canvas.style.background="black";
var context = canvas.getContext('2d');

(window.location.pathname.indexOf("shorts") > -1) ? context.drawImage(video,105, 0, 90,160) :  context.drawImage(video,0, 0, 320,180);

var dataURI = canvas.toDataURL('image/jpeg');


if(window.location.pathname.indexOf("shorts") > -1){

var vDetails={
thumb:dataURI,
title:document.getElementsByClassName('ytShortsVideoTitleViewModelShortsVideoTitle')[0].textContent.replaceAll("|","").replaceAll("\\","").replaceAll("?","").replaceAll("*","").replaceAll("<","").replaceAll("/","").replaceAll(":","").replaceAll('"',"").replaceAll(">","")
};

}else{

var vDetails={
thumb:dataURI,
title:document.getElementsByClassName('slim-video-metadata-header')[0].textContent.replaceAll("|","").replaceAll("\\","").replaceAll("?","").replaceAll("*","").replaceAll("<","").replaceAll("/","").replaceAll(":","").replaceAll('"',"").replaceAll(">","")
}

/*
var vDetails={
thumb:[...ytplayer.config.args.raw_player_response?.videoDetails?.thumbnail?.thumbnails].pop().url,
title:ytplayer.config.args.raw_player_response?.videoDetails?.title.replaceAll("|","").replaceAll("\\","").replaceAll("?","").replaceAll("*","").replaceAll("<","").replaceAll("/","").replaceAll(":","").replaceAll('"',"").replaceAll(">","")
};*/

}



var g="16";
var h=`<span style="margin-left:8px">收藏<span>`;
(window.location.href.indexOf('youtube.com/shorts') > -1) ? h=``:h=`<span style="margin-left:8px">收藏<span>`;
(window.location.href.indexOf('youtube.com/shorts') > -1) ? g="24" : g="24" ;



if(localStorage.getItem("hearts")?.indexOf(vid) > -1){
var j=JSON.parse(localStorage.getItem("hearts") || "{}");
delete j[vid];
localStorage.setItem("hearts",JSON.stringify(j));
x.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="${g}" height="${g}" fill="${(window.location.href.indexOf('youtube.com/shorts') > -1) ? "#fff" : c }" viewBox="0 0 24 24">
<path d="M0 0h24v24H0V0z" fill="none"/><path fill="${(window.location.href.indexOf('youtube.com/shorts') > -1) ? "#fff" : c }" d="M19.66 3.99c-2.64-1.8-5.9-.96-7.66 1.1-1.76-2.06-5.02-2.91-7.66-1.1-1.4.96-2.28 2.58-2.34 4.29-.14 3.88 3.3 6.99 8.55 11.76l.1.09c.76.69 1.93.69 2.69-.01l.11-.1c5.25-4.76 8.68-7.87 8.55-11.75-.06-1.7-.94-3.32-2.34-4.28zM12.1 18.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>${h}`;
}else{
var j=JSON.parse(localStorage.getItem("hearts") || "{}");
j[vid]=vDetails;
localStorage.setItem("hearts",JSON.stringify(j));
if(window.location.href.indexOf('youtube.com/shorts') < 0){ h=`<span style="margin-left:8px">已收藏<span>`; }
x.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="${g}" height="${g}" viewBox="0 0 24 24" ><path d="M0 0h24v24H0V0z" fill="none"/><path fill="${(window.location.href.indexOf('youtube.com/shorts') > -1) ? "#fff" : c }" d="M13.35 20.13c-.76.69-1.93.69-2.69-.01l-.11-.1C5.3 15.27 1.87 12.16 2 8.28c.06-1.7.93-3.33 2.34-4.29 2.64-1.8 5.9-.96 7.66 1.1 1.76-2.06 5.02-2.91 7.66-1.1 1.41.96 2.28 2.59 2.34 4.29.14 3.88-3.3 6.99-8.55 11.76l-.1.09z"/></svg>${h}`;
}

}



/*Dil diya hai ya nhi diya!!*/
function isHeart(){

if((localStorage.getItem("hearts")?.indexOf((new URLSearchParams(window.location.search)).get('v'))  > -1)  ||  (localStorage.getItem("hearts")?.indexOf(window.location.pathname.replace("/shorts/",""))  > -1)){
return true;
}else{
return false;

}
}






///PIP MODE CONFIG
/*PIP layout override: while the activity is inside the system PiP window the
whole WebView is scaled down, so the page chrome (top bar, injected settings
gear, nav) would cover the video. A temporary stylesheet hides that chrome and
stretches the player container to the PiP viewport. Exiting PiP only needs to
drop this one node to restore the original page layout, so no inline style
bookkeeping is required and nothing outside PiP is affected.*/
var YTPRO_PIP_STYLE_ID="ytpro-pip-style";
function applyPipLayout(){
if(document.getElementById(YTPRO_PIP_STYLE_ID)) return;
if(!document.getElementById("player-container-id")) return;
var st=document.createElement("style");
st.id=YTPRO_PIP_STYLE_ID;
st.textContent=`
html,body{margin:0 !important;padding:0 !important;overflow:hidden !important;background:#000 !important;}
ytm-mobile-topbar-renderer,ytm-pivot-bar-renderer{display:none !important;}
#player-container-id{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100% !important;height:100% !important;max-height:none !important;margin:0 !important;transform:none !important;z-index:2147483646 !important;}
#player-container-id .html5-video-player,#player-container-id .html5-video-container,#player-container-id video{width:100% !important;height:100% !important;}
`;
(document.head||document.documentElement).appendChild(st);
}
function clearPipLayout(){
var st=document.getElementById(YTPRO_PIP_STYLE_ID);
if(st) st.remove();
}
function removePIP(){

isPIP=false;
pauseAllowed = true;
try{ clearPipLayout(); }catch(err){}
var v=document.getElementsByClassName('video-stream')[0];
if(v){ try{ v.style.removeProperty('object-fit'); }catch(err){} }
try{ window.dispatchEvent(new Event('resize')); }catch(err){}
try{ applyAspect(); }catch(err){}
if(document.fullscreenElement || document.webkitFullscreenElement){
try{ document.exitFullscreen(); }catch(err){}
}
 
document.getElementsByClassName('video-stream')[0].pause();
setTimeout(()=>{
document.getElementsByClassName('video-stream')[0].play();
},5);


}




function PIPlayer(pip = false){
  
var v=document.getElementsByClassName('video-stream')[0];

 
if(pip){

if(v.getBoundingClientRect().height > v.getBoundingClientRect().width){
Android.pipvid("portrait");
}
else{
Android.pipvid("landscape");
}

return;
}


if(document.fullscreenElement || document.webkitFullscreenElement){
try{ document.exitFullscreen(); }catch(err){}
}
v.play();
pauseAllowed = false;
isPIP=true;
try{ applyPipLayout(); }catch(err){}
try{ window.dispatchEvent(new Event('resize')); }catch(err){}
if(v){ try{ v.style.setProperty('object-fit','contain','important'); }catch(err){} }

}



















// well this is for bypassing the pause function of Youtube when video is in
// PIP mode , its a workaround for now , until i find a proper method
// to allow the pip mode for the video element , like chromium browsers

HTMLMediaElement.prototype.pause = function(){
  
if (pauseAllowed || PIPause) {
return originalPause.apply(this, arguments);
}

if (this.paused) {
this.play().catch(() => {});
}
};









const originalExitFullscreen = document.exitFullscreen;
const originalRequestFullscreen = Element.prototype.requestFullscreen;

//exit full screen
// 退出全屏请求无条件放行。isPIP 现在仅用于 fullscreenchange 监听器内部
// 清除残留状态，不再拦截任何退出请求。PIP 期间的全屏退出由 removePIP()
// 显式触发且会先复位 isPIP，普通全屏退出不再被残留标志位吞掉。
document.exitFullscreen = function (...args) {
 return originalExitFullscreen.apply(this, args);
};

// Reset the PIP flag whenever the document actually leaves fullscreen, so a
// stale flag can never block a later fullscreen exit.
document.addEventListener("fullscreenchange",function(){
 if(!(document.fullscreenElement || document.webkitFullscreenElement)){
  isPIP=false;
  pauseAllowed=true;
 }
});


//request full screen
Element.prototype.requestFullscreen = function (...args) {
// A normal (non-PIP) fullscreen request resets the PIP flag, so a stale flag
// left over from a previous PIP session can never block the exit later.
isPIP=false;
var video = document.getElementsByClassName('video-stream')[0];

if(video.getBoundingClientRect().height > video.getBoundingClientRect().width){
Android.fullScreen(true);
}
else{
Android.fullScreen(false);
}

return originalRequestFullscreen.apply(this, args);
};






/*Check The Hash Change*/
window.onhashchange=()=>{
try{document.getElementById("outerdownytprodiv").remove();}catch{}
try{document.getElementById("outerheartsdiv").remove();}catch{}
try{document.getElementById("settingsprodiv").remove();}catch{}
//try{document.querySelector("#ytproDownloadIndicator").remove();}catch{}
//try{document.querySelector("#ytProDownloaderDiv").remove();}catch{}
if(window.location.hash == "#download"){
ytproDownVid();
}else if(window.location.hash == "#settings"){
ytproSettings();
}
else if(window.location.hash == "#hearts"){
showHearts();
}


}



// AdBlocker which removes the ad contents from the fetch requests itself !!
(() => {
const _origFetch = window.fetch;
window.fetch = async function(input, init) {
try {
const url = (typeof input === 'string') ? input : input.url;



//block ad urls
if(url.includes("googleads.g.doubleclick.net") || url.includes("youtube.com/youtubei/v1/player/ad_break") || url.includes("youtube.com/pagead/adview") || url.includes("youtube.com/api/stats/ads")){

//console.log("Blocked",url);
return "";
}else if(url.includes("youtube.com/youtubei/")){


const response = await _origFetch.apply(this, arguments);



try {

const clone = response.clone();
let data = await clone.json();


//older version
if(data?.responseContext?.webResponseContextExtensionData?.webResponseContextPreloadData?.preloadMessageNames?.[0] == "adSlotRenderer" || data?.responseContext?.webResponseContextExtensionData?.webResponseContextPreloadData?.preloadMessageNames?.[0] == "shortsAdsRenderer"){
data={};
}


//remove the ad content
delete data?.adSlots;
delete data?.playerAds;
delete data?.adPlacements;
delete data?.adBreakHeartbeatParams;


//newer version update: 09 Feb , 2026 23:27 IST
delete data?.[0]?.playerResponse?.adSlots;
delete data?.[0]?.playerResponse?.playerAds;
delete data?.[0]?.playerResponse?.adPlacements;
delete data?.[0]?.playerResponse?.adBreakHeartbeatParams;


const newBody = JSON.stringify(data);

// Build new headers (update content-length + content-type)
const newHeaders = new Headers(response.headers);
newHeaders.set("content-length", String(newBody.length));
newHeaders.set("content-type", "application/json");

// Return modified Response
return new Response(newBody, {
status: response.status,
statusText: response.statusText,
headers: newHeaders
});
} catch (e) {
// not JSON, return original
return response;
}



}

return _origFetch.apply(this, arguments);

} catch (e) { /* ignore logging errors */ }

return _origFetch.apply(this, arguments);


};


})();



//modified XHR for the same purpose
const XHR = window.XMLHttpRequest;
const origOpen = XHR.prototype.open;
const origSend = XHR.prototype.send;

XHR.prototype.open = function(method, url, ...rest) {
this._interceptedMethod = method;
this._interceptedUrl = url;
return origOpen.apply(this, [method, url, ...rest]);
};

XHR.prototype.send = function(body) {
// Block certain URLs
if (
this._interceptedUrl.includes("googleads.g.doubleclick.net") ||
this._interceptedUrl.includes("youtube.com/youtubei/v1/player/ad_break") ||
this._interceptedUrl.includes("youtube.com/pagead/adview") ||
this._interceptedUrl.includes("youtube.com/api/stats/ads")
) {
//console.warn("Blocked:", this._interceptedUrl);
return;
}

return origSend.apply(this, arguments);
};












/****** I LOVE YOU <3 *****/
/*YT ADS BLOCKER*/
function adsBlock(){


try{
document.getElementsByClassName('video-stream')[0].removeAttribute('disablepictureinpicture');
}catch{}


/*Block Ads*/
var ads=document.getElementsByTagName("ad-slot-renderer");
for(var x in ads){
try{ads[x].remove();}catch{}
}
try{
document.getElementsByClassName("ad-interrupting")[0].getElementsByTagName("video")[0].currentTime=document.getElementsByClassName("ad-interrupting")[0].getElementsByTagName("video")[0].duration;
document.getElementsByClassName("ytp-ad-skip-button-modern")[0].click();

}catch{}




/*Block Ads*/
try{
document.getElementsByTagName("ytm-promoted-sparkles-web-renderer")[0].remove();
}catch{}
try{
document.getElementsByTagName("ytm-companion-ad-renderer")[0].remove();
}catch{}

/*Remove Open App*/
try{
document.querySelectorAll('a').forEach(a => {
if (a.href.indexOf("intent://") > -1) {
a.style.display = 'none';
}
});
}catch{}
/*Remove Promotion Element*/
try{document.getElementsByTagName("ytm-paid-content-overlay-renderer")[0].style.display="none";}catch{}

/*Hide Shorts*/
if(localStorage.getItem("shorts") == "true"){


for( x in document.getElementsByClassName("big-shorts-singleton")){
try{document.getElementsByClassName("big-shorts-singleton")[x].remove();
}catch{}
}

for( x in document.getElementsByTagName("ytm-reel-shelf-renderer")){
try{document.getElementsByTagName("ytm-reel-shelf-renderer")[x].remove();
}catch{}

for( x in document.getElementsByTagName("ytm-shorts-lockup-view-model")){
try{document.getElementsByTagName("ytm-shorts-lockup-view-model")[x].remove();
}catch{}

}

}
}




}





//Add Maximize Gesture
function addMaxButton(){


var pElem=document.getElementById('player-container-id');
var Ve=document.getElementById('player');
var Vv=document.getElementsByClassName('video-stream')[0];



if(pElem === document.fullscreenElement){


try{
if(zoomIn){
Ve.style.transform=`scale(${scale})`;
}else{
Ve.style.transform="scale(1)";  
}
}catch{}


}else{
try{
Ve.style.transform="scale(1)";
}catch{}
}


}


function extraSpeed(){
  var el=document.querySelector(".ytwVariableSpeedControllerViewModelButtonContainer");
 if(!el) return;


const slider = document.getElementById("slider");
if(!slider || slider.max==10) return;

slider.max = 10;
slider.ariaValueMax = "10";

slider.addEventListener("input", () => {
  const video = document.querySelector('.video-stream');
  if (video){ video.playbackRate = parseFloat(slider.value); }
});

if(el.children.length >= 6) el.children[0].remove();

}

/* ---- YTPro player controls ---- */
/*Speed button: injected into the native controls row right before the
autoplay toggle (fallback: CC button, then settings gear), so it shares the
line with autoplay / CC / gear and hides together with them. The whole
cluster is shifted left by one native button slot (margin-right on the row
container) so the gear lands where CC used to be, per the agreed layout.
Clicking the pill opens a single horizontal strip of presets right below it;
one tap applies - no nested dialogs. Nothing is ever appended to
.ytwVariableSpeedControllerViewModelButtonContainer (that crowded YouTube's
own speed sheet and clipped its preset numbers).
Screenshot: round button inside the native control bar (sibling of
CC/settings/autoplay, like the speed pill), shown/hidden by YouTube's own
ytp-autohide chrome CSS, only on /watch.*/

function ytproPlayerEl(){
  return document.getElementById("movie_player") || document.querySelector(".html5-video-player");
}

function ytproRemoveSpeedControls(){
  ["ytproSpeedPill","ytproSpeedPanel","ytproShotBtn"].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.remove(); }
  });
  if(ytproAutohideObs){ ytproAutohideObs.disconnect(); }
  ytproAutohideObs=null;
}

function ytproRemoveSpeedPill(){
  ["ytproSpeedPill","ytproSpeedPanel"].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.remove(); }
  });
}

var ytproAutohideObs=null;
function bindAutohideWatch(player){
  if(ytproAutohideObs){ return; }
  ytproAutohideObs=new MutationObserver(function(){
    if(player.classList.contains("ytp-autohide")){
      var panel=document.getElementById("ytproSpeedPanel");
      if(panel){ panel.remove(); }
    }
  });
  ytproAutohideObs.observe(player,{attributes:true,attributeFilter:["class"]});
}

function injectShotButton(){
  /*Screenshot button lives inside the native control bar (sibling of
  CC/settings/autoplay, same slot pattern as the speed pill), so YouTube's
  own ytp-autohide chrome CSS shows/hides it together with those buttons.
  The old standalone-overlay + custom opacity observer design failed to
  re-show on tap (its autohide state diverged from the real controls).*/
  var gear=document.querySelector(".ytp-settings-button");
  var cc=document.querySelector(".ytp-subtitles-button");
  var auto=document.querySelector(".ytp-autonav-toggle-button");
  var anchor=auto||cc||gear;
  if(!anchor || !anchor.isConnected){ return; } /*controls hidden right now; the MutationObserver driver retries*/
  var host=anchor.parentElement;
  if(!host){ return; }
  var shot=document.getElementById("ytproShotBtn");
  if(shot && (!shot.isConnected || shot.parentElement!==host)){ shot.remove(); shot=null; }
  if(!shot){
    shot=document.createElement("div");
    shot.id="ytproShotBtn";
    shot.title="Screenshot";
    shot.setAttribute("style","display:flex;align-items:center;justify-content:center;width:40px;height:40px;color:#fff;pointer-events:auto;cursor:pointer;text-shadow:0 0 2px rgba(0,0,0,.5);");
    shot.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="#fff"><path d="M12,15.2A3.2,3.2 0 1,0 8.8,12A3.2,3.2 0 0,0 12,15.2M9,2L7.17,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4H16.83L15,2M12,17A5,5 0 1,1 17,12A5,5 0 0,1 12,17Z"></path></svg>`;
    shot.addEventListener("click",function(e){
      e.stopPropagation();
      ytproScreenshot();
    });
    shot.addEventListener("touchstart",function(e){ e.stopPropagation(); },{passive:true});
  }
  /*Place next to the speed pill if present, otherwise right before the
  native anchor. Re-insert only when the parent or neighbour changes so
  re-injection by the MutationObserver driver never churns the DOM.*/
  var pill=document.getElementById("ytproSpeedPill");
  var before=(pill && pill.isConnected && pill.parentElement===host)?pill:anchor;
  if(shot.parentElement!==host || shot.nextElementSibling!==before){
    host.insertBefore(shot,before);
  }
}

function buildSpeedStrip(){
  var strip=document.createElement("div");
  strip.id="ytproSpeedPanel";
  strip.setAttribute("style","position:absolute;z-index:2147483646;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;max-width:calc(100% - 24px);background:rgba(18,18,18,.95);border-radius:12px;padding:8px;box-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:auto;");
  YTPRO_SPEED_PRESETS.forEach(function(r){
    var it=document.createElement("div");
    it.setAttribute("data-rate",String(r));
    it.textContent=r+"x";
    it.setAttribute("style","padding:7px 10px;border-radius:16px;font-size:13px;font-weight:600;color:#fff;background:rgba(255,255,255,.12);cursor:pointer;");
    it.addEventListener("click",function(e){
      e.stopPropagation();
      YTProSpeed.set(r);
      closeStrip();
    });
    strip.appendChild(it);
  });
  ["touchstart","click"].forEach(function(ev){
    strip.addEventListener(ev,function(e){ e.stopPropagation(); },{capture:true,passive:ev=="touchstart"});
  });
  var closeStrip=function(){
    if(strip.parentNode){ strip.remove(); }
    document.removeEventListener("touchstart",onDocDown,true);
    document.removeEventListener("mousedown",onDocDown,true);
  };
  var onDocDown=function(e){
    if(strip.contains(e.target)){ return; }
    var pill=document.getElementById("ytproSpeedPill");
    if(pill && pill.contains(e.target)){ return; }
    closeStrip();
  };
  setTimeout(function(){
    document.addEventListener("touchstart",onDocDown,true);
    document.addEventListener("mousedown",onDocDown,true);
  },0);
  return strip;
}

function toggleSpeedStrip(pill){
  var old=document.getElementById("ytproSpeedPanel");
  if(old){ old.remove(); return; }

  var strip=buildSpeedStrip();
  var host=document.getElementById("player-container-id")||document.body;
  host.appendChild(strip);
  YTProSpeed.updateLabel(YTProSpeed.current);

  var hr=host.getBoundingClientRect();
  var pr=pill.getBoundingClientRect();
  var left=pr.left-hr.left+pr.width/2-strip.offsetWidth/2;
  left=Math.max(12,Math.min(left,hr.width-strip.offsetWidth-12));
  strip.style.left=left+"px";
  var below=pr.bottom-hr.top+8;
  if(below+strip.offsetHeight < hr.height-8){ strip.style.top=below+"px"; }
  else{ strip.style.top=(pr.top-hr.top-strip.offsetHeight-8)+"px"; }
}

function injectSpeedControls(){
  var video=document.querySelector(".video-stream");
  if(video){ bindSpeedWatch(video); }

  if(window.location.href.indexOf("youtube.com/watch") < 0){ ytproRemoveSpeedControls(); return; }

  if(video){ YTProSpeed.ensureVideoReset(video); }

  var player=ytproPlayerEl();
  if(player){ bindAutohideWatch(player); }

  injectShotButton();

  if(localStorage.getItem("ytproSpeedBtn") == "false"){
    ytproRemoveSpeedPill();
    return;
  }

  var gear=document.querySelector(".ytp-settings-button");
  var cc=document.querySelector(".ytp-subtitles-button");
  var auto=document.querySelector(".ytp-autonav-toggle-button");
  var anchor=auto||cc||gear;
  if(!anchor || !anchor.isConnected){ return; } /*controls hidden right now; the observer retries*/

  var pill=document.getElementById("ytproSpeedPill");
  if(pill && (!pill.isConnected || pill.parentElement!==anchor.parentElement)){ pill.remove(); pill=null; }
  if(pill && pill.nextElementSibling!==anchor){ anchor.parentElement.insertBefore(pill,anchor); }
  if(!pill){
    pill=document.createElement("div");
    pill.id="ytproSpeedPill";
    pill.setAttribute("style","display:flex;align-items:center;justify-content:center;min-width:36px;height:40px;padding:0 8px;color:#fff;font-size:13px;font-weight:500;pointer-events:auto;cursor:pointer;text-shadow:0 0 2px rgba(0,0,0,.5);");
    pill.textContent=YTProSpeed.current+"x";
    pill.addEventListener("click",function(e){
      e.stopPropagation();
      toggleSpeedStrip(pill);
    });
    pill.addEventListener("touchstart",function(e){ e.stopPropagation(); },{passive:true});
    anchor.parentElement.insertBefore(pill,anchor);
  }

  /*Shift the whole button cluster left by one native slot so the gear takes
  CC's old spot, CC takes autoplay's, autoplay moves one further left and the
  pill occupies the vacated slot (agreed layout). Measured live, applied once
  per container instance so re-injection never stacks offsets.*/
  var container=anchor.parentElement;
  var gr=gear?gear.getBoundingClientRect():null;
  var cr=cc?cc.getBoundingClientRect():null;
  var slot=(gr && cr && gr.left>cr.left)?Math.round(gr.left-cr.left):44;
  if(container && !container.__ytproShiftApplied && slot>8){
    container.__ytproShiftApplied=true;
    container.style.marginRight=slot+"px";
  }

  /*controls went away or auto-hid: drop the open strip too*/
  var panel=document.getElementById("ytproSpeedPanel");
  if(panel){
    var player=ytproPlayerEl();
    if(!pill.isConnected || (player && player.classList.contains("ytp-autohide"))){ panel.remove(); }
  }
}

/*One-tap HD screenshot (Canvas 方案)：把当前帧按视频原始分辨率画进 canvas，
用 toBlob 异步编码（FileReader 转 base64），交给 Android 端存入系统相册
Pictures/YTPro。YouTube 是 MSE 同源 blob 流，drawImage 不会污染画布；
因此不做 crossOrigin 处理（那样反而会中断播放）。*/
function ytproScreenshotFail(msg){
  try{
    Android.showToast(localStorage.getItem("devMode")=="true" ? ("截图失败："+msg) : "截图失败，可到设置开启开发者模式查看原因");
  }catch(err){}
}

function ytproCanvasToBase64(canvas,ok,fail){
  var fromDataUrl=function(dataUrl){
    var i=dataUrl.indexOf(",");
    ok(i>-1 ? dataUrl.slice(i+1) : dataUrl);
  };
  try{
    if(typeof canvas.toBlob === "function"){
      canvas.toBlob(function(blob){
        if(!blob){ fail("toBlob 返回空"); return; }
        try{
          var reader=new FileReader();
          reader.onload=function(){ fromDataUrl(reader.result); };
          reader.onerror=function(){ fail("FileReader 读取失败"); };
          reader.readAsDataURL(blob);
        }catch(e){ fail(e&&e.message?e.message:"FileReader 异常"); }
      },"image/jpeg",0.95);
      return;
    }
  }catch(e){ /*toBlob 不可用或抛错：走 toDataURL 兜底*/ }
  try{
    fromDataUrl(canvas.toDataURL("image/jpeg",0.95));
  }catch(e){
    fail(e && e.name==="SecurityError" ? "画布被跨域污染(SecurityError)" : (e&&e.message?e.message:"toDataURL 失败"));
  }
}

function ytproScreenshot(){
  var v=document.querySelector(".video-stream");
  if(!v || !v.videoWidth || !v.videoHeight || v.readyState < 2){
    try{ Android.showToast("视频未就绪，播放片刻后再试"); }catch(err){}
    return;
  }
  try{
    var canvas=document.createElement("canvas");
    canvas.width=v.videoWidth;
    canvas.height=v.videoHeight;
    canvas.getContext("2d").drawImage(v,0,0,canvas.width,canvas.height);

    ytproCanvasToBase64(canvas,function(b64){
      try{
        var d=new Date();
        function p(n){ return (n<10?"0":"")+n; }
        var id="";
        try{ id=String(ytproWatchId()).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,24); }catch(e){ id=""; }
        if(!id){ id="shot"; }
        var name="YTPro_"+id+"_"+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"_"+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds())+".jpg";
        if(typeof Android!=="undefined" && typeof Android.saveScreenshot==="function"){
          Android.saveScreenshot(name,b64);
          ytproFlash();
        }else{
          ytproScreenshotFail("saveScreenshot 桥接不可用，请更新到最新版");
        }
      }catch(err){ ytproScreenshotFail(err&&err.message?err.message:"保存异常"); }
    },ytproScreenshotFail);
  }catch(err){
    ytproScreenshotFail(err&&err.message?err.message:"截图异常");
  }
}

function ytproFlash(){
  var host=document.getElementById("player-container-id");
  if(!host){ return; }
  var f=document.createElement("div");
  f.setAttribute("style","position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;opacity:.85;z-index:2147483646;pointer-events:none;transition:opacity .18s ease-out;");
  host.appendChild(f);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ f.style.opacity="0"; }); });
  setTimeout(function(){ f.remove(); },260);
}


//https://youtube.com/watch?v=SInH_fP0deQ



/*Aspect ratio control*/
function aspectMode(){
  return localStorage.getItem("aspectMode") || "fit";
}

function applyAspect(){
  var v=document.getElementsByClassName('video-stream')[0];
  if(!v) return;
  var m=aspectMode();
  var fit = m === "fill" ? "fill" : (m === "crop" ? "cover" : "contain");
  try{ v.style.objectFit = fit; }catch(err){}
}

function cycleAspect(){
  var m=aspectMode();
  var next = m === "fit" ? "fill" : (m === "crop" ? "fit" : "crop");
  localStorage.setItem("aspectMode", next);
  applyAspect();
  updateAspectButton();
}

function aspectLabel(){
  var m=aspectMode();
  var t = m === "fill" ? "填充" : (m === "crop" ? "裁剪" : "适应");
  return `<svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" width="22"><path fill="${c}" d="M19 5v14H5V5h14zm0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span style="margin-left:8px">画面比例：${t}<span>`;
}

function updateAspectButton(){
  var b=document.getElementById("ytproAspectBtn");
  if(b){ b.innerHTML=aspectLabel(); }
}


/*Mutation Observer*/
//as i have been developing YTPRO for almost 4 years now
//thus it still contains the code which i used when i was a
//totally noob in copy pasting , that time i wasn't aware of
//plenty of things and by which i used `setInterval` instead
//of mutation observer , i shall be optimizing the code in future
//releases but rn only a few code blocks will be in the obesrver

const targetNode = document.body;
const config = { childList: true, subtree: true };

const observer = new MutationObserver(() => {


//speed

extraSpeed();

//ytpro speed pill + screenshot pill inside the native controls bar
injectSpeedControls();
  
//ads Block
adsBlock();


//mE button
addMaxButton();

//aspect ratio
applyAspect();

//settingsTab
addSettingsTab();


try{
var video = document.getElementsByClassName('video-stream')[0];
if(video.getBoundingClientRect().height > video.getBoundingClientRect().width){
Android.fullScreen(true);
}
else{
Android.fullScreen(false);
}}
catch{}


});

// Start observing changes in the body
observer.observe(targetNode, config);





/*Update your app bruh*/
function updateModel(){
var x=document.createElement("div");

x.setAttribute("style",`height:100%;width:100%;position:fixed;display:grid;align-items:center;top:0;left:0;background:rgba(0,0,0,.6);z-index:99999;`);

x.innerHTML=`
<div style="height:auto;width:70%;padding:20px;background:rgba(0,0,0,.6);border:1px solid #888;box-shadow:0px 0px 5px black;color:white;backdrop-filter:blur(10px);border-radius:15px;margin:auto">
<h2> 强制更新 </h2><br>
YTPro 新版本 ${YTProVer} 已发布，更新以获取最新功能。
<br>- 本次为强制更新，修复了大量问题并改进功能 <br>
- 修复下载功能，切换为 SABR 下载器<br>
- 新增视频音轨合并（muxing）<br>
- 修复亮度与音量手势控制<br>
- 优化下载与设置菜单界面<br>
- 新增最高 10 倍速播放<br>
- 修复若干问题并改进功能<br>
- 完整列表 <u data-action="url" >点这里</u>
<br>
<br>
<div style="display:flex;">
<!--<button style="border:0;border-radius:10px;height:30px;width:150px;background:;" data-action="cancel">Cancel</button>-->
<button style="border:0;border-radius:10px;height:30px;width:150px;background:rgba(255,50,50,.7);float:right;" data-action="download" >立即更新</button>
</div>

</div>
`;

x.addEventListener("click",(e)=>{
  var el=e.target.closest("[data-action]");
  if(!el) return;
  var action=el.dataset.action;
  
  if(action == "url"){
    Android.oplink('https://github.com/prateek-chaubey/YTPRO/releases');
  }else if(action == "download"){
    Android.downvid('YTPRO.zip','https://nightly.link/prateek-chaubey/YTPro/workflows/gradle/main/YTPRO.zip','application/zip');  
  }else if(action =="cancel"){
    el.parentElement.parentElement.parentElement.remove();
  }
  
})

document.body.appendChild(x);
}





window.onload = function(){ 
if(parseFloat(Android.getInfo()) < parseFloat(YTProVer) && (window.location.href == "https://m.youtube.com/" || window.location.href == "https://m.youtube.com") ){
updateModel();
}

};




document.addEventListener('click',(event) => {

let anchor = event.target.closest('a');
if (anchor){


if(anchor.href.includes("www.youtube.com/redirect")){

try{
document.getElementsByClassName('video-stream')[0].pause();
}catch{}

const url=new URL(anchor.href).searchParams.get("q");

setTimeout(()=>{Android.oplink(url)},50);

event.preventDefault();
event.stopPropagation(); 

}


}
},
true);




}
