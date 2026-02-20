import meHandler from "./me.js";
import { fail } from "../../lib/http.js";
import { makeRequestId } from "../../lib/requestId.js";
import { requireAuthPreHandler } from "../../lib/middleware.js";

export default async function v1Routes(app) {
  app.get("/me", { preHandler: [requireAuthPreHandler] }, meHandler);

  const methodNotAllowed = async (req, reply) => {
    const requestId = req.requestId || makeRequestId();
    return fail(reply, 405, "method_not_allowed", "Method not allowed", requestId);
  };

  app.post("/me", methodNotAllowed);
  app.put("/me", methodNotAllowed);
  app.patch("/me", methodNotAllowed);
  app.delete("/me", methodNotAllowed);
  app.head("/me", methodNotAllowed);
}
