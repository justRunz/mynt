import { Router } from 'express'

import * as controller from './controller.js'

/**
 * Every path the collection answers, in one place.
 *
 * Location is a sub-resource of a coin -- put and removed on its own -- because
 * filing is a different act from editing, with different failures. The exchange
 * of two coins is not under /:coinId at all: it belongs to neither of them.
 */
export const collectionRoutes = Router()

collectionRoutes.get('/', controller.listCoins)
collectionRoutes.get('/type-counts', controller.countOwnedByType)
collectionRoutes.post('/', controller.addCoin)
collectionRoutes.patch('/:coinId', controller.updateCoin)
collectionRoutes.delete('/:coinId', controller.deleteCoin)
collectionRoutes.put('/:coinId/location', controller.fileCoin)
collectionRoutes.delete('/:coinId/location', controller.unfileCoin)
collectionRoutes.post('/move-pair', controller.movePair)
