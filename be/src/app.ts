import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./config/env";
import { authRouter } from "./routes/auth";
import { licenseRouter } from "./routes/license";
import { adminLicensesRouter } from "./routes/adminLicenses";
import { adminDashboardRouter } from "./routes/adminDashboard";
import { adminUsersRouter } from "./routes/adminUsers";
import { privacyRouter } from "./routes/privacy";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(helmet());
  app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "license-admin-api" });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "license-admin-api" });
  });

  app.use("/", privacyRouter);
  app.use("/api/auth", authRouter);
  app.use(
    "/api/license",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    licenseRouter,
  );
  app.use(
    "/api/admin/licenses",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    adminLicensesRouter,
  );
  app.use(
    "/api/admin/dashboard",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 60,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    adminDashboardRouter,
  );
  app.use(
    "/api/admin/users",
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    adminUsersRouter,
  );

  app.use((req, res) => {
    res
      .status(404)
      .json({
        success: false,
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.path} not found`,
      });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[ERROR]", err);
    res
      .status(500)
      .json({
        success: false,
        code: "INTERNAL_ERROR",
        message: err.message || "Internal server error.",
      });
  });

  return app;
};
