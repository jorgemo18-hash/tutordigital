import meHandler from "./me.js";

export default async function v1Routes(app) {
  app.route({
    method: "GET",
    url: "/me",
    handler: meHandler,
  });
}
