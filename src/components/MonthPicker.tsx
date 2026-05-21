import * as React from 'react'
import { Button } from '@/components/ui/button'
import { getOrCreateMonth, listMonths } from '@/lib/api'
import type { Month } from '@/lib/types'
import { monthLabel, nextMonth } from '@/lib/utils'

const STORAGE_KEY = 'kawashima-admin-month'

export function useSelectedMonth() {
  const [months, setMonths] = React.useState<Month[]>([])
  const [current, setCurrent] = React.useState<Month | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    const all = await listMonths()
    if (all.length === 0) {
      const nxt = nextMonth()
      const m = await getOrCreateMonth(nxt.year, nxt.month)
      setMonths([m])
      setCurrent(m)
      sessionStorage.setItem(STORAGE_KEY, m.id)
    } else {
      setMonths(all)
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const pick = all.find((m) => m.id === stored) ?? all[0]
      setCurrent(pick)
      sessionStorage.setItem(STORAGE_KEY, pick.id)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load])

  function select(m: Month) {
    setCurrent(m)
    sessionStorage.setItem(STORAGE_KEY, m.id)
  }

  return { months, current, select, reload: load, loading }
}

export function MonthSelect({
  months,
  current,
  onChange,
}: {
  months: Month[]
  current: Month | null
  onChange: (m: Month) => void
}) {
  return (
    <select
      value={current?.id ?? ''}
      onChange={(e) => {
        const m = months.find((x) => x.id === e.target.value)
        if (m) onChange(m)
      }}
      className="h-9 px-2 border border-slate-300 rounded-md text-sm bg-white"
    >
      {months.map((m) => (
        <option key={m.id} value={m.id}>
          {monthLabel(m.year, m.month)}
        </option>
      ))}
    </select>
  )
}

export function NewMonthButton({ onCreated }: { onCreated: () => void }) {
  const [creating, setCreating] = React.useState(false)
  async function add() {
    const nxt = nextMonth()
    const yearStr = prompt('年（西暦）を入力', String(nxt.year))
    if (!yearStr) return
    const monthStr = prompt('月（1〜12）を入力', String(nxt.month))
    if (!monthStr) return
    const y = parseInt(yearStr, 10)
    const m = parseInt(monthStr, 10)
    if (!y || !m || m < 1 || m > 12) {
      alert('入力が不正です')
      return
    }
    setCreating(true)
    try {
      await getOrCreateMonth(y, m)
      onCreated()
    } finally {
      setCreating(false)
    }
  }
  return (
    <Button size="sm" variant="outline" onClick={add} disabled={creating}>
      {creating ? '作成中…' : '+ 月を追加'}
    </Button>
  )
}
