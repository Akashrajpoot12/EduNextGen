import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AccountSettingsPage } from "./pages/shared/AccountSettingsPage";
import { AdmissionFormPage } from "./pages/public/AdmissionFormPage";
import { PTMPage } from "./pages/admin/PTMPage";
import { TeacherDiaryPage } from "./pages/teacher/TeacherDiaryPage";
import { ParentDiaryPage } from "./pages/parent/ParentDiaryPage";
import { StudentProfileView } from "./pages/admin/StudentProfileView";
import { MessageTemplatesPage } from "./pages/admin/MessageTemplatesPage";
import { ThemeProvider } from "next-themes";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { LoginForm } from "./components/auth/login-form";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

import { SuperAdminLoginForm } from "./components/auth/super-admin-login-form";

import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { StudentsDirectory } from "./pages/admin/StudentsDirectory";
import { TeachersDirectory } from "./pages/admin/TeachersDirectory";
import { AttendancePage } from "./pages/admin/AttendancePage";
import { AdmissionsPage } from "./pages/admin/AdmissionsPage";
import { AnalyticsPage } from "./pages/admin/AnalyticsPage";
import { AnnouncementsPage } from "./pages/admin/AnnouncementsPage";
import { CertificatesPage } from "./pages/admin/CertificatesPage";
import { ClassesPage } from "./pages/admin/ClassesPage";
import { CommunicationPage } from "./pages/admin/CommunicationPage";
import { DocumentsPage } from "./pages/admin/DocumentsPage";
import { ExamsPage } from "./pages/admin/ExamsPage";
// Lazy: pulls in face-api.js + TensorFlow (~MBs) only when an admin opens this route.
const FaceAiPage = lazy(() => import("./pages/admin/FaceAiPage").then(m => ({ default: m.FaceAiPage })));
import { FeesPage } from "./pages/admin/FeesPage";
import { HomeworkPage } from "./pages/admin/HomeworkPage";
import { InventoryPage } from "./pages/admin/InventoryPage";
import { LeavesPage } from "./pages/admin/LeavesPage";
import { PayrollPage } from "./pages/admin/PayrollPage";
import { StaffPage } from "./pages/admin/StaffPage";
import { SubscriptionPage } from "./pages/admin/SubscriptionPage";
import { SyllabusPage } from "./pages/admin/SyllabusPage";
import { TimetablePage } from "./pages/admin/TimetablePage";
import { TransportPage } from "./pages/admin/TransportPage";
import { CalendarPage } from "./pages/admin/CalendarPage";
import { LibraryPage } from "./pages/admin/LibraryPage";
import { HealthPage } from "./pages/admin/HealthPage";
import { StaffAttendancePage } from "./pages/admin/StaffAttendancePage";
import { ClassPromotionPage } from "./pages/admin/ClassPromotionPage";
import { IDCardsPage } from "./pages/admin/IDCardsPage";
import { RollListPage } from "./pages/admin/RollListPage";
import { FeeChallanPage } from "./pages/admin/FeeChallanPage";
import { ParentCommPage } from "./pages/admin/ParentCommPage";
import { HallTicketPage } from "./pages/admin/HallTicketPage";
import { MarksAnalysisPage } from "./pages/admin/MarksAnalysisPage";
import { SiblingDiscountPage } from "./pages/admin/SiblingDiscountPage";
import { BusPassPage } from "./pages/admin/BusPassPage";
import { LibraryCardPage } from "./pages/admin/LibraryCardPage";
import { LedgerPage } from "./pages/admin/LedgerPage";
import { BulkMessagesPage } from "./pages/admin/BulkMessagesPage";
import { BiometricPage } from "./pages/admin/BiometricPage";
import { OnlinePaymentPage } from "./pages/admin/OnlinePaymentPage";
import { AlumniPage } from "./pages/admin/AlumniPage";
import { HostelPage } from "./pages/admin/HostelPage";
import { GpsTrackingPage } from "./pages/admin/GpsTrackingPage";
import { QuestionBankPage } from "./pages/admin/QuestionBankPage";
import { TCPage } from "./pages/admin/TCPage";
import { ReportCardPage } from "./pages/admin/ReportCardPage";
import { VisitorLogPage } from "./pages/admin/VisitorLogPage";
import { GatePassPage } from "./pages/admin/GatePassPage";
import { ChequePage } from "./pages/admin/ChequePage";
import { StaffLeaveBalancePage } from "./pages/admin/StaffLeaveBalancePage";
import { BonafidePage } from "./pages/admin/BonafidePage";
import { ComplaintPage } from "./pages/admin/ComplaintPage";
import { FeeReceiptPage } from "./pages/admin/FeeReceiptPage";
import { CircularPage } from "./pages/admin/CircularPage";
import { AdmissionRegisterPage } from "./pages/admin/AdmissionRegisterPage";
import { ScholarshipPage } from "./pages/admin/ScholarshipPage";
import { DutyRosterPage } from "./pages/admin/DutyRosterPage";
import { ExamDateSheetPage } from "./pages/admin/ExamDateSheetPage";

