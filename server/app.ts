import express from "express";
import { fetchPrimopierre, PrimopierreError } from "./primopierre.js";

export function createApp() {
  const app = express();

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/scpi/primopierre", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      response.json(await fetchPrimopierre());
    } catch (error) {
      if (error instanceof PrimopierreError) {
        response.status(error.code === "SOURCE_TIMEOUT" ? 504 : 502)
          .json({ code: error.code, message: error.message });
      } else {
        response.status(500).json({ code: "INTERNAL_ERROR", message: "Les données ne peuvent pas être chargées." });
      }
    }
  });

  app.use("/api", (_request, response) => {
    response.status(404).json({
      code: "NOT_FOUND",
      message: "Cette route n'est pas disponible.",
    });
  });

  return app;
}
