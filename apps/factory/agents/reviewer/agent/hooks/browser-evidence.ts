import {defineHook} from 'eve/hooks';
import {toolResultFrom} from 'eve/tools';
import {snapshot,click,fill,select_option,set_checked,press_key,screenshot,navigate,tabs,close} from '@agent-browser/eve/tools';
import {defineState} from 'eve/context';
import {reviewBrowser} from '../../../../runtime/lib/review-browser';
const active=defineState<string|null>('factory.review-browser-origin',()=>null);
export default defineHook({events:{'action.result'(event,ctx){
 const result=event.data.result;
 if(toolResultFrom(result,navigate)||toolResultFrom(result,tabs)||toolResultFrom(result,close))active.update(()=>null);
 const tree=toolResultFrom(result,snapshot);
 if(tree){
  let origin:string;try{origin=new URL(tree.output.origin).origin;}catch{return;}
  const headSha=reviewBrowser.get().targets[origin];if(!headSha||!tree.output.snapshot.trim())return;
  active.update(()=>origin);reviewBrowser.update(s=>{const prior=s.observations[origin];return{...s,observations:{...s.observations,[origin]:{origin,headSha,sessionId:ctx.session.id,snapshot:true,interaction:prior?.interaction||false,keyboard:prior?.keyboard||false,screenshot:prior?.screenshot||false,afterInteraction:!!prior?.interaction&&!!prior?.keyboard,eventIds:[...(prior?.eventIds||[]),event.meta.id].slice(-50)}}};});return;
 }
 const origin=active.get();if(!origin)return;
 const interaction=!!(toolResultFrom(result,click)||toolResultFrom(result,fill)||toolResultFrom(result,select_option)||toolResultFrom(result,set_checked));
 const keyboard=!!toolResultFrom(result,press_key);const image=toolResultFrom(result,screenshot);
 const captured=!!image&&typeof image.output.imageDataUrl==='string'&&image.output.imageDataUrl.startsWith('data:image/');
 if(!interaction&&!keyboard&&!captured)return;
 reviewBrowser.update(s=>{const prior=s.observations[origin];if(!prior)return s;return{...s,observations:{...s.observations,[origin]:{...prior,interaction:prior.interaction||interaction,keyboard:prior.keyboard||keyboard,screenshot:prior.screenshot||captured,afterInteraction:interaction||keyboard?false:prior.afterInteraction,eventIds:[...prior.eventIds,event.meta.id].slice(-50)}}};});
}}});
