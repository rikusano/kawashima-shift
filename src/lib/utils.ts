import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  getDay,
  isWeekend,
  startOfMonth,
} from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'] as const
export function jpDayOfWeek(d: Date | string): (typeof DOW)[number] {
  const date = typeof d === 'string' ? new Date(d) : d
  return DOW[getDay(date)]
}

export function ymd(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

/** 翌月の (year, month) を返す */
export function nextMonth(base: Date = new Date()): { year: number; month: number } {
  const n = addMonths(base, 1)
  return { year: n.getFullYear(), month: n.getMonth() + 1 }
}

/** その月のすべての日付 (yyyy-MM-dd) を返す */
export function datesInMonth(year: number, month: number): string[] {
  const start = startOfMonth(new Date(year, month - 1, 1))
  const end = endOfMonth(start)
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push(ymd(d))
  }
  return out
}

/** 月のラベル (例: 2026年5月) */
export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`
}

/** Excel シート名 */
export function sheetName(year: number, month: number): string {
  return `${year}年${month}月`
}

/** カレンダー描画用：日曜始まり 6 週固定で日付セルを返す（その月以外は null） */
export function calendarGrid(
  year: number,
  month: number
): Array<Array<{ date: string; inMonth: boolean }>> {
  const first = startOfMonth(new Date(year, month - 1, 1))
  const last = endOfMonth(first)
  const startOffset = getDay(first) // 0=Sun
  const weeks: Array<Array<{ date: string; inMonth: boolean }>> = []
  let cursor = addDays(first, -startOffset)
  for (let w = 0; w < 6; w++) {
    const row: Array<{ date: string; inMonth: boolean }> = []
    for (let d = 0; d < 7; d++) {
      row.push({
        date: ymd(cursor),
        inMonth: cursor >= first && cursor <= last,
      })
      cursor = addDays(cursor, 1)
    }
    weeks.push(row)
  }
  return weeks
}

export function isWeekendDate(date: string): boolean {
  return isWeekend(new Date(date))
}

/** 表示用：M/D */
export function shortMD(date: string): string {
  return format(new Date(date), 'M/d')
}

/** Levenshtein 距離（短い名前同士想定） */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  )
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length]
}

/** 名前のもしかして候補（距離が最も近いものを1件返す） */
export function suggestName(input: string, roster: string[]): string | null {
  const trimmed = input.trim()
  if (!trimmed || roster.length === 0) return null
  let best: { name: string; d: number } | null = null
  for (const name of roster) {
    if (name === trimmed) return null // 完全一致なら不要
    const d = levenshtein(trimmed, name)
    if (!best || d < best.d) best = { name, d }
  }
  if (!best) return null
  // 短い名前で誤検出を避けるため、距離が文字列長の半分以下のみサジェスト
  const threshold = Math.max(1, Math.floor(Math.max(trimmed.length, best.name.length) / 2))
  return best.d <= threshold ? best.name : null
}
