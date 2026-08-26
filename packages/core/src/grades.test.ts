import { describe, expect, it } from 'vitest'

import { GRADES, gradeRank } from './grades'

describe('grade ordering', () => {
  it('runs worst to best, matching the database enum', () => {
    expect(gradeRank('VERY_FINE')).toBeLessThan(gradeRank('EXTREMELY_FINE'))
    expect(gradeRank('EXTREMELY_FINE')).toBeLessThan(gradeRank('ABOUT_UNCIRCULATED'))
    expect(gradeRank('ABOUT_UNCIRCULATED')).toBeLessThan(gradeRank('UNCIRCULATED'))
  })

  it('does not sort correctly by string comparison, which is why rank exists', () => {
    const alphabetical = [...GRADES].sort()
    expect(alphabetical).not.toEqual([...GRADES])
  })
})
