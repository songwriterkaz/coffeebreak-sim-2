/* Coffeebreak engine 2. © Karen O'Brien (Coffeebreak). All rights reserved. */
(function(){
var CB=window.CB={};var q=CB.q=new URLSearchParams(location.search);
CB.BASE=location.origin+location.pathname;CB.T0=performance.now();CB.track=null;
CB.rnd=function(n){var a='abcdefghijkmnpqrstuvwxyz23456789',s='',r=crypto.getRandomValues(new Uint8Array(n));for(var i=0;i<n;i++)s+=a[r[i]%a.length];return s};
function isTurn(s){return /turns?:/.test([].concat(s.urls).join(' '))}
var TURN=([{"urls":"stun:stun.relay.metered.ca:80"},{"urls":"turn:global.relay.metered.ca:80","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turn:global.relay.metered.ca:80?transport=tcp","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turn:global.relay.metered.ca:443","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"},{"urls":"turns:global.relay.metered.ca:443?transport=tcp","username":"fbcff5d24c6b2dc747ebf467","credential":"Q25Ljae87jPAQ0Bo"}]).filter(isTurn),turn=TURN;
var STUN=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}];
try{var c=JSON.parse(localStorage.getItem('cb2_turn')||'null');if(c&&c.length)turn=c}catch(e){}
fetch('https://songwriterkaz.github.io/coffeebreak-ice/ice.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(j&&j.iceServers){var t=j.iceServers.filter(isTurn);if(t.length){turn=t;localStorage.setItem('cb2_turn',JSON.stringify(t))}}}).catch(function(){});
CB.cfg=function(relay){relay=relay||q.get('t')=='relay';var t=turn.length?turn:TURN;return relay?{iceServers:t,iceTransportPolicy:'relay',bundlePolicy:'max-bundle'}:{iceServers:STUN.concat(t),bundlePolicy:'max-bundle'}};
CB.munge=function(sdp){var m=sdp.match(/a=rtpmap:(\d+) opus\/48000/i);if(!m)return sdp;var pt=m[1];return sdp.replace(new RegExp('a=fmtp:'+pt+' ([^\\r\\n]*)'),function(l,p){return /maxaveragebitrate/.test(p)?l:'a=fmtp:'+pt+' '+p+';maxaveragebitrate=64000;usedtx=0'})};
/* ---- signalling: ntfy.sh and the PeerJS server run side by side, first one wins ---- */
CB.Sig=function(P,id,on){this.P=P;this.id=id;this.on=on;this.seen=new Set();this.tab=CB.rnd(6);this.up={ntfy:false,pj:false};this.stopped=true};
var S=CB.Sig.prototype;
S.topic=function(id){return this.P+'s-'+id};
S.start=function(){this.stopped=false;this.start0=Date.now();this.taken=false;this.openES();this.openWS()};
S.stop=function(){this.stopped=true;try{this.es&&this.es.close()}catch(e){}this.es=null;var w=this.ws;this.ws=null;try{w&&w.close()}catch(e){}clearInterval(this.hb);clearTimeout(this.wst);this.up={ntfy:false,pj:false}};
S.isUp=function(){return this.up.ntfy||this.up.pj};
S.openES=function(){var s=this;if(s.stopped)return;try{s.es&&s.es.close()}catch(e){}
 var es=new EventSource('https://ntfy.sh/'+s.topic(s.id)+'/sse?since=15s');s.es=es;s.esAt=Date.now();
 es.onopen=function(){if(s.es!=es)return;s.up.ntfy=true;s.onup&&s.onup('ntfy')};
 es.onmessage=function(e){try{unzip(JSON.parse(JSON.parse(e.data).message)).then(function(m){s.got(m)}).catch(function(){})}catch(x){}};
 es.onerror=function(){if(s.es!=es)return;s.up.ntfy=false;if(es.readyState==2)setTimeout(function(){if(s.es==es)s.openES()},2000)}};
S.openWS=function(){var s=this;if(s.stopped||q.get('t')=='nopj')return;var o=s.ws;s.ws=null;try{o&&o.close()}catch(e){}
 var ws;try{ws=new WebSocket('wss://0.peerjs.com/peerjs?key=peerjs&id='+s.P+s.id+'&token='+CB.rnd(10)+'&version=1.5.4')}catch(e){return s.retryWS()}
 s.ws=ws;
 ws.onmessage=function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}
  if(m.type=='OPEN'){s.up.pj=true;s.wsTry=0;s.taken=false;s.onup&&s.onup('pj')}
  else if(m.type=='ID-TAKEN'){s.taken=true}
  else if(m.payload&&m.payload.cb)s.got(m.payload.cb)};
 ws.onclose=function(){if(s.ws!=ws)return;s.up.pj=false;s.ws=null;s.retryWS()};ws.onerror=function(){};
 clearInterval(s.hb);s.hb=setInterval(function(){if(s.ws&&s.ws.readyState==1)s.ws.send('{"type":"HEARTBEAT"}')},5000)};
