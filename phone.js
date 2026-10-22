/* © Karen O'Brien (Coffeebreak). All rights reserved. */
(function(){
var $=function(s){return document.querySelector(s)},MODE=window.CB_MODE,P=window.CB_P,K=P,q=CB.q,BASE=CB.BASE;
function clean(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,20)}
function parse(s){s=String(s||'');var m=s.match(/[?&](?:call|me)=([^&#]+)/);if(m)s=decodeURIComponent(m[1]);var p=s.toLowerCase().split(/[.\-\s]/),n=clean(p[0]),c=clean(p[1]||'').slice(0,8);return n?{n:n,c:c,a:c?n+'.'+c:n}:null}
function nm(a){return String(a||'').split('.')[0]}
function idOf(a){return a.replace('.','-')}function adOf(id){return id.replace('-','.')}
var meP=parse(q.get('me'))||parse(localStorage.getItem(K+'me')),tg=parse(q.get('call')),target=tg&&tg.c?tg.a:null,badLink=tg&&!tg.c;
var me,myAddr,myId,sig,links=new Map(),book=JSON.parse(localStorage.getItem(K+'book')||'[]');
var cs=null,cl=null,pend=false,muted=false,paused=false,rhold=false,spk=true,granted=false,taken=false,flashT=0,flashMsg='';
window.cbStat={v:CB.V};
function st(t,ok){var e=$('#st');if(e.textContent!=t)e.textContent=t;e.className=ok?'ok':''}
function step(t){var e=$('#steps');if(e.textContent!=t)e.textContent=t}
function flash(t){flashMsg=t;flashT=Date.now()+3500;ui()}
/* ---- contacts ---- */
function key(n){return String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function live(){return book.filter(function(c){return !c.del})}
function store(){localStorage.setItem(K+'book',JSON.stringify(book));fill();drawList()}
function merge(list,quiet){var ch=0;(list||[]).forEach(function(c){if(!c||!c.k)return;var o=book.find(function(x){return x.k==c.k});
 if(!o){book.push({k:c.k,n:c.n||c.k,a:c.a||'',tel:c.tel||'',t:c.t||Date.now(),del:!!c.del});ch++}
 else if((c.t||0)>(o.t||0)){o.n=c.n||o.n;o.a=c.a||'';o.tel=c.tel||'';o.t=c.t;o.del=!!c.del;ch++}});if(ch){store();if(!quiet)push()}return ch}
function upsert(n,a,tel){var k=key(n||nm(a));if(!k)return;var o=book.find(function(x){return x.k==k});merge([{k:k,n:n||nm(a),a:a||(o&&o.a)||'',tel:tel||(o&&o.tel)||'',t:Date.now()}])}
function save(a){if(!a||a==myAddr||a.indexOf('.')<0)return;if(book.some(function(c){return c.a==a&&!c.del}))return;var o=book.find(function(c){return !c.del&&c.k==key(nm(a))});upsert(o?o.n:nm(a),a,'')}
function cname(a){var c=book.find(function(x){return x.a==a&&!x.del});return c?c.n:nm(a)}
function fill(){var w=$('#who');w.innerHTML='';var Lst=live().filter(function(c){return c.a});if(target&&!Lst.some(function(c){return c.a==target}))Lst.unshift({a:target,n:nm(target)});
 if(!Lst.length){w.innerHTML='<option value="">Share your link to add people</option>';return}Lst.forEach(function(c){var o=document.createElement('option');o.value=c.a;o.textContent=c.n;w.appendChild(o)});if(target)w.value=target}
var lastPush='';function push(){if(!myId)return;var b=JSON.stringify({d:sig.tab,b:book});if(b==lastPush)return;lastPush=b;fetch('https://ntfy.sh/'+P+'sync-'+myId,{method:'POST',body:b}).catch(function(){})}
function syncListen(){try{var es=new EventSource('https://ntfy.sh/'+P+'sync-'+myId+'/sse?since=12h');es.onmessage=function(e){try{var m=JSON.parse(JSON.parse(e.data).message);if(m.d==sig.tab)return;merge(m.b,true)}catch(x){}}}catch(e){}}
/* ---- links ---- */
function link(a){var L=links.get(a);if(!L){L=new CB.Link(sig,idOf(a),{onopen:onopen,onclose:onclose,onmsg:onmsg,ontrack:ontrack,onroute:ui});L.a=a;links.set(a,L)}return L}
function onopen(L){save(L.a);if(L.a==target&&!cbStat.linkMs){cbStat.linkMs=Math.round(L.tOpen-CB.T0)}if(!target){target=L.a;fill()}if(pend&&cl==L){pend=false;L.tx({k:'call'})}if(cs=='on'&&cl==L){L.tx({k:'call',resume:1})}ui()}
function onclose(L){if(cl==L&&cs)endCall('Line dropped');ui()}
function ontrack(L){if(cl==L&&cs=='on')attach()}
function onSig(m){if(m.k=='take'){if(m.f==myId&&m.t>sig.start0)takeOver();return}var a=adOf(m.f);if(a==myAddr)return;var L=link(a);if(m.k=='hello'||m.k=='offer')save(a);L.onMsg(m)}
function onmsg(L,m){var who=cname(L.a);
 if(m.k=='call'){if(cs=='on'&&cl==L)return;if(paused){L.tx({k:'paused'});return}if(cs&&cl!=L){L.tx({k:'busy'});return}cl=L;target=L.a;fill();
  if(MODE=='sim'||m.resume)answer(false);else{cs='in';ring(true);notify(who);ui()}}
 else if(m.k=='answer'){if(cs=='out'&&cl==L){cbStat.callMs=Math.round(performance.now()-cbStat.tCall);onCall()}}
 else if(m.k=='bye')(cl==L)&&endCall('Call ended');
 else if(m.k=='decline')(cl==L)&&endCall(who+' can\'t talk now');
 else if(m.k=='busy'||m.k=='paused')(cl==L)&&endCall(who+(m.k=='paused'?' has paused calls':' is on another call'));
 else if(m.k=='hold'){if(cl==L){rhold=!!m.on;ui()}}}
/* ---- calls ---- */
function answer(gesture){ring(false);cl.tx({k:'answer'});onCall();mic(gesture).catch(function(){needTap(true)})}
function onCall(){cs='on';rhold=false;clearTimeout(answer.t);attach();liveMic();ui()}
function attach(){var a=$('#au');CB.setSink(a);if(cl&&cl.stream&&a.srcObject!==cl.stream)a.srcObject=cl.stream;a.muted=paused;a.volume=spk?1:0.35;var p=a.play();if(p)p.catch(function(){needTap(true)})}
function endCall(msg){if(!cs)return;cs=null;cl=null;pend=false;rhold=false;ring(false);clearTimeout(answer.t);var a=$('#au');a.muted=true;liveMic();needTap(false);flash(msg||'Call ended')}
function hang(){if(cl)cl.tx({k:cs=='in'?'decline':'bye'});endCall('Call ended')}
$('#call').onclick=function(){unlock();if(cs){hang();return}target=target||$('#who').value;if(!target){flash('Share your link first');return}if(paused){flash('Turn off Pause to call');return}
 var L=link(target);L.want=true;mic(true).catch(function(){});cs='out';cl=L;cbStat.tCall=performance.now();
 if(L.open)L.tx({k:'call'});else{pend=true;L.tick()}answer.t=setTimeout(function(){if(cs=='out'){if(cl)cl.tx({k:'bye'});endCall('No answer')}},45000);ui()};
$('#answer').onclick=function(){unlock();if(cs=='in')answer(true)};
$('#decline').onclick=function(){if(cs=='in')hang()};
$('#ans').onclick=function(){unlock();mic(true).then(function(){needTap(false);if(cs=='on')attach();flash('Phone is on')}).catch(function(){flash('Allow the microphone in settings')});if(cs=='on')attach()};
function needTap(on){$('#ans').classList.toggle('hide',!on)}
var micP;function mic(gesture){if(CB.track&&CB.track.readyState=='live')return Promise.resolve(CB.track);if(micP)return micP;if(!gesture&&!granted)return Promise.reject(new Error('no'));
 micP=navigator.mediaDevices.getUserMedia({audio:CB.micC()}).then(function(s){micP=null;var t=s.getAudioTracks()[0];CB.track=t;granted=true;
  links.forEach(function(L){L.setTrack(t);if(L.open&&!L.tr)L.reset()});liveMic();needTap(false);return t},function(e){micP=null;throw e});return micP}
function liveMic(){if(CB.track)CB.track.enabled=cs=='on'&&!muted&&!paused}
if(q.get('t')!='nomic'&&navigator.permissions&&navigator.permissions.query)navigator.permissions.query({name:'microphone'}).then(function(p){if(p.state=='granted'){granted=true;mic(false).catch(function(){})}}).catch(function(){});
var actx;function unlock(){try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state=='suspended')actx.resume()}catch(e){}var a=$('#au');if(a.srcObject)a.play().catch(function(){})}
document.addEventListener('pointerdown',function(){unlock();if(cs=='on'&&!CB.track)mic(true).catch(function(){})},true);
var rt;function ring(on){clearInterval(rt);if(!on)return;var f=function(){if(navigator.vibrate)navigator.vibrate([400,200,400]);beep()};f();rt=setInterval(f,2000)}
function beep(){try{if(!actx||actx.state!='running')return;[0,0.45].forEach(function(d){var o=actx.createOscillator(),g=actx.createGain();o.frequency.value=d?480:440;g.gain.setValueAtTime(0.0001,actx.currentTime+d);g.gain.exponentialRampToValueAtTime(0.25,actx.currentTime+d+0.05);g.gain.exponentialRampToValueAtTime(0.0001,actx.currentTime+d+0.4);o.connect(g).connect(actx.destination);o.start(actx.currentTime+d);o.stop(actx.currentTime+d+0.42)})}catch(e){}}
$('#mute').onclick=function(){muted=!muted;liveMic();this.classList.toggle('on',muted);this.textContent=muted?'Unmute':'Mute'};
$('#pause').onclick=function(){paused=!paused;liveMic();$('#au').muted=paused;if(cs=='on'&&cl)cl.tx({k:'hold',on:paused});this.classList.toggle('on',paused);this.textContent=paused?'Resume':'Pause';ui()};
$('#spk').onclick=function(){spk=!spk;$('#au').volume=spk?1:0.35;this.classList.toggle('on',!spk);this.textContent=spk?'Speaker on':'Speaker off'};
$('#who').onchange=function(){if(cs)return;target=this.value;if(target)link(target).want=true;ui()};
/* ---- status ---- */
function ui(){if(!sig)return;var c=$('#call'),L=target&&links.get(target),who=cl?cname(cl.a):target?cname(target):'';
 c.textContent=cs?(cs=='in'?'END':'END'):'CALL';c.classList.toggle('end',!!cs);c.classList.toggle('hide',cs=='in');$('#inbox').classList.toggle('hide',cs!='in');
 $('#retry').classList.add('hide');
 if(cs=='in'){st(who+' is calling',true);step('Tap Answer')}
 else if(cs=='out'){st(pend?'Connecting to '+who:'Ringing '+who,true);step(pend?'Getting the line ready':'Waiting for '+who)}
 else if(cs=='on'){st(paused?'Paused':rhold?who+' paused the call':'On call with '+who,true);step(cl&&cl.via=='relay'?'Line: relay':'Line: direct')}
 else if(Date.now()<flashT){st(flashMsg)}
 else if(badLink&&!target){st('This link is missing its code');step('Ask for a new link')}
 else if(!sig.isUp()){st('Going online');step('Starting')}
 else if(!target){st('Online. Ready',true);step('Share your link so people can call you')}
 else if(L&&L.open){st('Connected to '+who,true);step(L.via=='relay'?'Ready. Line: relay':'Ready')}
 else{var age=L?Date.now()-L.since:0;st('Connecting to '+who);step(!L||L.att<2?'Finding '+who:L.att<3?'Trying another way':'Trying the relay line');
  if(age>15000){$('#retry').classList.remove('hide');st('Not connected yet');step('Check both phones have the app open, then tap Try again')}}
 if(paused&&!cs)step('Paused. Calls are blocked')}
$('#retry').onclick=function(){var L=target&&link(target);sig.revive(true);if(L){L.want=true;L.reset()}ui()};
/* ---- start ---- */
function go(){var sk=K+'sec-'+meP.n,sec=meP.c||localStorage.getItem(sk)||CB.rnd(5);localStorage.setItem(sk,sec);me=meP.n;myAddr=me+'.'+sec;myId=idOf(myAddr);CB.myName=me;
 localStorage.setItem(K+'me',myAddr);history.replaceState(null,'',BASE+'?me='+myAddr+(target?'&call='+target:''));
 $('#setup').classList.add('hide');$('#app').classList.remove('hide');$('#me').textContent='You are '+me;
 sig=new CB.Sig(P,myId,onSig);sig.onup=function(){links.forEach(function(L){L.tick()});ui()};sig.start();claim();
 if(target){save(target);link(target).want=true}fill();drawList();CB.awake();syncListen();setTimeout(function(){lastPush='';push()},2000);
 var qrT=setInterval(function(){if(window.QRCode){clearInterval(qrT);new QRCode($('#qr'),{text:BASE+'?call='+myAddr,width:120,height:120,colorDark:'#7a1f48'})}},150);
 setInterval(function(){links.forEach(function(L){L.tick()});ui()},1000);if(target)link(target).tick();ui()}
var bc=window.BroadcastChannel?new BroadcastChannel(P+'tabs'):null;
function claim(){sig.send(myId,{k:'take'});if(bc)bc.postMessage({k:'take',id:myId,tab:sig.tab,t:Date.now()})}
if(bc)bc.onmessage=function(e){var m=e.data;if(m&&m.k=='take'&&sig&&m.id==myId&&m.tab!=sig.tab&&m.t>sig.start0)takeOver()};
function takeOver(){if(taken)return;taken=true;if(cs)endCall('');sig.stop();links.forEach(function(L){L.close()});links.clear();$('#taken').classList.remove('hide');$('#app').classList.add('hide')}
$('#usehere').onclick=function(){taken=false;$('#taken').classList.add('hide');$('#app').classList.remove('hide');sig.start();claim();if(target)link(target).want=true;ui()};
var hiddenAt=0;document.addEventListener('visibilitychange',function(){if(document.hidden){hiddenAt=Date.now();return}CB.awake();CB.checkVersion();if(sig&&!taken){sig.revive(Date.now()-hiddenAt>8000);links.forEach(function(L){if(L.want&&!L.open){L.lastTry=0;L.tick()}});ui()}});
window.addEventListener('online',function(){if(sig&&!taken){sig.revive(true);links.forEach(function(L){L.lastTry=0;L.tick()})}});
CB.onUpdate=function(){st('Updating')};CB.checkVersion();
if(location.hash.indexOf('#c=')==0){try{var got=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(3)))));setTimeout(function(){addMany(got)},500)}catch(e){}history.replaceState(null,'',location.pathname+location.search)}
if(!meP){$('#setup').classList.remove('hide');$('#nm').focus()}else go();
$('#start').onclick=function(){meP=parse($('#nm').value);if(!meP){$('#nm').focus();return}go()};
$('#nm').onkeydown=function(e){if(e.key=='Enter')$('#start').click()};
function shareIt(o,fb){if(navigator.share)navigator.share(o).catch(function(){});else{(navigator.clipboard?navigator.clipboard.writeText(fb):Promise.reject()).then(function(){flash('Link copied')}).catch(function(){prompt('Copy this',fb)})}}
$('#share').onclick=function(){var u=BASE+'?call='+myAddr;shareIt({title:'Call me',url:u},u)};
/* ---- More ---- */
var panels=['pContacts','pAdd','pScan','pImp','pSend','pDev'];
function show(id){panels.forEach(function(p){$('#'+p).classList.toggle('hide',p!=id||!$('#'+p).classList.contains('hide'))});if(id!='pScan')stopScan()}
$('#more').onclick=function(){var b=$('#morebox');b.classList.toggle('hide');this.textContent=b.classList.contains('hide')?'More':'Close'};
$('#bContacts').onclick=function(){drawList();show('pContacts')};
var editing=null;
$('#bAdd').onclick=function(){editing=null;$('#addh').textContent='Add contact';$('#cn').value=$('#cs').value=$('#ct').value='';show('pAdd')};
$('#csave').onclick=function(){var n=$('#cn').value.trim(),p=parse($('#cs').value),a=p&&p.c?p.a:'',t=$('#ct').value.replace(/[^0-9+]/g,'');if(!n&&!a){$('#cn').focus();return}
 if(p&&!p.c){flash('Use their full link');return}if(editing&&editing!=key(n||nm(a)))merge([{k:editing,t:Date.now(),del:true}]);upsert(n||nm(a),a,t);editing=null;flash('Saved');drawList();show('pContacts')};
