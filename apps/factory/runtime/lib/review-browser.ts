import {defineState} from 'eve/context';
import { factoryPorts } from './factory-config.ts';
export type BrowserReviewSource='base'|'head';
export type BrowserReviewApp='jira'|'factory';
export function browserOrigin(app:BrowserReviewApp,source:BrowserReviewSource){const port=source==='base'?(app==='jira'?factoryPorts.browserJiraBase:factoryPorts.browserFactoryBase):(app==='jira'?factoryPorts.jira:factoryPorts.cockpit);return `http://127.0.0.1:${port}`;}

export const MAX_REVIEW_FRAME_DATA_URL_LENGTH = 6_000_000;
export interface BrowserFrame {phase:'before'|'after';source?:BrowserReviewSource;sourceSha?:string;url:string;route:string;dataUrl:string;capturedAt:string;eventId:string}
export interface BrowserObservation {origin:string;headSha:string;sessionId:string;source?:BrowserReviewSource;snapshot:boolean;interaction:boolean;keyboard:boolean;screenshot:boolean;afterInteraction:boolean;route?:string;frames?:{before?:BrowserFrame;after?:BrowserFrame};eventIds:string[]}
export const reviewBrowser=defineState<{targets:Record<string,string>;sources?:Record<string,BrowserReviewSource>;baseWorkspaceSha?:string;observations:Record<string,BrowserObservation>}>('factory.review-browser',()=>({targets:{},sources:{},observations:{}}));
export function browserComplete(observation:BrowserObservation|undefined,headSha:string,sessionId:string){return !!observation&&observation.headSha===headSha&&observation.sessionId===sessionId&&observation.snapshot&&observation.interaction&&observation.keyboard&&observation.screenshot&&observation.afterInteraction;}
export function browserRequirements(files:Array<{filename:string;previous_filename?:string}>):BrowserReviewApp[]{const apps:BrowserReviewApp[]=['jira','factory'];return apps.filter(app=>files.some(file=>[file.filename,file.previous_filename].some(path=>path?.startsWith(`apps/${app}/app/`))));}
export function visualObservationComplete(observation:BrowserObservation|undefined,headSha:string,sessionId:string){return !!observation&&observation.headSha===headSha&&observation.sessionId===sessionId&&!!observation.frames?.before&&!!observation.frames.after&&observation.frames.before.route===observation.frames.after.route;}
export function visualComparisonComplete(before:BrowserObservation|undefined,after:BrowserObservation|undefined,baseSha:string,headSha:string,sessionId:string){const beforeFrame=before?.frames?.before;const afterFrame=after?.frames?.after;return !!beforeFrame&&!!afterFrame&&before?.headSha===baseSha&&after?.headSha===headSha&&before?.sessionId===sessionId&&after?.sessionId===sessionId&&beforeFrame.source==='base'&&afterFrame.source==='head'&&beforeFrame.sourceSha===baseSha&&afterFrame.sourceSha===headSha&&beforeFrame.route===afterFrame.route;}
