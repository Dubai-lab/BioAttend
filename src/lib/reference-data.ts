import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Department, JobTitle, JobCategory, Shift } from '@/types/database'

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  medical: 'Medical',
  nursing: 'Nursing',
  allied_health: 'Allied Health',
  support: 'Support',
  admin: 'Administration',
}

interface ReferenceData {
  departments: Department[]
  jobTitles: JobTitle[]
  shifts: Shift[]
  loading: boolean
  error: string | null
}

/**
 * Departments and job titles.
 *
 * Reference data that changes maybe twice a year, so it is fetched once per
 * mount rather than subscribed to.
 */
export function useReferenceData(): ReferenceData {
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const [deptResult, titleResult, shiftResult] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('job_titles').select('*').order('title'),
        supabase.from('shifts').select('*').order('starts_at'),
      ])

      if (!active) return

      const failure = deptResult.error ?? titleResult.error ?? shiftResult.error
      if (failure) {
        setError(failure.message)
      } else {
        setDepartments(deptResult.data ?? [])
        setJobTitles(titleResult.data ?? [])
        setShifts(shiftResult.data ?? [])
      }
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  return { departments, jobTitles, shifts, loading, error }
}

/** Group job titles by category so the picker is navigable. */
export function groupByCategory(titles: JobTitle[]): [JobCategory, JobTitle[]][] {
  const order: JobCategory[] = ['medical', 'nursing', 'allied_health', 'support', 'admin']
  return order
    .map((category): [JobCategory, JobTitle[]] => [
      category,
      titles.filter((title) => title.category === category),
    ])
    .filter(([, items]) => items.length > 0)
}

/**
 * Next staff number, e.g. NGH-1182.
 *
 * Derived from the highest existing number rather than a count, so deleting a
 * staff member never causes a collision.
 */
export async function nextStaffNumber(prefix = 'NGH'): Promise<string> {
  const { data } = await supabase
    .from('staff')
    .select('staff_no')
    .like('staff_no', `${prefix}-%`)
    .order('staff_no', { ascending: false })
    .limit(1)

  const latest = data?.[0]?.staff_no
  const current = latest ? Number.parseInt(latest.split('-')[1] ?? '1000', 10) : 1000
  return `${prefix}-${Number.isNaN(current) ? 1001 : current + 1}`
}