function callTo(a){if(cs)return;target=a;fill();link(a).want=true;window.scrollTo(0,0);$('#call').click()}
function drawList(){var Lst=live().sort(function(a,b){return a.n.localeCompare(b.n)}),d=$('#clist');d.innerHTML=Lst.length?'':'<div>No contacts yet</div>';
 Lst.forEach(function(c){var r=document.createElement('div');r.className='ct';var s=document.createElement('span');s.textContent=c.n;r.appendChild(s);
  function btn(t,cl,f){var b=document.createElement('button');b.textContent=t;if(cl)b.className=cl;b.onclick=f;r.appendChild(b)}
  if(c.a)btn('📞 Call','g',function(){callTo(c.a)});if(c.tel)btn('☎️ Phone','',function(){location.href='tel:'+c.tel});
  btn('✏️ Edit','',function(){editing=c.k;$('#addh').textContent='Edit contact';$('#cn').value=c.n;$('#cs').value=c.a?BASE+'?call='+c.a:'';$('#ct').value=c.tel;show('pAdd')});
  btn('🗑️ Delete','',function(){if(confirm('Delete '+c.n+'?'))merge([{k:c.k,n:c.n,t:Date.now(),del:true}])});d.appendChild(r)})}
var camS,scanT;function stopScan(){clearTimeout(scanT);if(camS)camS.getTracks().forEach(function(t){t.stop()});camS=null}
function gotCode(txt){var p=parse(txt);stopScan();if(!p||!p.c){flash('Not a Coffeebreak code');return}upsert(p.n,p.a,'');target=p.a;fill();link(p.a).want=true;flash('Added '+p.n);show('pContacts')}
function loadJsQR(f){if(window.jsQR)return f();var sc=document.createElement('script');sc.src='jsQR.js';sc.onload=f;document.head.appendChild(sc)}
$('#bScan').onclick=function(){show('pScan');if($('#pScan').classList.contains('hide'))return;var v=$('#cam');
 navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){camS=s;v.srcObject=s;v.play();var det=('BarcodeDetector' in window)?new BarcodeDetector({formats:['qr_code']}):null,cv=document.createElement('canvas'),cx=cv.getContext('2d');
 function tick(){if(!camS)return;if(v.readyState<2){scanT=setTimeout(tick,200);return}
  if(det)det.detect(v).then(function(r){if(r.length)gotCode(r[0].rawValue);else scanT=setTimeout(tick,250)}).catch(function(){det=null;tick()});
  else loadJsQR(function(){cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);var r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);if(r)gotCode(r.data);else scanT=setTimeout(tick,300)})}tick()}).catch(function(){flash('Allow the camera')})};
