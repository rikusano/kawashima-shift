import * as React from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined
const STORAGE_KEY = 'kawashima-admin-auth'

export function AdminGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = React.useState(false)
  const [pw, setPw] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!ADMIN_PW) {
      setOk(true)
      return
    }
    if (sessionStorage.getItem(STORAGE_KEY) === ADMIN_PW) setOk(true)
  }, [])

  if (ok) return <>{children}</>

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-lg font-semibold">管理者ログイン</h1>
        <Input
          type="password"
          autoFocus
          placeholder="パスワード"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (pw === ADMIN_PW) {
                sessionStorage.setItem(STORAGE_KEY, pw)
                setOk(true)
              } else setError('パスワードが違います')
            }
          }}
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button
          onClick={() => {
            if (pw === ADMIN_PW) {
              sessionStorage.setItem(STORAGE_KEY, pw)
              setOk(true)
            } else setError('パスワードが違います')
          }}
          className="w-full"
        >
          ログイン
        </Button>
      </div>
    </div>
  )
}

export function AdminShell({
  title,
  actions,
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const nav = useNavigate()
  return (
    <div className="min-h-full">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <Link to="/admin" className="text-base font-bold">
            川島センター 管理画面
          </Link>
          <nav className="flex gap-1 text-sm">
            <Tab to="/admin">サマリー</Tab>
            <Tab to="/admin/assign">シフト割当</Tab>
            <Tab to="/admin/drivers">名簿</Tab>
            <Tab to="/admin/courses">コース</Tab>
            <Tab to="/admin/months">月設定</Tab>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-bold">{title}</h1>
          <div className="flex gap-2">
            {actions}
            <Button size="sm" variant="ghost" onClick={() => nav('/')}>
              トップへ
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}

function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'px-3 py-1.5 rounded-md',
          isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
        )
      }
    >
      {children}
    </NavLink>
  )
}
