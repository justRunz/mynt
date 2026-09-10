import { Router } from 'express'

import * as controller from './controller.js'

/**
 * Every path the catalog answers, in one place.
 *
 * Reading this file is how to learn what a module exposes. Nothing here decides
 * anything -- no validation, no status code -- it only says which handler a
 * method and a path lead to.
 */
export const catalogRoutes = Router()

catalogRoutes.get('/countries', controller.listCountries)
catalogRoutes.get('/coin-types', controller.listCoinTypes)
