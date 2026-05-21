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
 * 既存Excel管理表と同じレイアウトでブックを生成してダウンロードさせる。
 *
 *   行1: タイトル「N月 川島センター　リベラックシフト表」
 *   行2: ヘッダ（空, 曜日, …コース, 動員数, …ドライバー名, 備考）
 *   行3〜: 各日付の行
 *   末尾行: 各ドライバー列の合計
 */
export function exportMonthToXlsx(input: ExportInput): void {
  const { year, month, dates, courses, drivers, assignments, dayNotes } = input
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const cellMap = new Map<string, ShiftAssignment>()
  for (const a of assignments) cellMap.set(`${a.date}|${a.course_id}`, a)

  const activeDrivers = drivers.filter((d) => d.active)

  const headerRow: (string | number | null)[] = [
    '',
    '',
    ...courses.map((c) => c.name),
    '動員数',
    ...activeDrivers.map((d) => d.name),
    '備考',
  ]

  // タリー集計
  const tally = new Map<string, number>() // `${driver_id}|${date}` -> 1
  for (const a of assignments) {
    if (!a.is_free_text && a.driver_id) {
      tally.set(`${a.driver_id}|${a.date}`, 1)
    }
  }

  const dataRows: (string | number | null)[][] = dates.map((date) => {
    const dow = jpDayOfWeek(date)
    const courseCells = courses.map((c) => {
      const a = cellMap.get(`${date}|${c.id}`)
      if (!a) return ''
      if (a.is_free_text) return a.free_text ?? ''
      if (a.driver_id) return driverById.get(a.driver_id)?.name ?? ''
      return ''
    })
    const headcount = courses.reduce((n, c) => {
      const a = cellMap.get(`${date}|${c.id}`)
      return n + (a && (a.driver_id || a.is_free_text) ? 1 : 0)
    }, 0)
    const driverTally = activeDrivers.map((d) => (tally.has(`${d.id}|${date}`) ? 1 : ''))
    return [
      format(new Date(date), 'yyyy-MM-dd'),
      dow,
      ...courseCells,
      headcount,
      ...driverTally,
      dayNotes[date] ?? '',
    ]
  })

  // 合計行
  const totalRow: (string | number | null)[] = [
    '',
    '合計',
    ...courses.map(() => ''),
    dataRows.reduce((n, r) => n + (typeof r[2 + courses.length] === 'number' ? (r[2 + courses.length] as number) : 0), 0),
    ...activeDrivers.map((d) =>
      dates.reduce((n, date) => n + (tally.has(`${d.id}|${date}`) ? 1 : 0), 0)
    ),
    '',
  ]

  const titleRow: (string | number | null)[] = [
    `${month}月 川島センター　リベラックシフト表`,
  ]

  const aoa: (string | number | null)[][] = [titleRow, headerRow, ...dataRows, totalRow]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // 列幅
  const cols: XLSX.ColInfo[] = [
    { wch: 12 }, // 日付
    { wch: 6 },  // 曜日
    ...courses.map(() => ({ wch: 16 } as XLSX.ColInfo)),
    { wch: 8 },  // 動員数
    ...activeDrivers.map(() => ({ wch: 6 } as XLSX.ColInfo)),
    { wch: 24 }, // 備考
  ]
  ws['!cols'] = cols

  // タイトル行は1セル使うだけ。マージしておく
  const lastCol = headerRow.length - 1
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName(year, month))

  XLSX.writeFile(wb, `川島シフト_${year}年${month}月.xlsx`)
}