S.retryWS=function(){var s=this;if(s.stopped)return;clearTimeout(s.wst);s.wsTry=(s.wsTry||0)+1;s.wst=setTimeout(function(){s.openWS()},s.taken?900:Math.min(800*s.wsTry,6000))};
S.revive=function(force){if(this.stopped)return;if(force||!this.es||this.es.readyState==2)this.openES();if(!this.ws||this.ws.readyState>1)this.openWS()};
function zip(s){if(s.length<3000||!window.CompressionStream)return Promise.resolve(s);var cs=new Blob([s]).stream().pipeThrough(new CompressionStream('deflate-raw'));return new Response(cs).arrayBuffer().then(function(b){var u=new Uint8Array(b),x='';for(var i=0;i<u.length;i++)x+=String.fromCharCode(u[i]);return JSON.stringify({z:btoa(x)})}).catch(function(){return s})}
function unzip(m){if(!m||!m.z)return Promise.resolve(m);var b=Uint8Array.from(atob(m.z),function(c){return c.charCodeAt(0)});return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(JSON.parse)}
S.send=function(to,m,topic){m.mid=CB.rnd(8);m.f=this.id;m.tab=this.tab;m.t=Date.now();var b=JSON.stringify(m),url='https://ntfy.sh/'+(topic||this.topic(to));
 zip(b).then(function(z){return fetch(url,{method:'POST',body:z})}).catch(function(){});
 if(!topic&&this.ws&&this.ws.readyState==1&&this.up.pj)try{this.ws.send(JSON.stringify({type:'OFFER',dst:this.P+to,payload:{cb:m}}))}catch(e){}};
S.got=function(m){if(!m||!m.mid||this.seen.has(m.mid))return;this.seen.add(m.mid);if(m.f==this.id&&m.tab==this.tab)return;if(m.k=='offer'&&Date.now()-m.t>15000)return;this.on(m)};
/* ---- one link to one other phone: a single WebRTC line with audio and a data channel ---- */
CB.Link=function(sig,remote,opt){this.sig=sig;this.r=remote;this.opt=opt||{};this.off=sig.id<remote;this.open=false;this.want=false;this.att=0;this.lastTry=0;this.q={};this.since=Date.now()};
var L=CB.Link.prototype;
L.close=function(){var pc=this.pc,was=this.open;this.pc=null;this.dc=null;this.tr=null;this.open=false;if(pc)try{pc.close()}catch(e){}if(was&&this.opt.onclose)this.opt.onclose(this)};
L.newPc=function(sid,relay){var k=this;k.close();var pc=new RTCPeerConnection(CB.cfg(relay));k.pc=pc;k.sid=sid;k.relay=!!relay;k.via='';
 var dc=pc.createDataChannel('cb',{negotiated:true,id:0});k.dc=dc;
 dc.onopen=function(){if(k.pc!=pc)return;k.open=true;k.att=0;k.tOpen=performance.now();k.tx({k:'hi',tab:k.sig.tab,name:CB.myName||''});k.bitrate();k.opt.onopen&&k.opt.onopen(k)};
 dc.onclose=function(){if(k.pc!=pc)return;if(k.open){k.open=false;k.opt.onclose&&k.opt.onclose(k)}};
 dc.onmessage=function(e){var m;try{m=JSON.parse(e.data)}catch(x){return}if(m.k=='hi'){k.rtab=m.tab;k.rname=m.name}k.opt.onmsg&&k.opt.onmsg(k,m)};
 pc.onicecandidate=function(e){if(k.pc!=pc||!e.candidate)return;(k.cq=k.cq||[]).push(e.candidate.toJSON());if(!k.ct)k.ct=setTimeout(function(){k.ct=null;var c=k.cq;k.cq=[];if(c.length&&k.pc==pc)k.sig.send(k.r,{k:'ice',sid:sid,c:c})},150)};
 pc.ontrack=function(e){if(k.pc!=pc)return;k.stream=(e.streams&&e.streams[0])||new MediaStream([e.track]);k.opt.ontrack&&k.opt.ontrack(k)};
 pc.onconnectionstatechange=function(){if(k.pc!=pc)return;var s=pc.connectionState;
  if(s=='connected'){clearTimeout(k.ft);k.route()}else if(s=='failed')k.fix();
  else if(s=='disconnected'){clearTimeout(k.ft);k.ft=setTimeout(function(){if(k.pc==pc&&pc.connectionState!='connected')k.fix()},2500)}};
 return pc};
