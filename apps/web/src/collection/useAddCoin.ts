import { useMutation } from '@tanstack/react-query'

import { mutationKeys, type AddCoinVariables } from '../app/mutations'

export type { AddCoinVariables }

/**
 * The mutation itself lives in app/mutations.ts, registered against this key.
 * Only the key is referenced here so that a mutation queued offline can be
 * looked back up and replayed after a reload.
 */
export function useAddCoin() {
  return useMutation<void, Error, AddCoinVariables>({ mutationKey: mutationKeys.addCoin })
}
