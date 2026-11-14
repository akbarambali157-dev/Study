import {registerSW} from 'virtual:pwa-register'
let apply:((reloadPage?:boolean)=>Promise<void>)|null=null
let registration:ServiceWorkerRegistration|undefined
let started=false
function check(){if(document.visibilityState==='visible')void registration?.update().catch(()=>undefined)}
export function registerPwaUpdates(){if(started||typeof window==='undefined')return;started=true;apply=registerSW({immediate:true,onNeedRefresh(){window.dispatchEvent(new Event('studyhub:pwa-update'))},onRegisteredSW(_url,reg){registration=reg;window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);check()}})}
export function checkForPwaUpdate(){check()}
export async function applyPwaUpdate(){await apply?.(true)}