L.start=function(relay){var k=this,sid=CB.rnd(6),pc=k.newPc(sid,relay);k.att++;k.lastTry=Date.now();
 var tr=pc.addTransceiver('audio',{direction:'sendrecv'});k.tr=tr;if(CB.track)tr.sender.replaceTrack(CB.track).catch(function(){});
 pc.createOffer().then(function(o){return pc.setLocalDescription({type:'offer',sdp:CB.munge(o.sdp)})}).then(function(){if(k.pc==pc)k.sig.send(k.r,{k:'offer',sid:sid,sdp:pc.localDescription.sdp,rl:!!relay})}).catch(function(){})};
L.fix=function(){var k=this,pc=k.pc;if(!pc)return;if(!k.off){k.sig.send(k.r,{k:'kick'});return}
 if(k.rs&&Date.now()-k.rs<6000){k.start(true);return}k.rs=Date.now();
 pc.createOffer({iceRestart:true}).then(function(o){return pc.setLocalDescription({type:'offer',sdp:CB.munge(o.sdp)})}).then(function(){if(k.pc==pc)k.sig.send(k.r,{k:'offer',sid:k.sid,sdp:pc.localDescription.sdp})}).catch(function(){k.start()})};
L.onOffer=function(m){var k=this,pc;if(k.pc&&k.sid==m.sid&&k.pc.signalingState=='stable')pc=k.pc;else pc=k.newPc(m.sid,m.rl);k.lastTry=Date.now();
 pc.setRemoteDescription({type:'offer',sdp:m.sdp}).then(function(){if(!k.tr)k.tr=pc.getTransceivers().filter(function(t){return t.receiver.track&&t.receiver.track.kind=='audio'})[0];
  if(k.tr){k.tr.direction='sendrecv';if(CB.track)k.tr.sender.replaceTrack(CB.track).catch(function(){})}k.flush(m.sid);return pc.createAnswer()})
 .then(function(a){return pc.setLocalDescription({type:'answer',sdp:CB.munge(a.sdp)})}).then(function(){if(k.pc==pc)k.sig.send(k.r,{k:'answer',sid:m.sid,sdp:pc.localDescription.sdp})}).catch(function(){})};
L.onAnswer=function(m){var k=this,pc=k.pc;if(!pc||k.sid!=m.sid||pc.signalingState!='have-local-offer')return;pc.setRemoteDescription({type:'answer',sdp:m.sdp}).then(function(){k.flush(m.sid)}).catch(function(){})};
L.onIce=function(m){var k=this;if(k.pc&&k.sid==m.sid&&k.pc.remoteDescription){m.c.forEach(function(c){k.pc.addIceCandidate(c).catch(function(){})})}else{var a=k.q[m.sid]=k.q[m.sid]||[];a.push.apply(a,m.c)}};
L.flush=function(sid){var k=this,c=k.q[sid]||[];k.q={};c.forEach(function(x){k.pc.addIceCandidate(x).catch(function(){})})};
L.onMsg=function(m){var k=this;if(m.k=='offer')k.onOffer(m);else if(m.k=='answer')k.onAnswer(m);else if(m.k=='ice')k.onIce(m);else if(m.k=='kick'){if(k.off)k.fix()}
 else if(m.k=='hello'){k.want=true;if(!k.off){k.sig.send(k.r,{k:'hello'});return}if(k.open&&m.tab==k.rtab)return;if(!k.pc||k.open||Date.now()-k.lastTry>1500)k.start()}};
