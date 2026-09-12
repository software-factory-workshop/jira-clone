import { defineDynamic } from "eve";
import { stationOf } from "../lib/station-access";
import tool from "eve/tools/glob";

export default defineDynamic({events:{"session.started":(_,ctx)=>stationOf(ctx) ? null : tool}});
