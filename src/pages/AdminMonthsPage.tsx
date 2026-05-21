import * as React from 'react'
import { AdminGate, AdminShell } from '@/components/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  getOrCreateMonth,
  listCourses,
  listMonthCourses,
  listMonths,
  setMonthCourses,
  updateMonthStatus,
} from '@/lib/api'
import type { Course, Month, MonthStatus } from '@/lib/types'
import { monthLabel, nextMonth } from '@/lib/utils'

const STATUS_LABEL: Record<MonthStatus, string> = {
  collecting: '回答収集中',
  assigning: '割当中',
  confirmed: '確定',
}

export default function AdminMonthsPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  )
}

function Inner() {
  const { push } = useToast()
  const [months, setMonthsState] = React.useState<Month[]>([])
  const [courses, setCourses] = React.useState<Course[]>([])
  const [monthCoursesMap, setMonthCoursesMap] = React.useState<
    Record<string, string[]>
  >({})
  const [loading, setLoading] = React.useState(true)
  const [newYear, setNewYear] = React.useState(String(nextMonth().year))
  const [newMonth, setNewMonth] = React.useState(String(nextMonth().month))

  async function reload() {
    setLoading(true)
    try {
      const [ms, cs] = await Promise.all([listMonths(), listCourses()])
      setMonthsState(ms)
      setCourses(cs)
      const map: Record<string, string[]> = {}
      for (const m of ms) {
        const mcs = await listMonthCourses(m.id)
        map[m.id] = mcs.map((x) => x.course_id)
      }
      setMonthCoursesMap(map)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    reload()
  }, [])

  async function addMonth() {
    const y = parseInt(newYear, 10)
    const m = parseInt(newMonth, 10)
    if (!y || !m || m < 1 || m > 12) {
      push('年月が不正です', 'error')
      return
    }
    await getOrCreateMonth(y, m)
    push(`${y}年${m}月 を追加しました`, 'success')
    reload()
  }

  async function applyCourses(month_id: string, ids: string[]) {
    await setMonthCourses(month_id, ids)
    setMonthCoursesMap((prev) => ({ ...prev, [month_id]: ids }))
    push('コース構成を保存しました', 'success')
  }

  async function changeStatus(m: Month, s: MonthStatus) {
    await updateMonthStatus(m.id, s)
    push('ステータスを変更しました', 'success')
    reload()
  }

  return (
    <AdminShell title="月設定">
      <Card className="mb-4">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-2">月を追加</h2>
          <div className="flex gap-2 items-end flex-wrap">
            <div>
              <div className="text-xs text-slate-500">年</div>
              <Input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-24"
              />
            </div>
            <div>
              <div className="text-xs text-slate-500">月</div>
              <Input
                type="number"
                min={1}
                max={12}
                value={newMonth}
                onChange={(e) => setNewMonth(e.target.value)}
                className="w-20"
              />
            </div>
            <Button onClick={addMonth}>追加</Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-slate-500">読み込み中…</div>
      ) : (
        <div className="space-y-3">
          {months.map((m) => (
            <MonthRow
              key={m.id}
              month={m}
              courses={courses}
              selected={monthCoursesMap[m.id] ?? []}
              onChangeCourses={(ids) => applyCourses(m.id, ids)}
              onChangeStatus={(s) => changeStatus(m, s)}
            />
          ))}
        </div>
      )}
    </AdminShell>
  )
}

function MonthRow({
  month,
  courses,
  selected,
  onChangeCourses,
  onChangeStatus,
}: {
  month: Month
  courses: Course[]
  selected: string[]
  onChangeCourses: (ids: string[]) => void
  onChangeStatus: (s: MonthStatus) => void
}) {
  const [list, setList] = React.useState<string[]>(selected)
  React.useEffect(() => setList(selected), [selected])

  function toggle(id: string) {
    setList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  function move(id: string, dir: -1 | 1) {
    setList((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const tgt = idx + dir
      if (tgt < 0 || tgt >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
      return next
    })
  }

  const dirty = list.join(',') !== selected.join(',')

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold">{monthLabel(month.year, month.month)}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ステータス:</span>
            {(['collecting', 'assigning', 'confirmed'] as MonthStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => onChangeStatus(s)}
                className={
                  'text-xs px-2 py-1 rounded border ' +
                  (month.status === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-300 text-slate-600')
                }
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 mb-1">この月で使うコース（順序込み）</div>
        <div className="space-y-1 mb-2">
          {list.map((id, i) => {
            const c = courses.find((x) => x.id === id)
            if (!c) return null
            return (
              <div
                key={id}
                className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded"
              >
                <span className="flex-1">
                  {i + 1}. {c.name}
                </span>
                <button
                  onClick={() => move(id, -1)}
                  disabled={i === 0}
                  className="text-xs px-1.5 py-0.5 border rounded disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => move(id, 1)}
                  disabled={i === list.length - 1}
                  className="text-xs px-1.5 py-0.5 border rounded disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => toggle(id)}
                  className="text-xs px-1.5 py-0.5 border rounded text-rose-600"
                >
                  外す
                </button>
              </div>
            )
          })}
          {list.length === 0 && (
            <div className="text-xs text-slate-400 px-2 py-1">
              （未設定の場合は、有効な全コースが使用されます）
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 mb-1">追加できるコース</div>
        <div className="flex flex-wrap gap-1 mb-3">
          {courses
            .filter((c) => c.active && !list.includes(c.id))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className="text-xs px-2 py-1 border rounded hover:bg-slate-50"
              >
                + {c.name}
              </button>
            ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setList(selected)}
            disabled={!dirty}
          >
            破棄
          </Button>
          <Button size="sm" onClick={() => onChangeCourses(list)} disabled={!dirty}>
            コース構成を保存
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
