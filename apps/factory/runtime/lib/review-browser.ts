import {defineState} from 'eve/context';
export interface BrowserObservation {origin:string;headSha:string;sessionId:string;snapshot:boolean;interaction:boolean;keyboard:boolean;screenshot:boolean;afterInteraction:boolean;eventIds:string[]}
export const reviewBrowser=defineState<{targets:Record<string,string>;observations:Record<string,BrowserObservation>}>('factory.review-browser',()=>({targets:{},observations:{}}));
export function browserComplete(observation:BrowserObservation|undefined,headSha:string,sessionId:string){return !!observation&&observation.headSha===headSha&&observation.sessionId===sessionId&&observation.snapshot&&observation.interaction&&observation.keyboard&&observation.screenshot&&observation.afterInteraction;}
export function browserRequirements(files:Array<{filename:string;previous_filename?:string}>){return ['jira','factory'].filter(app=>files.some(file=>[file.filename,file.previous_filename].some(path=>path?.startsWith(`apps/${app}/app/`))));}
