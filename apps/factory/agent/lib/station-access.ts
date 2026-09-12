import { z } from "zod";
export const workerRequest = z.object({operationId:z.string().uuid(),title:z.string().trim().min(1).max(160),brief:z.string().trim().min(20).max(18000)}).strict();
export const reviewerRequest = z.object({operationId:z.string().uuid(),prNumber:z.number().int().positive()}).strict();
export type Station = "worker" | "reviewer";
type SessionContext = {session:{auth:{initiator?:{attributes:Readonly<Record<string,unknown>>}|null}}};
export function stationOf(ctx:SessionContext):Station|null {
 const value=ctx.session.auth.initiator?.attributes.factoryStation;
 return value === "worker" || value === "reviewer" ? value : null;
}
export function requireStation(ctx:SessionContext,expected:Station) {
 if(stationOf(ctx)!==expected) throw new Error(`This capability requires an authenticated ${expected} station session.`);
}
export function stationRequest(ctx:SessionContext) {
 const raw=ctx.session.auth.initiator?.attributes.factoryRequest;
 if(typeof raw!=="string") throw new Error("Missing trusted station request.");
 return stationOf(ctx)==="worker" ? workerRequest.parse(JSON.parse(raw)) : reviewerRequest.parse(JSON.parse(raw));
}
