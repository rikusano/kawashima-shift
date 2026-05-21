import * as React from 'react'
import { AdminGate, AdminShell } from '@/components/AdminShell'
import { MonthSelect, NewMonthButton, useSelectedMonth } from '@/components/MonthPicker'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  listAvailabilityForMonth,
  listDrivers,
  updateMonthStatus,
} from '@/lib/api'
import { cn, datesInMonth, monthLabel } from '@/lib/utils'
import type { Driver, DriverAvailability, MonthStatus } from '@/lib/types'

const STATUS_LABEL: Record<MonthStatus, string> = {
  collecting: '回答収集中',
  assigning: '割当中',
  confirmed: '確定',
}

export default function AdminPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  )
}

function Inner() {
  const { months, current, select, reload, loading } = useSelectedMonth()
  const { push } = useToast()
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [availability, setAvailability] = React.useState<DriverAvailability[]>([])
  const [innerLoading, setInnerLoading] = React.useState(true)

  React.useEffect(() => {
    if (!current) return
    setInnerLoading(true)
    Promise.all([listDrivers(), listAvailabilityForMonth(current.id)])
      .then(([ds, av]) => {
        setDrivers(ds)
        setAvailability(av)
      })
      .catch((e) => push(`読み込み失敗: ${e.message}`, 'error'))
      .finally(() => setInnerLoading(false))
  }, [current, push])

  if (loading) return <AdminShell title="サマリー">読み込み中…</AdminShell>
  if (!current) return <AdminShell title="サマリー">月データがありません</AdminShell>

  const totalDays = datesInMonth(current.year, current.month).length
  const respondedNames = new Set(availability.map((a) => a.driver_name))
  const rosterNames = new Set(drivers.filter((d) => d.active).map((d) => d.name))
  const unanswered = drivers.filter((d) => d.active && !respondedNames.has(d.name))
  const extras = Array.from(respondedNames).filter((n) => !rosterNames.has(n))

  const byDriver = new Map<string, DriverAvailability[]>()
  for (const a of availability) {
    const list = byDriver.get(a.driver_name) ?? []
    list.push(a)
    byDriver.set(a.driver_name, list)
  }

  function copyUnanswered() {
    const text = unanswered.map((d) => d.name).join('\n')
    navigator.clipboard.writeText(text).then(
      () => push('未回答者の名前をコピーしました', 'success'),
      () => push('コピーに失敗しました', 'error')
    )
  }

  async function setStatus(s: MonthStatus) {
    if (!current) return
    await updateMonthStatus(current.id, s)
    push(`ステータスを「${STATUS_LABEL[s]}」に変更しました`, 'success')
    reload()
  }

  return (
    <AdminShell
      title={`サマリー: ${monthLabel(current.year, current.month)}`}
      actions={
        <>
          <MonthSelect months={months} current={current} onChange={select} />
          <NewMonthButton onCreated={reload} />
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">対象月</div>
            <div className="text-2xl font-bold">
              {monthLabel(current.year, current.month)}
            </div>
            <div className="text-sm text-slate-500 mt-1">{totalDays}日</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">回答状況</div>
            <div className="text-2xl font-bold">
              {drivers.filter((d) => d.active && respondedNames.has(d.name)).length}
              <span className="text-base text-slate-400">
                {' / '}
                {drivers.filter((d) => d.active).length}名
              </span>
            </div>
            <div className="text-sm text-slate-500 mt-1">名簿登録ドライバーのうち</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-slate-500">ステータス</div>
            <div className="flex gap-1 flex-wrap mt-2">
              {(['collecting', 'assigning', 'confirmed'] as MonthStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'text-xs px-2 py-1 rounded border',
                    current.status === s
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold">ドライバー別 回答状況</h2>
            <Button size="sm" variant="outline" onClick={copyUnanswered}>
              未回答者をコピー ({unanswered.length})
            </Button>
          </div>
          {innerLoading ? (
            <div className="text-sm text-slate-500">読み込み中…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">ドライバー</th>
                    <th className="py-2 pr-3">回答数</th>
                    <th className="py-2 pr-3">出勤可</th>
                    <th className="py-2 pr-3">応相談</th>
                    <th className="py-2 pr-3">休み希望</th>
                    <th className="py-2 pr-3">最終更新</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers
                    .filter((d) => d.active)
                    .map((d) => {
                      const list = byDriver.get(d.name) ?? []
                      const ok = list.filter((x) => x.status === 'available').length
                      const maybe = list.filter((x) => x.status === 'maybe').length
                      const off = list.filter((x) => x.status === 'off').length
                      const latest = list
                        .map((x) => x.updated_at)
                        .sort()
                        .pop()
                      return (
                        <tr key={d.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 font-medium">{d.name}</td>
                          <td className="py-1.5 pr-3">
                            {list.length === 0 ? (
                              <span className="text-rose-600">未回答</span>
                            ) : (
                              `${list.length}件`
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-emerald-700">{ok}</td>
                          <td className="py-1.5 pr-3 text-amber-700">{maybe}</td>
                          <td className="py-1.5 pr-3 text-rose-700">{off}</td>
                          <td className="py-1.5 pr-3 text-slate-500 text-xs">
                            {latest ? new Date(latest).toLocaleString('ja-JP') : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  {extras.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={6} className="pt-3 pb-1 text-xs text-slate-500">
                          名簿外からの回答
                        </td>
                      </tr>
                      {extras.map((name) => {
                        const list = byDriver.get(name) ?? []
                        return (
                          <tr key={name} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-medium text-amber-700">
                              {name} ⚠
                            </td>
                            <td className="py-1.5 pr-3">{list.length}件</td>
                            <td className="py-1.5 pr-3" colSpan={4} />
                          </tr>
                        )
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
