export type AvailabilityStatus = 'available' | 'maybe' | 'off'
export type MonthStatus = 'collecting' | 'assigning' | 'confirmed'

export type Driver = {
  id: string
  name: string
  sort_order: number
  active: boolean
  created_at: string
}

export type Course = {
  id: string
  name: string
  sort_order: number
  active: boolean
  created_at: string
}

export type Month = {
  id: string
  year: number
  month: number
  status: MonthStatus
  created_at: string
}

export type MonthCourse = {
  id: string
  month_id: string
  course_id: string
  sort_order: number
}

export type DriverAvailability = {
  id: string
  month_id: string
  driver_name: string
  date: string // ISO date
  status: AvailabilityStatus
  note: string
  updated_at: string
}

export type ShiftAssignment = {
  id: string
  month_id: string
  date: string
  course_id: string
  driver_id: string | null
  free_text: string | null
  is_free_text: boolean
  note: string
  updated_at: string
}

export type DayNote = {
  id: string
  month_id: string
  date: string
  content: string
  updated_at: string
}

/** Supabase Database 型のミニマル定義（PostgrestClient の型補完用） */
export type Database = {
  public: {
    Tables: {
      drivers: {
        Row: Driver
        Insert: Partial<Driver> & { name: string }
        Update: Partial<Driver>
      }
      courses: {
        Row: Course
        Insert: Partial<Course> & { name: string }
        Update: Partial<Course>
      }
      months: {
        Row: Month
        Insert: Partial<Month> & { year: number; month: number }
        Update: Partial<Month>
      }
      month_courses: {
        Row: MonthCourse
        Insert: Partial<MonthCourse> & { month_id: string; course_id: string }
        Update: Partial<MonthCourse>
      }
      driver_availability: {
        Row: DriverAvailability
        Insert: Partial<DriverAvailability> & {
          month_id: string
          driver_name: string
          date: string
          status: AvailabilityStatus
        }
        Update: Partial<DriverAvailability>
      }
      shift_assignments: {
        Row: ShiftAssignment
        Insert: Partial<ShiftAssignment> & {
          month_id: string
          date: string
          course_id: string
        }
        Update: Partial<ShiftAssignment>
      }
      day_notes: {
        Row: DayNote
        Insert: Partial<DayNote> & { month_id: string; date: string }
        Update: Partial<DayNote>
      }
    }
  }
}
