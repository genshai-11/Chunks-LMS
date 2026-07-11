import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage'
import { AdminClassesPage } from './pages/admin/AdminClassesPage'
import { AdminPeoplePage } from './pages/admin/AdminPeoplePage'
import { AdminEnrollmentsPage } from './pages/admin/AdminEnrollmentsPage'
import { AdminMetricsPage } from './pages/admin/AdminMetricsPage'
import { TeacherLayout } from './pages/teacher/TeacherLayout'
import { TeacherCalendarPage } from './pages/teacher/TeacherCalendarPage'
import { TeacherSessionPage } from './pages/teacher/TeacherSessionPage'
import { TeacherObservePage } from './pages/teacher/TeacherObservePage'
import { TeacherAnalysisPage } from './pages/teacher/TeacherAnalysisPage'
import { LearnerLayout } from './pages/learner/LearnerLayout'
import { LearnerEnrollmentsPage } from './pages/learner/LearnerEnrollmentsPage'
import { LearnerAttendancePage } from './pages/learner/LearnerAttendancePage'
import { LearnerAnalysisPage } from './pages/learner/LearnerAnalysisPage'
import { AppStateProvider } from './state/AppState'

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />

              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="courses" replace />} />
                <Route path="courses" element={<AdminCoursesPage />} />
                <Route path="classes" element={<AdminClassesPage />} />
                <Route path="people" element={<AdminPeoplePage />} />
                <Route path="enrollments" element={<AdminEnrollmentsPage />} />
                <Route path="metrics" element={<AdminMetricsPage />} />
              </Route>

              <Route path="/teacher/observe" element={<TeacherObservePage />} />

              <Route path="/teacher" element={<TeacherLayout />}>
                <Route index element={<Navigate to="session" replace />} />
                <Route path="calendar" element={<TeacherCalendarPage />} />
                <Route path="session" element={<TeacherSessionPage />} />
                <Route path="analysis" element={<TeacherAnalysisPage />} />
                <Route path="progress" element={<Navigate to="/teacher/analysis" replace />} />
              </Route>

              <Route path="/learner" element={<LearnerLayout />}>
                <Route index element={<Navigate to="enrollments" replace />} />
                <Route path="enrollments" element={<LearnerEnrollmentsPage />} />
                <Route path="attendance" element={<LearnerAttendancePage />} />
                <Route path="results" element={<Navigate to="/learner/analysis" replace />} />
                <Route path="analysis" element={<LearnerAnalysisPage />} />
                <Route path="progress" element={<Navigate to="/learner/analysis" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AppStateProvider>
    </AuthProvider>
  )
}
