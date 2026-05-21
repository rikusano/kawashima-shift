import * as React from 'react'
import { AdminGate, AdminShell } from '@/components/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  createDriver,
  deleteDriver,
  listDrivers,
  updateDriver,
} from '@/lib/api'
import type { Driver } from '@/lib/types'

export default function AdminDriversPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  )
}

function Inner() {
  const { push } = useToast()
  const [drivers, setDrivers] = React.useState<Driver[]>([])
  const [newName, setNewName] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  async function reload() {
    setLoading(true)
    try {
      setDrivers(await listDrivers())
    } finally {
      setLoading(false)
    }
  }
  React.useEffect(() => {
    reload()
  }, [])

  async function add() {
    const name = newName.trim()
    if (!name) return
    try {
      const max = drivers.reduce((m, d) => Math.max(m, d.sort_order), 0)
      await createDriver(name, max + 10)
      setNewName('')
      push(`${name} を追加しました`, 'success')
      reload()
    } catch (e: any) {
      push(`追加失敗: ${e.message}`, 'error')
    }
  }

  async function move(d: Driver, dir: -1 | 1) {
    const idx = drivers.findIndex((x) => x.id === d.id)
    const swap = drivers[idx + dir]
    if (!swap) return
    await Promise.all([
      updateDriver(d.id, { sort_order: swap.sort_order }),
      updateDriver(swap.id, { sort_order: d.sort_order }),
    ])
    reload()
  }

  async function rename(d: Driver) {
    const next = prompt('新しい名前', d.name)
    if (!next || next.trim() === d.name) return
    await updateDriver(d.id, { name: next.trim() })
    reload()
  }

  async function toggleActive(d: Driver) {
    await updateDriver(d.id, { active: !d.active })
    reload()
  }

  async function remove(d: Driver) {
    if (!confirm(`${d.name} を削除しますか？\n※ 過去の割当データもこのドライバーへの紐付けが失われます`))
      return
    try {
      await deleteDriver(d.id)
      push('削除しました', 'success')
      reload()
    } catch (e: any) {
      push(`削除失敗: ${e.message}`, 'error')
    }
  }

  return (
    <AdminShell title="名簿管理">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="新しいドライバー名"
            />
            <Button onClick={add} disabled={!newName.trim()}>
              追加
            </Button>
          </div>

          {loading ? (
            <div className="text-slate-500">読み込み中…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-2 w-10">#</th>
                    <th className="py-2 pr-2">名前</th>
                    <th className="py-2 pr-2 w-16">状態</th>
                    <th className="py-2 pr-2 w-[280px] text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-1.5 pr-2 font-medium">{d.name}</td>
                      <td className="py-1.5 pr-2">
                        {d.active ? (
                          <span className="text-emerald-700">有効</span>
                        ) : (
                          <span className="text-slate-400">無効</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => move(d, -1)} title="上へ">
                            ↑
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => move(d, 1)} title="下へ">
                            ↓
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rename(d)}>
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(d)}
                          >
                            {d.active ? '停止' : '再開'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(d)}
                            className="text-rose-600"
                          >
                            削除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  )
}
