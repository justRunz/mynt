import { Router } from 'express'

import * as controller from './controller.js'

/**
 * Every path to do with a session, in one place.
 *
 * Mounted above the authenticate middleware rather than under it, which is the
 * one exception in this server and has to be: these are the routes somebody
 * reaches while holding nothing. Every other module is below the middleware
 * precisely so a new route cannot forget it.
 */
export const authRoutes = Router()

authRoutes.post('/sign-up', controller.signUp)
authRoutes.post('/sign-in', controller.signIn)
authRoutes.post('/verify-email', controller.verifyEmail)
authRoutes.post('/forgot-password', controller.forgotPassword)
authRoutes.post('/reset-password', controller.resetPassword)
authRoutes.post('/refresh', controller.refresh)
authRoutes.post('/sign-out', controller.signOut)