$('#scanstop').onclick=function(){stopScan();show('pScan')};
function esc(s){return String(s||'').replace(/([,;\\])/g,'\\$1')}
function toVcf(Lst){return Lst.map(function(c){return ['BEGIN:VCARD','VERSION:3.0','FN:'+esc(c.n),'N:'+esc(c.n)+';;;;',c.tel?'TEL;TYPE=CELL:'+c.tel:'',c.a?'URL:'+BASE+'?call='+c.a:'','END:VCARD'].filter(Boolean).join('\r\n')}).join('\r\n')+'\r\n'}
function fromVcf(txt){var out=[];txt.replace(/\r?\n[ \t]/g,'').split(/BEGIN:VCARD/i).forEach(function(b){if(!/END:VCARD/i.test(b))return;var c={n:'',a:'',tel:''};
 b.split(/\r?\n/).forEach(function(l){var i=l.indexOf(':');if(i<0)return;var k=l.slice(0,i).toUpperCase().split(';')[0].replace(/^ITEM\d+\./,''),v=l.slice(i+1).replace(/\\([,;\\])/g,'$1');
  if(k=='FN')c.n=v.trim();else if(k=='N'&&!c.n)c.n=v.split(';').reverse().filter(Boolean).join(' ').trim();else if(k=='TEL'&&!c.tel)c.tel=v.replace(/[^0-9+]/g,'');else if(k=='URL'&&/[?&]call=/.test(v)){var p=parse(v);if(p&&p.c)c.a=p.a}});
 if(c.n||c.a||c.tel)out.push(c)});return out}
