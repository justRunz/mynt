import { Router } from "express";

import { importLimit } from "../../middleware/rate-limit.js";
import * as controller from "./controller.js";

export const importRoutes = Router();

importRoutes.post("/analyze", importLimit, controller.analyze);
