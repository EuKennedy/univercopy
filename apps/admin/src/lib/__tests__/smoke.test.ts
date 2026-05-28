import { describe, it, expect } from 'vitest'

import { planAllows, PLAN_LIMITS, PLAN_FEATURES } from '@univer/shared'

describe('plan-features (shared package contract)', () => {
  it('matrix has all three plans', () => {
    expect(Object.keys(PLAN_FEATURES).sort()).toEqual(['entry', 'medium', 'ultra'])
  })

  it('entry plan does NOT unlock intelligence', () => {
    expect(planAllows('entry', 'ai_intelligence')).toBe(false)
  })

  it('ultra plan unlocks every feature in the matrix', () => {
    const ultra = PLAN_FEATURES.ultra
    expect(Object.values(ultra).every(Boolean)).toBe(true)
  })

  it('ultra has uncapped copies + connectors', () => {
    expect(PLAN_LIMITS.ultra.copies_per_workspace).toBeNull()
    expect(PLAN_LIMITS.ultra.connectors_max).toBeNull()
  })

  it('entry plan has tighter limits than medium', () => {
    expect(PLAN_LIMITS.entry.ai_generations_per_month).toBeLessThan(
      PLAN_LIMITS.medium.ai_generations_per_month ?? Infinity
    )
  })
})
