import {defineHook} from 'eve/hooks';
import {toolResultFrom} from 'eve/tools';
import {snapshot,click,fill,select_option,set_checked,press_key,screenshot,navigate,tabs,close} from '@agent-browser/eve/tools';
import {defineState} from 'eve/context';
import {MAX_REVIEW_FRAME_DATA_URL_LENGTH,reviewBrowser,type BrowserReviewSource} from '../../../../runtime/lib/review-browser';
const active=defineState<string|null>('factory.review-browser-origin',()=>null);
function pageRoute(url:string){const parsed=new URL(url);return `${parsed.pathname}${parsed.search}${parsed.hash}`||'/';}
function sourceFor(origin:string):BrowserReviewSource{return reviewBrowser.get().sources?.[origin]||'head';}
export default defineHook({events:{'action.result'(event,ctx){
 const result=event.data.result;
 if(toolResultFrom(result,navigate)||toolResultFrom(result,tabs)||toolResultFrom(result,close))active.update(()=>null);
 const tree=toolResultFrom(result,snapshot);
 if(tree){
  let pageUrl:string;let origin:string;let route:string;try{pageUrl=tree.output.origin;origin=new URL(pageUrl).origin;route=pageRoute(pageUrl);}catch{return;}
  const headSha=reviewBrowser.get().targets[origin];if(!headSha||!tree.output.snapshot.trim())return;
  const source=sourceFor(origin);active.update(()=>origin);reviewBrowser.update(s=>{const prior=s.observations[origin];const retained=prior?.sessionId===ctx.session.id&&prior.source===source&&prior.route===route?prior:undefined;return{...s,observations:{...s.observations,[origin]:{origin,headSha,sessionId:ctx.session.id,source,snapshot:true,interaction:retained?.interaction||false,keyboard:retained?.keyboard||false,screenshot:retained?.screenshot||false,afterInteraction:!!retained?.interaction&&!!retained?.keyboard,route,frames:retained?.frames,eventIds:[...(retained?.eventIds||[]),event.meta.id].slice(-50)}}};});return;
 }
 const origin=active.get();if(!origin)return;
 const interaction=!!(toolResultFrom(result,click)||toolResultFrom(result,fill)||toolResultFrom(result,select_option)||toolResultFrom(result,set_checked));
 const keyboard=!!toolResultFrom(result,press_key);const image=toolResultFrom(result,screenshot);
 const dataUrl=image&&typeof image.output.imageDataUrl==='string'?image.output.imageDataUrl:'';
 const captured=dataUrl.startsWith('data:image/')&&dataUrl.length<=MAX_REVIEW_FRAME_DATA_URL_LENGTH;
 if(!interaction&&!keyboard&&!captured)return;
 reviewBrowser.update(s=>{const prior=s.observations[origin];if(!prior)return s;const phase=prior.source==='base'?'before':'after';const frame=captured?{phase,source:prior.source,sourceSha:prior.headSha,url:prior.origin+(prior.route||'/'),route:prior.route||'/',dataUrl,capturedAt:new Date().toISOString(),eventId:event.meta.id}:undefined;return{...s,observations:{...s.observations,[origin]:{...prior,interaction:prior.interaction||interaction,keyboard:prior.keyboard||keyboard,screenshot:prior.screenshot||captured,afterInteraction:interaction||keyboard?false:prior.afterInteraction,frames:frame?{...prior.frames,[phase]:frame}:prior.frames,eventIds:[...prior.eventIds,event.meta.id].slice(-50)}}};});
}}});
