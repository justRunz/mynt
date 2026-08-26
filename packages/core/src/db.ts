import type { Database } from './database.types'

export type { Database }

type Public = Database['public']
type Tables = Public['Tables']

export type Profile = Tables['profile']['Row']
export type Country = Tables['country']['Row']
export type CoinType = Tables['coin_type']['Row']
export type Binder = Tables['binder']['Row']
export type Page = Tables['page']['Row']
export type Coin = Tables['coin']['Row']

export type BinderInsert = Tables['binder']['Insert']
export type PageInsert = Tables['page']['Insert']
export type CoinInsert = Tables['coin']['Insert']

export type DatabaseGrade = Public['Enums']['coin_grade']
