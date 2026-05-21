import { supabase } from './supabase'
import type {
  AvailabilityStatus,
  Course,
  Driver,
  DriverAvailability,
  Month,
  MonthStatus,
  ShiftAssignment,
} from './types'

/* ============================== drivers ============================== */

export async function listDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createDriver(name: string, sort_order = 999): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .insert({ name: name.trim(), sort_order })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDriver(id: string, patch: Partial<Driver>): Promise<void> {
  const { error } = await supabase.from('drivers').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDriver(id: string): Promise<void> {
  const { error } = await supabase.from('drivers').delete().eq('id', id)
  if (error) throw error
}

/* ============================== courses ============================== */

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createCourse(name: string, sort_order = 999): Promise<Course> {
  const { data, error } = await supabase
    .from('courses')
    .insert({ name: name.trim(), sort_order })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCourse(id: string, patch: Partial<Course>): Promise<void> {
  const { error } = await supabase.from('courses').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

/* ============================== months ============================== */

export async function listMonths(): Promise<Month[]> {
  const { data, error } = await supabase
    .from('months')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getOrCreateMonth(year: number, month: number): Promise<Month> {
  // 既存を試す
  const { data: found, error: e1 } = await supabase
    .from('months')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (e1) throw e1
  if (found) return found

  const { data, error } = await supabase
    .from('months')
    .insert({ year, month, status: 'collecting' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMonthStatus(id: string, status: MonthStatus): Promise<void> {
  const { error } = await supabase.from('months').update({ status }).eq('id', id)
  if (error) throw error
}

/* ============================== month_courses ============================== */

export async function listMonthCourses(month_id: string) {
  const { data, error } = await supabase
    .from('month_courses')
    .select('*, course:courses(*)')
    .eq('month_id', month_id)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    month_id: string
    course_id: string
    sort_order: number
    course: Course
  }>
}

export async function setMonthCourses(
  month_id: string,
  courseIds: string[]
): Promise<void> {
  // 既存を全部消して入れ直す（件数は数件レベル）
  const { error: delErr } = await supabase
    .from('month_courses')
    .delete()
    .eq('month_id', month_id)
  if (delErr) throw delErr
  if (courseIds.length === 0) return
  const rows = courseIds.map((cid, i) => ({
    month_id,
    course_id: cid,
    sort_order: (i + 1) * 10,
  }))
  const { error } = await supabase.from('month_courses').insert(rows)
  if (error) throw error
}

/* ============================== driver_availability ============================== */

export async function listAvailabilityForMonth(
  month_id: string
): Promise<DriverAvailability[]> {
  const { data, error } = await supabase
    .from('driver_availability')
    .select('*')
    .eq('month_id', month_id)
  if (error) throw error
  return data ?? []
}

export async function listAvailabilityForDriver(
  month_id: string,
  driver_name: string
): Promise<DriverAvailability[]> {
  const { data, error } = await supabase
    .from('driver_availability')
    .select('*')
    .eq('month_id', month_id)
    .eq('driver_name', driver_name)
  if (error) throw error
  return data ?? []
}

export async function upsertAvailability(
  rows: Array<{
    month_id: string
    driver_name: string
    date: string
    status: AvailabilityStatus
    note?: string
  }>
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('driver_availability')
    .upsert(
      rows.map((r) => ({ note: '', ...r })),
      { onConflict: 'month_id,driver_name,date' }
    )
  if (error) throw error
}

export async function deleteAvailability(
  month_id: string,
  driver_name: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from('driver_availability')
    .delete()
    .eq('month_id', month_id)
    .eq('driver_name', driver_name)
    .eq('date', date)
  if (error) throw error
}

/* ============================== shift_assignments ============================== */

export async function listAssignmentsForMonth(
  month_id: string
): Promise<ShiftAssignment[]> {
  const { data, error } = await supabase
    .from('shift_assignments')
    .select('*')
    .eq('month_id', month_id)
  if (error) throw error
  return data ?? []
}

export async function upsertAssignment(row: {
  month_id: string
  date: string
  course_id: string
  driver_id?: string | null
  free_text?: string | null
  is_free_text?: boolean
  note?: string
}): Promise<void> {
  const payload = {
    note: '',
    driver_id: null,
    free_text: null,
    is_free_text: false,
    ...row,
  }
  const { error } = await supabase
    .from('shift_assignments')
    .upsert(payload, { onConflict: 'month_id,date,course_id' })
  if (error) throw error
}

export async function deleteAssignment(
  month_id: string,
  date: string,
  course_id: string
): Promise<void> {
  const { error } = await supabase
    .from('shift_assignments')
    .delete()
    .eq('month_id', month_id)
    .eq('date', date)
    .eq('course_id', course_id)
  if (error) throw error
}

/* ============================== day_notes ============================== */

export async function listDayNotes(month_id: string) {
  const { data, error } = await supabase
    .from('day_notes')
    .select('*')
    .eq('month_id', month_id)
  if (error) throw error
  return data ?? []
}

export async function upsertDayNote(row: {
  month_id: string
  date: string
  content: string
}): Promise<void> {
  const { error } = await supabase
    .from('day_notes')
    .upsert(row, { onConflict: 'month_id,date' })
  if (error) throw error
}
