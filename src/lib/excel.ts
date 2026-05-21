import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import type { Course, Driver, ShiftAssignment } from './types'
import { jpDayOfWeek, sheetName } from './utils'

export type ExportInput = {
  year: number
  month: number
  dates: string[]
  courses: Course[]
  drivers: Driver[]
  assignments: ShiftAssignment[]
  dayNotes: Record<string, string>
}

/**
 * シンプルな割当表として .xlsx を出力。
 *
 *   行1: タイトル「N月 川島センター　リベラックシフト表」
 *   行2: ヘッダ（空 / 空 / コース名…）
 *   行3〜: 各日付（日付 / 曜日 / 割当者…）
 */
export function exportMonthToXlsx(input: ExportInput): void {
  const { year, month, dates, courses, drivers, assignments } = input
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const cellMap = new Map<string, ShiftAssignment>()
  for (const a of assignments) cellMap.set(`${a.date}|${a.course_id}`, a)

  const headerRow: (string | number | null)[] = [
    '',
    '',
    ...courses.map((c) => c.name),
  ]

  const dataRows: (string | number | null)[][] = dates.map((date) => {
    const dow = jpDayOfWeek(date)
    const courseCells = courses.map((c) => {
      const a = cellMap.get(`${date}|${c.id}`)
      if (!a) return ''
      if (a.is_free_text) return a.free_text ?? ''
      if (a.driver_id) return driverById.get(a.driver_id)?.name ?? ''
      return ''
    })
    return [format(new Date(date), 'yyyy-MM-dd'), dow, ...courseCells]
  })

  const titleRow: (string | number | null)[] = [
    `${month}月 川島センター　リベラックシフト表`,
  ]

  const aoa: (string | number | null)[][] = [titleRow, headerRow, ...dataRows]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // 列幅
  const cols: XLSX.ColInfo[] = [
    { wch: 12 }, // 日付
    { wch: 6 }, // 曜日
    ...courses.map(() => ({ wch: 16 } as XLSX.ColInfo)),
  ]
  ws['!cols'] = cols

  // タイトル行をマージ
  const lastCol = headerRow.length - 1
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName(year, month))

  XLSX.writeFile(wb, `川島シフト_${year}年${month}月.xlsx`)
}
