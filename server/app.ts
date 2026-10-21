import express from "express";

export function createApp() {
  const app = express();

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({
      code: "NOT_FOUND",
      message: "Cette route n'est pas disponible.",
    });
  });

  return app;
}
