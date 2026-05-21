import * as React from 'react'
import { AdminGate, AdminShell } from '@/components/AdminShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from '@/lib/api'
import type { Course } from '@/lib/types'

export default function AdminCoursesPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  )
}

function Inner() {
  const { push } = useToast()
  const [courses, setCourses] = React.useState<Course[]>([])
  const [newName, setNewName] = React.useState('')
  const [loading, setLoading] = React.useState(true)

  async function reload() {
    setLoading(true)
    try {
      setCourses(await listCourses())
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
      const max = courses.reduce((m, c) => Math.max(m, c.sort_order), 0)
      await createCourse(name, max + 10)
      setNewName('')
      push(`${name} を追加しました`, 'success')
      reload()
    } catch (e: any) {
      push(`追加失敗: ${e.message}`, 'error')
    }
  }

  async function move(c: Course, dir: -1 | 1) {
    const idx = courses.findIndex((x) => x.id === c.id)
    const swap = courses[idx + dir]
    if (!swap) return
    await Promise.all([
      updateCourse(c.id, { sort_order: swap.sort_order }),
      updateCourse(swap.id, { sort_order: c.sort_order }),
    ])
    reload()
  }

  async function rename(c: Course) {
    const next = prompt('新しいコース名', c.name)
    if (!next || next.trim() === c.name) return
    await updateCourse(c.id, { name: next.trim() })
    reload()
  }

  async function toggleActive(c: Course) {
    await updateCourse(c.id, { active: !c.active })
    reload()
  }

  async function remove(c: Course) {
    if (!confirm(`${c.name} を削除しますか？`)) return
    try {
      await deleteCourse(c.id)
      push('削除しました', 'success')
      reload()
    } catch (e: any) {
      push(`削除失敗: ${e.message}`, 'error')
    }
  }

  return (
    <AdminShell title="コース管理">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 mb-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="新しいコース名（例：鶴ヶ峰1.川島(大)）"
            />
            <Button onClick={add} disabled={!newName.trim()}>
              追加
            </Button>
          </div>

          <div className="text-xs text-slate-500 mb-2">
            ※ ここで作成したコースを、月設定ページで月ごとに有効化・並び替えできます。
          </div>

          {loading ? (
            <div className="text-slate-500">読み込み中…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-2 w-10">#</th>
                    <th className="py-2 pr-2">コース名</th>
                    <th className="py-2 pr-2 w-16">状態</th>
                    <th className="py-2 pr-2 w-[280px] text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c, i) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-1.5 pr-2 font-medium">{c.name}</td>
                      <td className="py-1.5 pr-2">
                        {c.active ? (
                          <span className="text-emerald-700">有効</span>
                        ) : (
                          <span className="text-slate-400">無効</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => move(c, -1)} title="上へ">
                            ↑
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => move(c, 1)} title="下へ">
                            ↓
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => rename(c)}>
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(c)}
                          >
                            {c.active ? '停止' : '再開'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(c)}
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
