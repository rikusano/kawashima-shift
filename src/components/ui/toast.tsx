import * as React from 'react'

type Toast = { id: number; message: string; kind: 'info' | 'success' | 'error' }
const Ctx = React.createContext<{ push: (m: string, kind?: Toast['kind']) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const push = React.useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'px-4 py-2 rounded-md shadow-lg text-sm text-white ' +
              (t.kind === 'error'
                ? 'bg-red-600'
                : t.kind === 'success'
                  ? 'bg-emerald-600'
                  : 'bg-slate-800')
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
