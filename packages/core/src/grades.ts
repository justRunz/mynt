import type { DatabaseGrade } from './db'

/**
 * Condition grades, worst to best.
 *
 * Grading scales are national and not translations of one another, so the code
 * is English and the French label (TB, TTB, SUP, FDC) comes from i18n.
 *
 * The order here must match the declaration order of the `coin_grade` enum in
 * the database, which is what Postgres sorts by.
 */
export const GRADES = [
  'VERY_FINE',
  'EXTREMELY_FINE',
  'ABOUT_UNCIRCULATED',
  'UNCIRCULATED',
] as const

export type Grade = (typeof GRADES)[number]

/** Rank of a grade, higher is better. Useful for "SUP and above" filters. */
export function gradeRank(grade: Grade): number {
  return GRADES.indexOf(grade)
}

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never

/**
 * Fails to compile if GRADES drifts from the database enum, which is the whole
 * point: regenerating database.types.ts after an `alter type` will break here
 * rather than silently somewhere in the UI.
 */
export const gradesMatchDatabase: Equal<Grade, DatabaseGrade> = true
