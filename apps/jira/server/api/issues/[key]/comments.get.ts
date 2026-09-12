// DEMO-ONLY read path: returns the synthetic in-memory comment thread for
// one issue. State resets when the server restarts or the demo is reset.
import { listComments } from "../../../utils/issue-store";

export default defineEventHandler((event) => {
  const key = getRouterParam(event, "key") ?? "";
  return { comments: listComments(key), persistence: "demo-only-in-memory" };
});
