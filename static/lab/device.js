/* Shared by the Lab gate and all five game runtimes; reuses existing Fate keys. */
(()=>{'use strict';
 const API='/lab/api';const KEY='fate-device-v1',STORE='keys';
 function req(path,data){return fetch(API+path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(data||{}),cache:'no-store'})}
 function db(){return new Promise((ok,fail)=>{let r=indexedDB.open(KEY,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
 async function read(key){const d=await db();return new Promise((ok,fail)=>{const tx=d.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
 async function write(key,value){const d=await db();return new Promise((ok,fail)=>{const tx=d.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=ok;tx.onerror=()=>fail(tx.error)})}
 async function keypair(){let privateKey=await read('privateKey'),publicJwk=await read('publicJwk');if(privateKey&&publicJwk)return {privateKey,publicJwk};const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);publicJwk=await crypto.subtle.exportKey('jwk',pair.publicKey);privateKey=await crypto.subtle.importKey('jwk',await crypto.subtle.exportKey('jwk',pair.privateKey),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);await write('privateKey',privateKey);await write('publicJwk',publicJwk);return {privateKey,publicJwk}}
 function installId(){let x=localStorage.getItem('fate_install_id');if(!x){x=crypto.randomUUID();localStorage.setItem('fate_install_id',x)}return x}
 function b64(b){let str='';for(let x of new Uint8Array(b))str+=String.fromCharCode(x);return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')}
 async function proof(){let id=localStorage.getItem('fate_device_id'),pk=await read('privateKey');if(!id||!pk)return null;const r=await req('/auth/challenge',{device_id:id,purpose:'status'});if(!r.ok)return null;const c=await r.json();return {device_id:id,challenge_id:c.challenge_id,signature:b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pk,new TextEncoder().encode(c.challenge)))}}
 async function session(){let p=await proof();if(!p)return null;let r=await req('/lab/session',p);if(!r.ok)return null;return await r.json()}
 async function activate(key){const pair=await keypair();const r=await req('/activate',{license_key:key,install_id:installId(),public_jwk:pair.publicJwk});const d=await r.json();if(r.ok)localStorage.setItem('fate_device_id',d.device_id);return {ok:r.ok,...d}}
 async function delivery(token){const r=await req('/delivery',{token});return {ok:r.ok,...await r.json()}}
 window.LabAuth=Object.freeze({session,activate,delivery,req});
})();
