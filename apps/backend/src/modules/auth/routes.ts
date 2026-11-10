import { Router } from "express";

import {
    mailLimit,
    perIpLimit,
    signInLimit,
} from "../../middleware/rate-limit.js";
import * as controller from "./controller.js";

/**
 * Every path to do with a session, in one place.
 *
 * Mounted above the authenticate middleware rather than under it, which is the
 * one exception in this server and has to be: these are the routes somebody
 * reaches while holding nothing. Every other module is below the middleware
 * precisely so a new route cannot forget it.
 *
 * Every route that takes a credential or sends mail is limited; refresh and
 * sign-out are not. Their token is 32 random bytes, which no amount of
 * guessing reaches, and limiting them would only ever throttle someone who
 * reloads a lot.
 */
export const authRoutes = Router();

authRoutes.post("/sign-up", perIpLimit, mailLimit, controller.signUp);
authRoutes.post("/sign-in", perIpLimit, signInLimit, controller.signIn);
authRoutes.post("/verify-email", perIpLimit, controller.verifyEmail);
authRoutes.post(
    "/forgot-password",
    perIpLimit,
    mailLimit,
    controller.forgotPassword,
);
authRoutes.post("/reset-password", perIpLimit, controller.resetPassword);
authRoutes.post("/refresh", controller.refresh);
authRoutes.post("/sign-out", controller.signOut);
