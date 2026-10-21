import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT doit être un entier compris entre 1 et 65535.");
}

const clientDirectory = fileURLToPath(new URL("../client", import.meta.url));
const app = createApp();

// The compiled server and built client live next to each other in dist/.
// Static delivery is enabled only for npm start, not by the Vite development server.
if (import.meta.url.endsWith(".js")) {
  const { default: express } = await import("express");
  app.use(express.static(clientDirectory));
}

app.listen(port, host, () => {
  console.log(`LouveInvest : http://${host}:${port}`);
});
