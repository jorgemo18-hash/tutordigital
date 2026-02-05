import buildApp from "./app.js";

const app = buildApp();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`server listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
