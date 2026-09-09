/**
 * Condition grades, worst to best.
 *
 * Grading scales are national and not translations of one another, so the code
 * is English and the French label (TB, TTB, SUP, FDC) comes from i18n.
 *
 * This list must match the grades table, which is where the codes actually
 * exist. There is no type that can say so any more -- they used to be an enum,
 * and an enum has a type; rows do not -- so the backend asserts it against the
 * real table instead. Losing the compile-time check for a check that reads the
 * database is not obviously a loss.
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
