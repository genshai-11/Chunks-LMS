import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { StaffGate } from './auth/StaffGate'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/HomePage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminCoursesPage } from './pages/admin/AdminCoursesPage'
import { AdminClassesPage } from './pages/admin/AdminClassesPage'
import { AdminPeoplePage } from './pages/admin/AdminPeoplePage'
import { AdminEnrollmentsPage } from './pages/admin/AdminEnrollmentsPage'
import { AdminMetricsPage } from './pages/admin/AdminMetricsPage'
import { AdminAnalysisPage } from './pages/admin/AdminAnalysisPage'
import { AdminOpsPage } from './pages/admin/AdminOpsPage'
import { AdminAttendancePage } from './pages/admin/AdminAttendancePage'
import { AdminAuditPage } from './pages/admin/AdminAuditPage'
import { AdminIntegrityPage } from './pages/admin/AdminIntegrityPage'
import { TeacherLayout } from './pages/teacher/TeacherLayout'
import { TeacherOverviewPage } from './pages/teacher/TeacherOverviewPage'
import { TeacherCalendarPage } from './pages/teacher/TeacherCalendarPage'
import { TeacherSessionPage } from './pages/teacher/TeacherSessionPage'
import { TeacherObservePage } from './pages/teacher/TeacherObservePage'
import { TeacherAnalysisPage } from './pages/teacher/TeacherAnalysisPage'
import { TeacherArchivePage } from './pages/teacher/TeacherArchivePage'
import { LearnerLayout } from './pages/learner/LearnerLayout'
import { LearnerOverviewPage } from './pages/learner/LearnerOverviewPage'
import { LearnerEnrollmentsPage } from './pages/learner/LearnerEnrollmentsPage'
import { LearnerAttendancePage } from './pages/learner/LearnerAttendancePage'
import { LearnerAnalysisPage } from './pages/learner/LearnerAnalysisPage'
import { LearnerAccessPage } from './pages/LearnerAccessPage'
import { AppStateProvider } from './state/AppState'

export default function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/access" element={<LearnerAccessPage />} />

              <Route
                path="/admin"
                element={
                  <StaffGate role="admin">
                    <AdminLayout />
                  </StaffGate>
                }
              >
                <Route index element={<AdminOverviewPage />} />
                <Route path="ops" element={<AdminOpsPage />} />
                <Route path="attendance" element={<AdminAttendancePage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="integrity" element={<AdminIntegrityPage />} />
                <Route path="courses" element={<AdminCoursesPage />} />
                <Route path="classes" element={<AdminClassesPage />} />
                <Route path="people" element={<AdminPeoplePage />} />
                <Route path="enrollments" element={<AdminEnrollmentsPage />} />
                <Route path="analysis" element={<AdminAnalysisPage />} />
                <Route path="metrics" element={<AdminMetricsPage />} />
              </Route>

              <Route
                path="/teacher/observe"
                element={
                  <StaffGate role="teacher">
                    <TeacherObservePage />
                  </StaffGate>
                }
              />

              <Route
                path="/teacher"
                element={
                  <StaffGate role="teacher">
                    <TeacherLayout />
                  </StaffGate>
                }
              >
                <Route index element={<TeacherOverviewPage />} />
                <Route path="calendar" element={<TeacherCalendarPage />} />
                <Route path="session" element={<TeacherSessionPage />} />
                <Route path="archive" element={<TeacherArchivePage />} />
                <Route path="analysis" element={<TeacherAnalysisPage />} />
                <Route path="progress" element={<Navigate to="/teacher/analysis" replace />} />
              </Route>

              {/* Learner portal — share link only; no Clerk */}
              <Route path="/learner" element={<LearnerLayout />}>
                <Route index element={<LearnerOverviewPage />} />
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
