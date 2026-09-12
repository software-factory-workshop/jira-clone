import { defineSandbox } from "eve/sandbox";
import { vercel } from "eve/sandbox/vercel";
import { scope } from "./lib/github.mjs";
export default defineSandbox({backend:vercel({teamId:scope.teamId,projectId:scope.projectId,resources:{vcpus:4},timeout:600000})});