function addMany(Lst){var t=Date.now(),n=merge(Lst.map(function(c){var x=c.n||nm(c.a)||c.tel;return {k:key(x),n:x,a:c.a||'',tel:c.tel||'',t:t}}).filter(function(c){return c.k}));flash('Added '+n+' contacts');return n}
$('#bImp').onclick=function(){if(!('contacts' in navigator&&'ContactsManager' in window))$('#pick').classList.add('hide');show('pImp')};
$('#pick').onclick=function(){navigator.contacts.select(['name','tel'],{multiple:true}).then(function(r){addMany(r.map(function(c){return {n:(c.name||[])[0]||'',tel:((c.tel||[])[0]||'').replace(/[^0-9+]/g,'')}}));show('pContacts')}).catch(function(){})};
$('#vcfbtn').onclick=function(){$('#vcf').click()};
$('#vcf').onchange=function(){var f=this.files[0];if(!f)return;f.text().then(function(t){addMany(fromVcf(t));drawList();show('pContacts')});this.value=''};
function vcfFile(){return new File([toVcf(live())],'coffeebreak-contacts.vcf',{type:'text/vcard'})}
function download(f){var a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000)}
$('#bSave').onclick=function(){if(!live().length){flash('No contacts yet');return}download(vcfFile());flash('Contacts file saved')};
$('#bSend').onclick=function(){show('pSend')};
$('#sendlink').onclick=function(){var Lst=live().map(function(c){return {n:c.n,a:c.a,tel:c.tel}});var u=BASE+'#c='+btoa(unescape(encodeURIComponent(JSON.stringify(Lst))));shareIt({title:'My Coffeebreak contacts',url:u},u)};
$('#sendfile').onclick=function(){var f=vcfFile();if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:'My contacts'}).catch(function(){});else download(f)};
$('#bDev').onclick=function(){show('pDev');mic(true).catch(function(){}).then(function(){CB.fillDev(function(old){mic(true).then(function(){if(old)old.stop()}).catch(function(){CB.track=old})})})};
CB.hasCam(function(y){if(!y)$('#bScan').classList.add('hide')});
CB.keys(function(){if(taken)return;if(cs=='in')$('#answer').click();else $('#call').click()},function(){$('#mute').click()});
function askNote(){if(MODE=='phone'&&window.Notification&&Notification.permission=='default')try{Notification.requestPermission()}catch(e){}}
document.addEventListener('click',function n(){document.removeEventListener('click',n,true);askNote()},true);
function notify(who){try{if(window.Notification&&Notification.permission=='granted'&&(document.hidden||!document.hasFocus())){var n=new Notification(who+' is calling',{body:'Open Coffeebreak Phone 2 to answer',icon:'icon.png',tag:'cbcall',requireInteraction:true});n.onclick=function(){window.focus();n.close()}}}catch(e){}}
window.cbDebug=function(){var L=target&&links.get(target);return {cs:cs,open:!!(L&&L.open),via:L&&L.via,ntfy:sig&&sig.up.ntfy,pj:sig&&sig.up.pj,taken:taken,att:L&&L.att,me:myAddr,st:$('#st').textContent}};
})();
