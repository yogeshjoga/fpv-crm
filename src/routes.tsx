import { Navigate, Route, Routes } from 'react-router-dom';

import { PublicShell } from './layout/PublicShell';
import { Shell } from './layout/Shell';
import { studentNav, adminNav } from './layout/navConfig';
import { RequireActive, RequireModule, RequireRole, RequireStudentModule } from './auth/guards';

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
import { ExamReview } from './pages/student/ExamReview';
import { Careers } from './pages/student/Careers';
import { CareerJob } from './pages/student/CareerJob';
import { AdminCareers } from './pages/admin/AdminCareers';
import { AdminCareerJob } from './pages/admin/AdminCareerJob';
import { AdminOffers } from './pages/admin/AdminOffers';
import { Security } from './pages/admin/Security';
import { AdminWorkshops } from './pages/admin/AdminWorkshops';
import { AdminWorkshopDetail } from './pages/admin/AdminWorkshopDetail';
import { AdminApplicants } from './pages/admin/AdminApplicants';
import { HrEmployees } from './pages/admin/HrEmployees';
import { HrAssets } from './pages/admin/HrAssets';
import { HrAttendance } from './pages/admin/HrAttendance';
import { RoleTemplates } from './pages/admin/RoleTemplates';
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
import { StudentActivity } from './pages/admin/StudentActivity';
import { AdminHelp } from './pages/admin/AdminHelp';
import { CourseBuilder } from './pages/admin/CourseBuilder';
import { QuestionBank } from './pages/admin/QuestionBank';
import { Forms } from './pages/admin/Forms';
import { FormBuilder } from './pages/admin/FormBuilder';
import { FormResponses } from './pages/admin/FormResponses';
import { FormAnalytics } from './pages/admin/FormAnalytics';
import { EnrollmentRequests } from './pages/admin/EnrollmentRequests';
import { AdminCertificates } from './pages/admin/AdminCertificates';
import { AdminResources } from './pages/admin/AdminResources';
import { Resources } from './pages/student/Resources';
import { Reviews } from './pages/student/Reviews';
import { ReportCard } from './pages/student/ReportCard';
import { AdminReviews } from './pages/admin/AdminReviews';
import { AdminExams } from './pages/admin/AdminExams';
import { IdCards } from './pages/admin/IdCards';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminAsk } from './pages/admin/AdminAsk';
import { AdminSiteGallery } from './pages/admin/AdminSiteGallery';
import { AdminSitePartners } from './pages/admin/AdminSitePartners';
import { AdminSiteVideos } from './pages/admin/AdminSiteVideos';
import { AdminEnquiries } from './pages/admin/AdminEnquiries';
import { AdminSiteBlog } from './pages/admin/AdminSiteBlog';
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
        <Route path="courses" element={<RequireStudentModule moduleKey="courses"><CourseCatalog /></RequireStudentModule>} />
        <Route path="courses/:slug" element={<RequireStudentModule moduleKey="courses"><CourseViewer /></RequireStudentModule>} />
        <Route path="courses/:slug/exam" element={<RequireStudentModule moduleKey="courses"><ExamFlow /></RequireStudentModule>} />
        <Route path="courses/:slug/review/:attemptId" element={<RequireStudentModule moduleKey="courses"><ExamReview /></RequireStudentModule>} />
        <Route path="careers" element={<RequireStudentModule moduleKey="careers"><Careers /></RequireStudentModule>} />
        <Route path="careers/:slug" element={<RequireStudentModule moduleKey="careers"><CareerJob /></RequireStudentModule>} />
        <Route path="calendar" element={<RequireStudentModule moduleKey="calendar"><StudentCalendar /></RequireStudentModule>} />
        <Route path="resources" element={<RequireStudentModule moduleKey="resources"><Resources /></RequireStudentModule>} />
        <Route path="certificates" element={<RequireStudentModule moduleKey="certificates"><StudentCertificates /></RequireStudentModule>} />
        <Route path="report-card" element={<RequireStudentModule moduleKey="report-card"><ReportCard /></RequireStudentModule>} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="ask" element={<RequireStudentModule moduleKey="ask"><Ask /></RequireStudentModule>} />
        <Route path="reviews" element={<RequireStudentModule moduleKey="reviews"><Reviews /></RequireStudentModule>} />
        <Route path="showcase" element={<RequireStudentModule moduleKey="showcase"><Showcase /></RequireStudentModule>} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireRole roles={['instructor', 'coordinator', 'admin', 'super_admin']}>
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
          path="careers"
          element={
            <RequireModule moduleKey="careers">
              <AdminCareers />
            </RequireModule>
          }
        />
        <Route
          path="careers/applicants"
          element={
            <RequireModule moduleKey="careers">
              <AdminApplicants />
            </RequireModule>
          }
        />
        <Route
          path="careers/employees"
          element={
            <RequireModule moduleKey="careers">
              <HrEmployees />
            </RequireModule>
          }
        />
        <Route
          path="careers/assets"
          element={
            <RequireModule moduleKey="careers">
              <HrAssets />
            </RequireModule>
          }
        />
        <Route
          path="careers/attendance"
          element={
            <RequireModule moduleKey="careers">
              <HrAttendance />
            </RequireModule>
          }
        />
        <Route
          path="careers/offers"
          element={
            <RequireModule moduleKey="careers">
              <AdminOffers />
            </RequireModule>
          }
        />
        <Route
          path="careers/roles"
          element={
            <RequireModule moduleKey="careers">
              <RoleTemplates />
            </RequireModule>
          }
        />
        <Route
          path="careers/:id"
          element={
            <RequireModule moduleKey="careers">
              <AdminCareerJob />
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
          path="student-activity"
          element={
            <RequireModule moduleKey="student-activity">
              <StudentActivity />
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
          path="forms/:id/analytics"
          element={
            <RequireModule moduleKey="forms">
              <FormAnalytics />
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
          path="resources"
          element={
            <RequireModule moduleKey="resources">
              <AdminResources />
            </RequireModule>
          }
        />
        <Route
          path="exams"
          element={
            <RequireModule moduleKey="exams">
              <AdminExams />
            </RequireModule>
          }
        />
        <Route
          path="reviews"
          element={
            <RequireModule moduleKey="reviews">
              <AdminReviews />
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
          path="id-cards"
          element={
            <RequireModule moduleKey="id-cards">
              <IdCards />
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
          path="site-gallery"
          element={
            <RequireModule moduleKey="site-gallery">
              <AdminSiteGallery />
            </RequireModule>
          }
        />
        <Route
          path="enquiries"
          element={
            <RequireModule moduleKey="enquiries">
              <AdminEnquiries />
            </RequireModule>
          }
        />
        <Route
          path="site-videos"
          element={
            <RequireModule moduleKey="site-videos">
              <AdminSiteVideos />
            </RequireModule>
          }
        />
        <Route
          path="site-partners"
          element={
            <RequireModule moduleKey="site-partners">
              <AdminSitePartners />
            </RequireModule>
          }
        />
        <Route
          path="site-blog"
          element={
            <RequireRole roles={['super_admin']}>
              <AdminSiteBlog />
            </RequireRole>
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
          path="workshops"
          element={
            <RequireModule moduleKey="workshops">
              <AdminWorkshops />
            </RequireModule>
          }
        />
        <Route
          path="workshops/:id"
          element={
            <RequireModule moduleKey="workshops">
              <AdminWorkshopDetail />
            </RequireModule>
          }
        />
        <Route
          path="security"
          element={
            <RequireRole roles={['instructor', 'coordinator', 'admin', 'super_admin']}>
              <Security />
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
