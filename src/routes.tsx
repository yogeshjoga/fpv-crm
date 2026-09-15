import { Navigate, Route, Routes } from 'react-router-dom';

import { PublicShell } from './layout/PublicShell';
import { Shell } from './layout/Shell';
import { studentNav, adminNav } from './layout/navConfig';
import { RequireActive, RequireModule, RequireRole } from './auth/guards';

import { Landing } from './pages/public/Landing';
import { Login } from './pages/public/Login';
import { RegisterLanding } from './pages/public/RegisterLanding';
import { PublicRegistrationForm } from './pages/public/PublicRegistrationForm';
import { SetPassword } from './pages/public/SetPassword';
import { ForgotPassword } from './pages/public/ForgotPassword';
import { ResetPassword } from './pages/public/ResetPassword';
import { AwaitingActivation } from './pages/public/AwaitingActivation';
import { AuthCallback } from './pages/public/AuthCallback';
import { VerifyCertificate } from './pages/public/VerifyCertificate';
import { EnrollmentForm } from './pages/public/EnrollmentForm';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { CourseCatalog } from './pages/student/CourseCatalog';
import { CourseViewer } from './pages/student/CourseViewer';
import { ExamFlow } from './pages/student/ExamFlow';
import { StudentCertificates } from './pages/student/StudentCertificates';
import { StudentProfile } from './pages/student/StudentProfile';
import { Ask } from './pages/student/Ask';
import { Showcase } from './pages/student/Showcase';
import { StudentCalendar } from './pages/student/StudentCalendar';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { Registrations } from './pages/admin/Registrations';
import { Approvals } from './pages/admin/Approvals';
import { Users } from './pages/admin/Users';
import { AdminCourses } from './pages/admin/AdminCourses';
import { CourseGroups } from './pages/admin/CourseGroups';
import { AdminHelp } from './pages/admin/AdminHelp';
import { CourseBuilder } from './pages/admin/CourseBuilder';
import { QuestionBank } from './pages/admin/QuestionBank';
import { Forms } from './pages/admin/Forms';
import { FormBuilder } from './pages/admin/FormBuilder';
import { FormResponses } from './pages/admin/FormResponses';
import { EnrollmentRequests } from './pages/admin/EnrollmentRequests';
import { AdminCertificates } from './pages/admin/AdminCertificates';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminAsk } from './pages/admin/AdminAsk';
import { Settings } from './pages/admin/Settings';
import { Employees } from './pages/admin/Employees';
import { AdminCalendar } from './pages/admin/AdminCalendar';
import { Notifications } from './pages/admin/Notifications';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterLanding />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/awaiting-activation" element={<AwaitingActivation />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/verify/:certId" element={<VerifyCertificate />} />
      </Route>

      <Route path="/register-form/:slug" element={<PublicRegistrationForm />} />

      <Route
        path="/enroll/:slug"
        element={
          <RequireActive>
            <EnrollmentForm />
          </RequireActive>
        }
      />

      <Route
        path="/app"
        element={
          <RequireActive>
            <Shell nav={studentNav} area="Student" />
          </RequireActive>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<CourseCatalog />} />
        <Route path="courses/:slug" element={<CourseViewer />} />
        <Route path="courses/:slug/exam" element={<ExamFlow />} />
        <Route path="calendar" element={<StudentCalendar />} />
        <Route path="certificates" element={<StudentCertificates />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="ask" element={<Ask />} />
        <Route path="showcase" element={<Showcase />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole roles={['instructor', 'super_admin']}>
            <Shell nav={adminNav} area="Admin" />
          </RequireRole>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route
          path="registrations"
          element={
            <RequireModule moduleKey="registrations">
              <Registrations />
            </RequireModule>
          }
        />
        <Route
          path="approvals"
          element={
            <RequireModule moduleKey="approvals">
              <Approvals />
            </RequireModule>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={['super_admin']}>
              <Users />
            </RequireRole>
          }
        />
        <Route
          path="courses"
          element={
            <RequireModule moduleKey="courses">
              <AdminCourses />
            </RequireModule>
          }
        />
        <Route
          path="course-groups"
          element={
            <RequireModule moduleKey="course-groups">
              <CourseGroups />
            </RequireModule>
          }
        />
        <Route
          path="courses/:id/build"
          element={
            <RequireModule moduleKey="courses">
              <CourseBuilder />
            </RequireModule>
          }
        />
        <Route
          path="question-bank/:courseId"
          element={
            <RequireModule moduleKey="courses">
              <QuestionBank />
            </RequireModule>
          }
        />
        <Route
          path="forms"
          element={
            <RequireModule moduleKey="forms">
              <Forms />
            </RequireModule>
          }
        />
        <Route
          path="forms/:id/edit"
          element={
            <RequireModule moduleKey="forms">
              <FormBuilder />
            </RequireModule>
          }
        />
        <Route
          path="forms/:id/responses"
          element={
            <RequireModule moduleKey="forms">
              <FormResponses />
            </RequireModule>
          }
        />
        <Route
          path="enrollments"
          element={
            <RequireModule moduleKey="enrollments">
              <EnrollmentRequests />
            </RequireModule>
          }
        />
        <Route
          path="calendar"
          element={
            <RequireModule moduleKey="calendar">
              <AdminCalendar />
            </RequireModule>
          }
        />
        <Route
          path="notifications"
          element={
            <RequireModule moduleKey="notifications">
              <Notifications />
            </RequireModule>
          }
        />
        <Route
          path="certificates"
          element={
            <RequireModule moduleKey="certificates">
              <AdminCertificates />
            </RequireModule>
          }
        />
        <Route
          path="ask"
          element={
            <RequireModule moduleKey="ask">
              <AdminAsk />
            </RequireModule>
          }
        />
        <Route
          path="analytics"
          element={
            <RequireRole roles={['super_admin']}>
              <AdminAnalytics />
            </RequireRole>
          }
        />
        <Route
          path="employees"
          element={
            <RequireRole roles={['super_admin']}>
              <Employees />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={['super_admin']}>
              <Settings />
            </RequireRole>
          }
        />
        <Route
          path="help"
          element={
            <RequireModule moduleKey="help">
              <AdminHelp />
            </RequireModule>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