import { TeacherDashboard } from "./pages/teacher/TeacherDashboard";
import { TeacherAttendancePage } from "./pages/teacher/TeacherAttendancePage";
import { TeacherHomeworkPage } from "./pages/teacher/TeacherHomeworkPage";
import { TeacherLeavesPage } from "./pages/teacher/TeacherLeavesPage";
import { TeacherTimetablePage } from "./pages/teacher/TeacherTimetablePage";
import { TeacherGradebookPage } from "./pages/teacher/TeacherGradebookPage";
import { TeacherNoticesPage } from "./pages/teacher/TeacherNoticesPage";
import { TeacherSyllabusPage } from "./pages/teacher/TeacherSyllabusPage";
import { TeacherStudentsPage } from "./pages/teacher/TeacherStudentsPage";
import { TeacherSubmissionsPage } from "./pages/teacher/TeacherSubmissionsPage";
import { TeacherMarksHistoryPage } from "./pages/teacher/TeacherMarksHistoryPage";
import { TeacherAttendanceReportPage } from "./pages/teacher/TeacherAttendanceReportPage";
import { TeacherMessagesPage } from "./pages/teacher/TeacherMessagesPage";
import { TeacherPerformancePage } from "./pages/teacher/TeacherPerformancePage";
import { TeacherNotificationsPage } from "./pages/teacher/TeacherNotificationsPage";

import { StudentDashboard } from "./pages/student/StudentDashboard";
import { StudentHomeworkPage } from "./pages/student/StudentHomeworkPage";
import { StudentNoticesPage } from "./pages/student/StudentNoticesPage";
import { StudentTimetablePage } from "./pages/student/StudentTimetablePage";
import { StudentMarksPage } from "./pages/student/StudentMarksPage";
import { StudentAttendancePage } from "./pages/student/StudentAttendancePage";
import { StudentFeesPage } from "./pages/student/StudentFeesPage";
import { StudentLeavePage } from "./pages/student/StudentLeavePage";
import { StudentMessagesPage } from "./pages/student/StudentMessagesPage";
import { StudentDocumentsPage } from "./pages/student/StudentDocumentsPage";

import { ParentDashboard } from "./pages/parent/ParentDashboard";
import { ParentFeesPage } from "./pages/parent/ParentFeesPage";
import { ParentInboxPage } from "./pages/parent/ParentInboxPage";
import { ParentTransportPage } from "./pages/parent/ParentTransportPage";
import { ParentAttendancePage } from "./pages/parent/ParentAttendancePage";
import { ParentMarksPage } from "./pages/parent/ParentMarksPage";
import { ParentHomeworkPage } from "./pages/parent/ParentHomeworkPage";
import { ParentTimetablePage } from "./pages/parent/ParentTimetablePage";
import { ParentLeavePage } from "./pages/parent/ParentLeavePage";

