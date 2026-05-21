import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui/toast'
import { Card, CardContent } from './components/ui/card'
import DriverPage from './pages/DriverPage'
import AdminPage from './pages/AdminPage'
import AdminAssignPage from './pages/AdminAssignPage'
import AdminDriversPage from './pages/AdminDriversPage'
import AdminCoursesPage from './pages/AdminCoursesPage'
import AdminMonthsPage from './pages/AdminMonthsPage'

function Home() {
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-center">川島センター シフト管理</h1>
        <p className="text-center text-slate-500 text-sm">
          用途に合わせて入り口を選んでください
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/driver">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="text-lg font-semibold mb-1">ドライバーの方</div>
                <div className="text-sm text-slate-500">
                  来月の出勤可否を入力する
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="text-lg font-semibold mb-1">管理者</div>
                <div className="text-sm text-slate-500">
                  回答状況の確認・シフト割当
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/driver" element={<DriverPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/assign" element={<AdminAssignPage />} />
        <Route path="/admin/drivers" element={<AdminDriversPage />} />
        <Route path="/admin/courses" element={<AdminCoursesPage />} />
        <Route path="/admin/months" element={<AdminMonthsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