L.tick=function(){var k=this;if(!k.want||k.open)return;var age=Date.now()-k.lastTry;
 if(k.off){if(k.pc&&k.pc.connectionState=='connecting'&&age<9000)return;if(!k.pc||age>(k.att<2?3500:5000))k.start(k.att>=2&&k.att%2==0)}
 else if(age>3000){k.lastTry=Date.now();k.att++;k.sig.send(k.r,{k:'hello'})}};
L.reset=function(){this.close();this.att=0;this.lastTry=0;this.since=Date.now();this.tick()};
L.tx=function(m){try{this.dc&&this.dc.readyState=='open'&&this.dc.send(JSON.stringify(m))}catch(e){}};
L.setTrack=function(t){if(this.tr)this.tr.sender.replaceTrack(t).catch(function(){})};
L.bitrate=function(){try{var s=this.tr&&this.tr.sender;if(!s)return;var p=s.getParameters();if(!p.encodings||!p.encodings.length)p.encodings=[{}];p.encodings[0].maxBitrate=64000;s.setParameters(p).catch(function(){})}catch(e){}};
L.route=function(){var k=this,pc=k.pc;if(!pc)return;pc.getStats().then(function(st){var pair,loc={};st.forEach(function(r){if(r.type=='transport'&&r.selectedCandidatePairId)pair=st.get(r.selectedCandidatePairId);if(r.type=='local-candidate')loc[r.id]=r});
 if(pair&&loc[pair.localCandidateId]){k.via=loc[pair.localCandidateId].candidateType=='relay'?'relay':'direct';k.opt.onroute&&k.opt.onroute(k)}}).catch(function(){})};

/* ---- laptop: device picker, keyboard ---- */
CB.micC=function(){var c={echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},id=localStorage.getItem('cb2_mic');if(id)c.deviceId={ideal:id};return c};
CB.sinks=[];CB.setSink=function(el){var id=localStorage.getItem('cb2_spk');if(id&&el.setSinkId)el.setSinkId(id).catch(function(){})};
CB.fillDev=function(onMic){var md=navigator.mediaDevices;if(!md||!md.enumerateDevices)return;md.enumerateDevices().then(function(ds){var ms=document.querySelector('#micsel'),ss=document.querySelector('#spksel');
 function put(sel,kind,key,lab){sel.innerHTML='';ds.filter(function(d){return d.kind==kind}).forEach(function(d,i){var o=document.createElement('option');o.value=d.deviceId;o.textContent=d.label||(lab+' '+(i+1));sel.appendChild(o)});var v=localStorage.getItem(key);if(v)sel.value=v}
 put(ms,'audioinput','cb2_mic','Microphone');var canSink='setSinkId' in HTMLMediaElement.prototype;ss.classList.toggle('hide',!canSink);document.querySelector('#spkl').classList.toggle('hide',!canSink);if(canSink)put(ss,'audiooutput','cb2_spk','Speakers');
 ms.onchange=function(){localStorage.setItem('cb2_mic',ms.value);var old=CB.track;CB.track=null;onMic(old)};
 ss.onchange=function(){localStorage.setItem('cb2_spk',ss.value);document.querySelectorAll('audio').forEach(CB.setSink)}}).catch(function(){})};
CB.hasCam=function(f){var md=navigator.mediaDevices;if(!md||!md.enumerateDevices)return f(true);md.enumerateDevices().then(function(ds){f(ds.some(function(d){return d.kind=='videoinput'}))}).catch(function(){f(true)})};
CB.keys=function(sp,m){document.addEventListener('keydown',function(e){var t=e.target&&e.target.tagName;if(t=='INPUT'||t=='SELECT'||t=='TEXTAREA'||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code=='Space'){e.preventDefault();sp()}else if(e.key=='m'||e.key=='M')m()})};
/* ---- screen awake, updates, offline cache ---- */
CB.awake=function(){if('wakeLock' in navigator&&!document.hidden)navigator.wakeLock.request('screen').then(function(w){CB.wake=w}).catch(function(){})};
CB.checkVersion=function(){fetch('version.json?'+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(j){if(!j||!j.v||j.v==CB.V)return;var k='cb2_up_'+j.v;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');CB.onUpdate&&CB.onUpdate(j.v);
 var go=function(){location.reload()};if(navigator.serviceWorker&&navigator.serviceWorker.getRegistration)navigator.serviceWorker.getRegistration().then(function(r){return r&&r.update()}).then(go,go);else go()}).catch(function(){})};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(){});
})();
