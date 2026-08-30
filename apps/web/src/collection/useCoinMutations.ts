import { useMutation } from '@tanstack/react-query'

import { mutationKeys, type UpdateCoinVariables } from '../app/mutations'

export function useUpdateCoin() {
  return useMutation<void, Error, UpdateCoinVariables>({ mutationKey: mutationKeys.updateCoin })
}

export function useDeleteCoin() {
  return useMutation<void, Error, string>({ mutationKey: mutationKeys.deleteCoin })
}
