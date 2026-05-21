import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  calendarGrid,
  cn,
  jpDayOfWeek,
  monthLabel,
  nextMonth,
  suggestName,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  getOrCreateMonth,
  listAvailabilityForDriver,
  listDrivers,
  upsertAvailability,
} from '@/lib/api'
import type { AvailabilityStatus, Month } from '@/lib/types'

type CellState = { status: AvailabilityStatus; note: string }
type CellMap = Record<string, CellState>

const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: '出勤可',
  maybe: '応相談',
  off: '休み希望',
}
const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  maybe: 'bg-amber-100 text-amber-800 border-amber-300',
  off: 'bg-rose-100 text-rose-800 border-rose-300',
}
const STATUS_ORDER: AvailabilityStatus[] = ['available', 'maybe', 'off']

export default function DriverPage() {
  const { push } = useToast()
  const target = React.useMemo(() => nextMonth(), [])
  const [month, setMonth] = React.useState<Month | null>(null)
  const [roster, setRoster] = React.useState<string[]>([])
  const [name, setName] = React.useState('')
  const [committedName, setCommittedName] = React.useState<string | null>(null)
  const [suggestion, setSuggestion] = React.useState<string | null>(null)
  const [cells, setCells] = React.useState<CellMap>({})
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    ;(async () => {
      try {
        const [drivers, m] = await Promise.all([
          listDrivers(),
          getOrCreateMonth(target.year, target.month),
        ])
        setRoster(drivers.filter((d) => d.active).map((d) => d.name))
        setMonth(m)
      } catch (e: any) {
        push(`初期化に失敗しました: ${e.message ?? e}`, 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [target.year, target.month, push])

  async function loadForName(n: string) {
    if (!month) return
    const rows = await listAvailabilityForDriver(month.id, n)
    const next: CellMap = {}
    for (const r of rows) next[r.date] = { status: r.status, note: r.note ?? '' }
    setCells(next)
  }

  function checkSuggestion(input: string) {
    const trimmed = input.trim()
    if (!trimmed) {
      setSuggestion(null)
      return
    }
    if (roster.includes(trimmed)) {
      setSuggestion(null)
      return
    }
    setSuggestion(suggestName(trimmed, roster))
  }

  async function confirmName(n: string) {
    const trimmed = n.trim()
    if (!trimmed) return
    setCommittedName(trimmed)
    setName(trimmed)
    setSuggestion(null)
    await loadForName(trimmed)
  }

  function setCell(date: string, status: AvailabilityStatus | null, note?: string) {
    setCells((prev) => {
      const next = { ...prev }
      if (status === null) {
        delete next[date]
      } else {
        next[date] = { status, note: note ?? prev[date]?.note ?? '' }
      }
      return next
    })
  }

  function cycleCell(date: string) {
    const current = cells[date]?.status
    const idx = current ? STATUS_ORDER.indexOf(current) : -1
    const nextIdx = idx + 1
    if (nextIdx >= STATUS_ORDER.length) {
      setCell(date, null)
    } else {
      setCell(date, STATUS_ORDER[nextIdx])
    }
  }

  function bulkSet(filter: (date: string) => boolean, status: AvailabilityStatus | null) {
    if (!month) return
    const grid = calendarGrid(month.year, month.month).flat().filter((c) => c.inMonth)
    setCells((prev) => {
      const next = { ...prev }
      for (const c of grid) {
        if (filter(c.date)) {
          if (status === null) delete next[c.date]
          else next[c.date] = { status, note: prev[c.date]?.note ?? '' }
        }
      }
      return next
    })
  }

  async function save() {
    if (!month || !committedName) return
    setSaving(true)
    try {
      const rows = Object.entries(cells).map(([date, v]) => ({
        month_id: month.id,
        driver_name: committedName,
        date,
        status: v.status,
        note: v.note ?? '',
      }))
      await upsertAvailability(rows)
      push('保存しました', 'success')
    } catch (e: any) {
      push(`保存に失敗しました: ${e.message ?? e}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-slate-500">読み込み中…</div>
  }

  if (!month) {
    return (
      <div className="p-6 text-red-600">
        対象月の取得に失敗しました。Supabaseの設定をご確認ください。
      </div>
    )
  }

  if (!committedName) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{monthLabel(month.year, month.month)} 出勤可否の入力</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="text-sm text-slate-600">お名前（フルネームでなくてもOK）</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                checkSuggestion(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) confirmName(name)
              }}
              placeholder="例：對馬"
            />
            {suggestion && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                もしかして：
                <button
                  onClick={() => {
                    setName(suggestion)
                    setSuggestion(null)
                  }}
                  className="ml-1 underline font-medium"
                >
                  {suggestion}
                </button>
                ？
                <div className="text-xs text-amber-600 mt-1">
                  名簿に無い名前でもそのまま入力できます（管理者が後で確認します）。
                </div>
              </div>
            )}
            <Button
              onClick={() => confirmName(name)}
              disabled={!name.trim()}
              className="w-full"
            >
              この名前で入力を始める
            </Button>
            <div className="text-xs text-slate-400 pt-2">
              同じ名前で再アクセスすると、前回の入力を編集できます。
            </div>
            <div className="text-center pt-2">
              <Link to="/" className="text-xs text-slate-500 underline">
                トップに戻る
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const grid = calendarGrid(month.year, month.month)
  const selected = selectedDate ? cells[selectedDate] : undefined
  const counts = Object.values(cells).reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1
      return acc
    },
    { available: 0, maybe: 0, off: 0 } as Record<AvailabilityStatus, number>
  )

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs text-slate-500">入力者</div>
          <div className="text-lg font-semibold">
            {committedName}
            <button
              onClick={() => {
                setCommittedName(null)
                setCells({})
              }}
              className="ml-2 text-xs text-slate-500 underline"
            >
              名前を変更
            </button>
          </div>
        </div>
        <div className="text-lg font-bold">
          {monthLabel(month.year, month.month)}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                bulkSet((d) => {
                  const dow = jpDayOfWeek(d)
                  return dow !== '土' && dow !== '日'
                }, 'available')
              }
            >
              平日すべて出勤可
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                bulkSet((d) => {
                  const dow = jpDayOfWeek(d)
                  return dow === '土' || dow === '日'
                }, 'off')
              }
            >
              土日休み希望
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkSet(() => true, 'available')}
            >
              全日 出勤可
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => bulkSet(() => true, 'off')}
            >
              全日 休み希望
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkSet(() => true, null)}
            >
              クリア
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-1">
            {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.flat().map((c, i) => {
              const cell = cells[c.date]
              const dow = jpDayOfWeek(c.date)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!c.inMonth}
                  onClick={() => {
                    cycleCell(c.date)
                    setSelectedDate(c.date)
                  }}
                  className={cn(
                    'aspect-square rounded-md border text-xs sm:text-sm flex flex-col items-center justify-center p-1 transition-colors',
                    !c.inMonth && 'opacity-30 pointer-events-none border-transparent',
                    c.inMonth && !cell && 'bg-white border-slate-200 hover:bg-slate-50',
                    cell && STATUS_COLOR[cell.status],
                    selectedDate === c.date && 'ring-2 ring-slate-500 ring-offset-1',
                    dow === '日' && c.inMonth && !cell && 'text-rose-500',
                    dow === '土' && c.inMonth && !cell && 'text-sky-500'
                  )}
                >
                  <div className="font-semibold leading-none">
                    {Number(c.date.slice(-2))}
                  </div>
                  {cell && (
                    <div className="text-[10px] leading-tight mt-1">
                      {STATUS_LABEL[cell.status]}
                    </div>
                  )}
                  {cell?.note && (
                    <div className="text-[9px] leading-tight truncate w-full px-0.5">
                      📝
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="text-xs text-slate-500 mt-2">
            セルをタップすると 出勤可 → 応相談 → 休み希望 → 未入力 の順に切り替わります
          </div>

          {selectedDate && (
            <div className="mt-4 p-3 rounded-md border border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">
                  {selectedDate}（{jpDayOfWeek(selectedDate)}）
                </div>
                <div className="flex gap-1">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      onClick={() => setCell(selectedDate, s)}
                      className={cn(
                        'text-xs px-2 py-1 rounded border',
                        cells[selectedDate]?.status === s
                          ? STATUS_COLOR[s]
                          : 'bg-white border-slate-300 text-slate-600'
                      )}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  <button
                    onClick={() => setCell(selectedDate, null)}
                    className="text-xs px-2 py-1 rounded border bg-white border-slate-300 text-slate-500"
                  >
                    未入力
                  </button>
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder="備考（例：午後のみ可、1便のみ）"
                value={selected?.note ?? ''}
                onChange={(e) =>
                  setCell(
                    selectedDate,
                    cells[selectedDate]?.status ?? 'available',
                    e.target.value
                  )
                }
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="text-slate-500">
              出勤可 {counts.available} / 応相談 {counts.maybe} / 休み {counts.off}
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
