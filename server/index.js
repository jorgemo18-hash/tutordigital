import { createApp } from "./app.js";

const port = Number(process.env.PORT || 10000);
const host = "0.0.0.0";

try {
  const app = await createApp();
  await app.listen({ port, host });
  app.log.info(`server listening on ${host}:${port}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
