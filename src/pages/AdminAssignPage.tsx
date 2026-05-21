import * as React from 'react'
import { AdminGate, AdminShell } from '@/components/AdminShell'
import { MonthSelect, NewMonthButton, useSelectedMonth } from '@/components/MonthPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  deleteAssignment,
  listAssignmentsForMonth,
  listAvailabilityForMonth,
  listCourses,
  listDayNotes,
  listDrivers,
  listMonthCourses,
  setMonthCourses,
  upsertAssignment,
  upsertDayNote,
} from '@/lib/api'
import { cn, datesInMonth, jpDayOfWeek, monthLabel } from '@/lib/utils'
import type {
  Course,
  Driver,
  DriverAvailability,
  ShiftAssignment,
} from '@/lib/types'
import { Pencil, X, Download, Settings } from 'lucide-react'
import { exportMonthToXlsx } from '@/lib/excel'

type CellAssignment = ShiftAssignment | undefined

export default function AdminAssignPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  )
}

function Inner() {
  const { months, current, select, reload } = useSelectedMonth()
  const { push } = useToast()
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [courses, setCourses] = React.useState<Course[]>([])
  const [monthCourses, setMonthCoursesState] = React.useState<Course[]>([])
  const [availability, setAvailability] = React.useState<DriverAvailability[]>([])
  const [assignments, setAssignments] = React.useState<ShiftAssignment[]>([])
  const [dayNotes, setDayNotes] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [editor, setEditor] = React.useState<{
    date: string
    course_id: string
    mode: 'select' | 'free'
  } | null>(null)
  const [editingNote, setEditingNote] = React.useState<string | null>(null)
  const [showCourseConfig, setShowCourseConfig] = React.useState(false)

  const loadAll = React.useCallback(async () => {
    if (!current) return
    setLoading(true)
    try {
      const [ds, cs, mcs, av, as, dn] = await Promise.all([
        listDrivers(),
        listCourses(),
        listMonthCourses(current.id),
        listAvailabilityForMonth(current.id),
        listAssignmentsForMonth(current.id),
        listDayNotes(current.id),
      ])
      setDrivers(ds)
      setCourses(cs)
      const mcCourses = mcs.map((m) => m.course).filter(Boolean) as Course[]
      // 月内にコース未設定なら、全コースを使う
      setMonthCoursesState(mcCourses.length > 0 ? mcCourses : cs.filter((c) => c.active))
      setAvailability(av)
      setAssignments(as)
      const noteMap: Record<string, string> = {}
      for (const n of dn) noteMap[n.date] = n.content
      setDayNotes(noteMap)
    } catch (e: any) {
      push(`読み込み失敗: ${e.message ?? e}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [current, push])

  React.useEffect(() => {
    loadAll()
  }, [loadAll])

  if (!current) return <AdminShell title="シフト割当">読み込み中…</AdminShell>

  const dates = datesInMonth(current.year, current.month)

  // (date, course_id) -> assignment
  const cellMap = new Map<string, ShiftAssignment>()
  for (const a of assignments) cellMap.set(`${a.date}|${a.course_id}`, a)

  // date -> [availability]
  const availByDate = new Map<string, DriverAvailability[]>()
  for (const a of availability) {
    const list = availByDate.get(a.date) ?? []
    list.push(a)
    availByDate.set(a.date, list)
  }

  // driver_id -> work day count（自由記述は含まない、選択モードのみカウント）
  const driverCount = new Map<string, number>()
  for (const a of assignments) {
    if (!a.is_free_text && a.driver_id) {
      const key = `${a.driver_id}|${a.date}`
      // 同じドライバーが同日複数コースを担当 → 1日としてカウント
      if (!driverCount.has(key)) driverCount.set(key, 1)
    }
  }
  const totalByDriver = new Map<string, number>()
  for (const key of driverCount.keys()) {
    const did = key.split('|')[0]
    totalByDriver.set(did, (totalByDriver.get(did) ?? 0) + 1)
  }

  async function setAssignment(
    date: string,
    course_id: string,
    payload: {
      driver_id?: string | null
      free_text?: string | null
      is_free_text?: boolean
    }
  ) {
    if (!current) return
    try {
      await upsertAssignment({
        month_id: current.id,
        date,
        course_id,
        ...payload,
      })
      await loadAll()
    } catch (e: any) {
      push(`保存失敗: ${e.message ?? e}`, 'error')
    }
  }

  async function clearAssignment(date: string, course_id: string) {
    if (!current) return
    await deleteAssignment(current.id, date, course_id)
    await loadAll()
  }

  async function setDayNote(date: string, content: string) {
    if (!current) return
    await upsertDayNote({ month_id: current.id, date, content })
    setDayNotes((prev) => ({ ...prev, [date]: content }))
  }

  async function bulkSetRow(date: string, action: '全休' | '2稼働' | 'クリア') {
    if (!current) return
    if (action === 'クリア') {
      await Promise.all(
        monthCourses.map((c) => deleteAssignment(current.id, date, c.id))
      )
      await setDayNote(date, '')
    } else if (action === '全休') {
      await Promise.all(
        monthCourses.map((c) => deleteAssignment(current.id, date, c.id))
      )
      await setDayNote(date, '全休')
    } else if (action === '2稼働') {
      await setDayNote(date, '2稼働')
    }
    await loadAll()
  }

  async function applyCourseConfig(ids: string[]) {
    if (!current) return
    await setMonthCourses(current.id, ids)
    setShowCourseConfig(false)
    push('コース構成を更新しました', 'success')
    await loadAll()
  }

  function doExport() {
    if (!current) return
    exportMonthToXlsx({
      year: current.year,
      month: current.month,
      dates,
      courses: monthCourses,
      drivers,
      assignments,
      dayNotes,
    })
  }

  return (
    <AdminShell
      title={`シフト割当: ${monthLabel(current.year, current.month)}`}
      actions={
        <>
          <MonthSelect months={months} current={current} onChange={select} />
          <NewMonthButton onCreated={reload} />
          <Button size="sm" variant="outline" onClick={() => setShowCourseConfig(true)}>
            <Settings className="h-4 w-4 mr-1" /> 月のコース構成
          </Button>
          <Button size="sm" onClick={doExport}>
            <Download className="h-4 w-4 mr-1" /> Excel出力
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="text-slate-500">読み込み中…</div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
            <table className="text-sm min-w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="sticky-col bg-slate-50 px-2 py-2 text-left font-medium w-20">
                    日付
                  </th>
                  <th className="px-2 py-2 text-center font-medium w-12">曜日</th>
                  {monthCourses.map((c) => (
                    <th
                      key={c.id}
                      className="px-2 py-2 text-left font-medium min-w-[140px]"
                    >
                      {c.name}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium w-16">動員数</th>
                  <th className="px-2 py-2 text-left font-medium min-w-[140px]">備考</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date) => {
                  const dow = jpDayOfWeek(date)
                  const isSat = dow === '土'
                  const isSun = dow === '日'
                  const rowAv = availByDate.get(date) ?? []
                  const headcount = monthCourses.reduce((n, c) => {
                    const a = cellMap.get(`${date}|${c.id}`)
                    return n + (a && (a.driver_id || a.is_free_text) ? 1 : 0)
                  }, 0)
                  return (
                    <tr
                      key={date}
                      className={cn(
                        'border-b border-slate-100 hover:bg-slate-50/50',
                        isSat && 'bg-sky-50/40',
                        isSun && 'bg-rose-50/40'
                      )}
                    >
                      <td
                        className={cn(
                          'sticky-col px-2 py-1.5 font-medium whitespace-nowrap',
                          isSat ? 'bg-sky-50/40' : isSun ? 'bg-rose-50/40' : 'bg-white'
                        )}
                      >
                        {date.slice(5).replace('-', '/')}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-1.5 text-center',
                          isSat && 'text-sky-600',
                          isSun && 'text-rose-600'
                        )}
                      >
                        {dow}
                      </td>
                      {monthCourses.map((c) => {
                        const a = cellMap.get(`${date}|${c.id}`)
                        const isEditing =
                          editor?.date === date && editor?.course_id === c.id
                        return (
                          <td
                            key={c.id}
                            className="px-1 py-1 align-top relative"
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return
                              setEditor({ date, course_id: c.id, mode: 'select' })
                            }}
                          >
                            <AssignmentCell
                              assignment={a}
                              drivers={drivers}
                              availability={rowAv}
                              assignmentsForDate={monthCourses
                                .filter((mc) => mc.id !== c.id)
                                .map((mc) => cellMap.get(`${date}|${mc.id}`))
                                .filter(Boolean) as ShiftAssignment[]}
                              editing={isEditing ? editor!.mode : null}
                              onOpenEdit={() =>
                                setEditor({ date, course_id: c.id, mode: 'select' })
                              }
                              onOpenFree={() =>
                                setEditor({ date, course_id: c.id, mode: 'free' })
                              }
                              onSwitchMode={() =>
                                setEditor({
                                  date,
                                  course_id: c.id,
                                  mode:
                                    editor?.mode === 'free' ? 'select' : 'free',
                                })
                              }
                              onClose={() => setEditor(null)}
                              onPick={async (driver_id) => {
                                await setAssignment(date, c.id, {
                                  driver_id,
                                  is_free_text: false,
                                  free_text: null,
                                })
                                setEditor(null)
                              }}
                              onFreeText={async (text) => {
                                if (!text) {
                                  await clearAssignment(date, c.id)
                                } else {
                                  await setAssignment(date, c.id, {
                                    driver_id: null,
                                    free_text: text,
                                    is_free_text: true,
                                  })
                                }
                                setEditor(null)
                              }}
                              onClear={async () => {
                                await clearAssignment(date, c.id)
                                setEditor(null)
                              }}
                            />
                          </td>
                        )
                      })}
                      <td className="px-2 py-1.5 text-center font-medium">{headcount}</td>
                      <td className="px-1 py-1">
                        {editingNote === date ? (
                          <Input
                            autoFocus
                            defaultValue={dayNotes[date] ?? ''}
                            className="h-8"
                            onBlur={(e) => {
                              setDayNote(date, e.target.value)
                              setEditingNote(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                setDayNote(
                                  date,
                                  (e.target as HTMLInputElement).value
                                )
                                setEditingNote(null)
                              }
                              if (e.key === 'Escape') setEditingNote(null)
                            }}
                          />
                        ) : (
                          <div
                            onClick={() => setEditingNote(date)}
                            className="min-h-[28px] cursor-text px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                          >
                            <span className="flex-1">{dayNotes[date] || ''}</span>
                            <div className="flex gap-0.5 opacity-60">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  bulkSetRow(date, '全休')
                                }}
                                className="text-[10px] px-1 py-0.5 border rounded hover:bg-white"
                                title="全休に設定"
                              >
                                全休
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  bulkSetRow(date, '2稼働')
                                }}
                                className="text-[10px] px-1 py-0.5 border rounded hover:bg-white"
                                title="2稼働に設定"
                              >
                                2稼働
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h2 className="font-semibold mb-2">ドライバー別 今月の稼働日数</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {drivers
                .filter((d) => d.active)
                .map((d) => {
                  const n = totalByDriver.get(d.id) ?? 0
                  return (
                    <div
                      key={d.id}
                      className="bg-white border border-slate-200 rounded-md px-3 py-2 flex items-center justify-between"
                    >
                      <span className="font-medium">{d.name}</span>
                      <span className="text-lg font-bold">{n}日</span>
                    </div>
                  )
                })}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              ※ 選択モードで割り当てたドライバーのみカウント（自由記述セルは含まれません）
            </div>
          </div>

          {showCourseConfig && (
            <CourseConfigDialog
              allCourses={courses}
              current={monthCourses}
              onClose={() => setShowCourseConfig(false)}
              onSave={applyCourseConfig}
            />
          )}
        </>
      )}
    </AdminShell>
  )
}

function AssignmentCell({
  assignment,
  drivers,
  availability,
  assignmentsForDate,
  editing,
  onOpenEdit,
  onOpenFree,
  onSwitchMode,
  onClose,
  onPick,
  onFreeText,
  onClear,
}: {
  assignment: CellAssignment
  drivers: Driver[]
  availability: DriverAvailability[]
  assignmentsForDate: ShiftAssignment[]
  editing: 'select' | 'free' | null
  onOpenEdit: () => void
  onOpenFree: () => void
  onSwitchMode: () => void
  onClose: () => void
  onPick: (driver_id: string) => void
  onFreeText: (text: string) => void
  onClear: () => void
}) {
  const driverById = new Map(drivers.map((d) => [d.id, d]))
  const assignedDriverIds = new Set(
    assignmentsForDate.map((a) => a.driver_id).filter(Boolean) as string[]
  )
  const availByName = new Map(availability.map((a) => [a.driver_name, a]))

  // 表示
  let label = ''
  let isFree = false
  if (assignment) {
    if (assignment.is_free_text) {
      label = assignment.free_text ?? ''
      isFree = true
    } else if (assignment.driver_id) {
      const d = driverById.get(assignment.driver_id)
      label = d?.name ?? '(削除済み)'
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          'min-h-[32px] px-2 py-1 rounded border text-sm cursor-pointer',
          label
            ? 'bg-white border-slate-300 hover:border-slate-500'
            : 'bg-slate-50 border-dashed border-slate-300 hover:border-slate-400 text-slate-400'
        )}
      >
        <span>{label || '＋'}</span>
        {isFree && (
          <span className="absolute right-1 bottom-0.5 text-[9px] text-amber-500">●</span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenFree()
        }}
        className="absolute right-0 top-0 p-0.5 text-slate-400 hover:text-slate-700"
        title="自由記述モード"
      >
        <Pencil className="h-3 w-3" />
      </button>

      {editing && (
        <div
          className="absolute z-20 top-full left-0 mt-1 bg-white border border-slate-300 rounded-md shadow-lg p-2 min-w-[220px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-500">
              {editing === 'free' ? '自由記述' : '出勤可ドライバー'}
            </div>
            <div className="flex gap-1">
              <button
                onClick={onSwitchMode}
                className="text-[10px] px-1.5 py-0.5 border rounded hover:bg-slate-50"
              >
                {editing === 'free' ? '選択モード' : '自由記述'}
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {editing === 'select' ? (
            <SelectList
              drivers={drivers}
              availByName={availByName}
              assignedDriverIds={assignedDriverIds}
              currentDriverId={assignment?.driver_id ?? null}
              onPick={onPick}
              onClear={onClear}
            />
          ) : (
            <FreeTextInput
              defaultValue={assignment?.free_text ?? ''}
              onSave={onFreeText}
              onCancel={onClose}
            />
          )}
        </div>
      )}
    </div>
  )
}

function SelectList({
  drivers,
  availByName,
  assignedDriverIds,
  currentDriverId,
  onPick,
  onClear,
}: {
  drivers: Driver[]
  availByName: Map<string, DriverAvailability>
  assignedDriverIds: Set<string>
  currentDriverId: string | null
  onPick: (id: string) => void
  onClear: () => void
}) {
  // 名簿のうち、その日 available または maybe のみ表示。off の人は除外。
  const candidates = drivers.filter((d) => {
    if (!d.active) return false
    const av = availByName.get(d.name)
    if (!av) return false
    return av.status === 'available' || av.status === 'maybe'
  })

  function handlePick(d: Driver) {
    if (assignedDriverIds.has(d.id) && d.id !== currentDriverId) {
      if (!confirm(`${d.name} は同日に他コースへ割当済です。二重で割り当てますか？`))
        return
    }
    onPick(d.id)
  }

  return (
    <div className="max-h-64 overflow-y-auto space-y-0.5">
      {candidates.length === 0 && (
        <div className="text-xs text-slate-500 py-2 px-1">
          この日「出勤可」と回答したドライバーはいません
        </div>
      )}
      {candidates.map((d) => {
        const av = availByName.get(d.name)!
        const isMaybe = av.status === 'maybe'
        const isAssigned = assignedDriverIds.has(d.id) && d.id !== currentDriverId
        return (
          <button
            key={d.id}
            onClick={() => handlePick(d)}
            className={cn(
              'w-full text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100 flex items-center justify-between',
              isAssigned && 'text-slate-400'
            )}
          >
            <span className="flex items-center gap-1.5">
              {isMaybe && <span className="text-amber-500">●</span>}
              <span>{d.name}</span>
              {av.note && (
                <span className="text-[10px] text-slate-500">({av.note})</span>
              )}
            </span>
            {isAssigned && <span className="text-[10px]">割当済</span>}
          </button>
        )
      })}
      <div className="border-t mt-1 pt-1">
        <button
          onClick={onClear}
          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-rose-50 text-rose-600"
        >
          クリア
        </button>
      </div>
    </div>
  )
}

function FreeTextInput({
  defaultValue,
  onSave,
  onCancel,
}: {
  defaultValue: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = React.useState(defaultValue)
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(val.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="例：たける（1便）安藤"
      />
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button size="sm" onClick={() => onSave(val.trim())}>
          保存
        </Button>
      </div>
    </div>
  )
}

function CourseConfigDialog({
  allCourses,
  current,
  onClose,
  onSave,
}: {
  allCourses: Course[]
  current: Course[]
  onClose: () => void
  onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = React.useState<string[]>(current.map((c) => c.id))

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }
  function move(id: string, dir: -1 | 1) {
    setSelected((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const tgt = idx + dir
      if (tgt < 0 || tgt >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[tgt]] = [next[tgt], next[idx]]
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-4 w-full max-w-md max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold mb-3">この月で使うコース</h2>
        <div className="space-y-1 mb-3">
          {selected.map((id, i) => {
            const c = allCourses.find((x) => x.id === id)
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
                  disabled={i === selected.length - 1}
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
        </div>
        <div className="border-t pt-3">
          <div className="text-xs text-slate-500 mb-1">追加できるコース</div>
          <div className="flex flex-wrap gap-1">
            {allCourses
              .filter((c) => c.active && !selected.includes(c.id))
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
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={() => onSave(selected)}>保存</Button>
        </div>
      </div>
    </div>
  )
}
