import { Router } from 'express'

import * as controller from './controller.js'

/** Every path the binders answer, in one place. */
export const binderRoutes = Router()

binderRoutes.get('/', controller.listBinders)
binderRoutes.post('/', controller.createBinder)
binderRoutes.post('/:binderId/pages', controller.createPage)