import { SuperAdminDashboard } from "./pages/super-admin/SuperAdminDashboard";
import SetupPage from "./pages/SetupPage";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/super-admin/login" replace />} />

          {/* Public Online Admission Form — no login required */}
          <Route path="/:tenantId/apply" element={<AdmissionFormPage />} />

          {/* First-time school admin setup (uses invite token, no auth required) */}
          <Route path="/setup" element={<SetupPage />} />
          
          {/* Global Super Admin Authentication */}
          <Route path="/super-admin/login" element={
            <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-4">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 blur-[120px] pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
              <div className="z-10">
                <SuperAdminLoginForm />
              </div>
            </div>
          } />

          {/* Global Super Admin Dashboard with Guard */}
          <Route path="/super-admin" element={
            <ProtectedRoute isSuperAdminRoute={true}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />
          
          {/* Auth Routes */}
          <Route path="/:tenantId/login" element={
            <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-4">
              {/* Dynamic decorative background elements for premium feel */}
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
              <div className="z-10">
                <LoginForm />
              </div>
            </div>
          } />

          {/* Dashboard Portal Layout */}
          <Route path="/:tenantId" element={<DashboardLayout />}>
            
            {/* School Admin Portal Route Group */}
            <Route path="admin" element={
              <ProtectedRoute allowedRoles={["school_admin", "admin", "staff"]}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<StudentsDirectory />} />
              <Route path="students/:studentId" element={<StudentProfileView />} />
              <Route path="teachers" element={<TeachersDirectory />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="admissions" element={<AdmissionsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="communication" element={<CommunicationPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="exams" element={<ExamsPage />} />
              <Route path="face-ai" element={<Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Face AI…</div>}><FaceAiPage /></Suspense>} />
              <Route path="fees" element={<FeesPage />} />
              <Route path="homework" element={<HomeworkPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="leaves" element={<LeavesPage />} />
              <Route path="payroll" element={<PayrollPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
              <Route path="syllabus" element={<SyllabusPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="transport" element={<TransportPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="ptm" element={<PTMPage />} />
              <Route path="message-templates" element={<MessageTemplatesPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="health" element={<HealthPage />} />
              <Route path="staff-attendance" element={<StaffAttendancePage />} />
              <Route path="class-promotion" element={<ClassPromotionPage />} />
              <Route path="id-cards" element={<IDCardsPage />} />
              <Route path="roll-list" element={<RollListPage />} />
              <Route path="fee-challan" element={<FeeChallanPage />} />
              <Route path="parent-log" element={<ParentCommPage />} />
              <Route path="hall-tickets" element={<HallTicketPage />} />
              <Route path="marks-analysis" element={<MarksAnalysisPage />} />
              <Route path="sibling-discount" element={<SiblingDiscountPage />} />
              <Route path="bus-pass" element={<BusPassPage />} />
              <Route path="library-cards" element={<LibraryCardPage />} />
              <Route path="ledger" element={<LedgerPage />} />
              <Route path="bulk-messages" element={<BulkMessagesPage />} />
              <Route path="biometric" element={<BiometricPage />} />
              <Route path="online-payment" element={<OnlinePaymentPage />} />
              <Route path="alumni" element={<AlumniPage />} />
              <Route path="hostel" element={<HostelPage />} />
              <Route path="gps-tracking" element={<GpsTrackingPage />} />
              <Route path="question-bank" element={<QuestionBankPage />} />
              <Route path="tc" element={<TCPage />} />
              <Route path="report-card" element={<ReportCardPage />} />
              <Route path="visitor-log" element={<VisitorLogPage />} />
              <Route path="gate-pass" element={<GatePassPage />} />
              <Route path="cheque" element={<ChequePage />} />
              <Route path="leave-balance" element={<StaffLeaveBalancePage />} />
              <Route path="bonafide" element={<BonafidePage />} />
              <Route path="complaints" element={<ComplaintPage />} />
              <Route path="fee-receipt" element={<FeeReceiptPage />} />
              <Route path="circulars" element={<CircularPage />} />
              <Route path="admission-register" element={<AdmissionRegisterPage />} />
              <Route path="scholarships" element={<ScholarshipPage />} />
              <Route path="duty-roster" element={<DutyRosterPage />} />
              <Route path="exam-datesheet" element={<ExamDateSheetPage />} />
              <Route path="profile" element={<AccountSettingsPage />} />
            </Route>
            
            {/* Teacher Portal Route Group */}
            <Route path="teacher" element={
              <ProtectedRoute allowedRoles={["teacher"]}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route index element={<TeacherDashboard />} />
              <Route path="attendance" element={<TeacherAttendancePage />} />
              <Route path="homework" element={<TeacherHomeworkPage />} />
              <Route path="leaves" element={<TeacherLeavesPage />} />
              <Route path="timetable" element={<TeacherTimetablePage />} />
              <Route path="gradebook" element={<TeacherGradebookPage />} />
              <Route path="notices" element={<TeacherNoticesPage />} />
              <Route path="syllabus" element={<TeacherSyllabusPage />} />
              <Route path="students" element={<TeacherStudentsPage />} />
              <Route path="profile" element={<AccountSettingsPage />} />
              <Route path="submissions" element={<TeacherSubmissionsPage />} />
              <Route path="marks-history" element={<TeacherMarksHistoryPage />} />
              <Route path="attendance-report" element={<TeacherAttendanceReportPage />} />
              <Route path="messages" element={<TeacherMessagesPage />} />
              <Route path="performance" element={<TeacherPerformancePage />} />
              <Route path="notifications" element={<TeacherNotificationsPage />} />
              <Route path="diary" element={<TeacherDiaryPage />} />
            </Route>

            {/* Student Portal Route Group */}
            <Route path="student" element={
              <ProtectedRoute allowedRoles={["student"]}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route index element={<StudentDashboard />} />
              <Route path="homework" element={<StudentHomeworkPage />} />
              <Route path="notices" element={<StudentNoticesPage />} />
              <Route path="timetable" element={<StudentTimetablePage />} />
              <Route path="marks" element={<StudentMarksPage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="profile" element={<AccountSettingsPage />} />
              <Route path="fees" element={<StudentFeesPage />} />
              <Route path="leaves" element={<StudentLeavePage />} />
              <Route path="messages" element={<StudentMessagesPage />} />
              <Route path="documents" element={<StudentDocumentsPage />} />
            </Route>

            {/* Parent Portal Route Group */}
            <Route path="parent" element={
              <ProtectedRoute allowedRoles={["parent"]}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route index element={<ParentDashboard />} />
              <Route path="fees" element={<ParentFeesPage />} />
              <Route path="inbox" element={<ParentInboxPage />} />
              <Route path="transport" element={<ParentTransportPage />} />
              <Route path="attendance" element={<ParentAttendancePage />} />
              <Route path="marks" element={<ParentMarksPage />} />
              <Route path="homework" element={<ParentHomeworkPage />} />
              <Route path="timetable" element={<ParentTimetablePage />} />
              <Route path="leaves" element={<ParentLeavePage />} />
              <Route path="profile" element={<AccountSettingsPage />} />
              <Route path="diary" element={<ParentDiaryPage />} />
            </Route>
            
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
