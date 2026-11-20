import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute } from './components/guards/ProtectedRoute';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

import LandingPage from './pages/LandingPage';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const CollaborationRequestsPage = lazy(() => import('./pages/CollaborationRequestsPage'));
const CollaborationWorkspacePage = lazy(() => import('./pages/CollaborationWorkspacePage'));
const CreateIdeaPage = lazy(() => import('./pages/CreateIdeaPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EditIdeaPage = lazy(() => import('./pages/EditIdeaPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const ExploreIdeasPage = lazy(() => import('./pages/ExploreIdeasPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const IdeaDetailsPage = lazy(() => import('./pages/IdeaDetailsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const MessagingPage = lazy(() => import('./pages/MessagingPage'));
const MyIdeasPage = lazy(() => import('./pages/MyIdeasPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ReportIdeaPage = lazy(() => import('./pages/ReportIdeaPage'));
const SavedIdeasPage = lazy(() => import('./pages/SavedIdeasPage'));
const SecuritySettingsPage = lazy(() => import('./pages/SecuritySettingsPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));

function PageLoader() {
  return (
    <div className="min-h-[55vh] flex items-center justify-center">
      <div className="h-9 w-9 rounded-full border-3 border-[#6E05F2]/20 border-t-[#6E05F2] animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <div className="min-h-screen flex flex-col bg-[#F8F9FC] text-[#171717]">
              <Navbar />
              <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/explore" element={<ExploreIdeasPage />} />
                    <Route path="/ideas/:id" element={<IdeaDetailsPage />} />
                    <Route path="/users/:id" element={<UserProfilePage />} />

                    {/* Authenticated Builder Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <DashboardPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ideas/new"
                      element={
                        <ProtectedRoute>
                          <CreateIdeaPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ideas/:id/edit"
                      element={
                        <ProtectedRoute>
                          <EditIdeaPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/saved-ideas"
                      element={
                        <ProtectedRoute>
                          <SavedIdeasPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/my-ideas"
                      element={
                        <ProtectedRoute>
                          <MyIdeasPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/requests"
                      element={
                        <ProtectedRoute>
                          <CollaborationRequestsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/workspaces"
                      element={
                        <ProtectedRoute>
                          <CollaborationWorkspacePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/workspaces/:id"
                      element={
                        <ProtectedRoute>
                          <CollaborationWorkspacePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messages"
                      element={
                        <ProtectedRoute>
                          <MessagingPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/messages/:conversationId"
                      element={
                        <ProtectedRoute>
                          <MessagingPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/notifications"
                      element={
                        <ProtectedRoute>
                          <NotificationsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/profile"
                      element={
                        <ProtectedRoute>
                          <EditProfilePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings/security"
                      element={
                        <ProtectedRoute>
                          <SecuritySettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/report"
                      element={
                        <ProtectedRoute>
                          <ReportIdeaPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/ideas/:id/report"
                      element={
                        <ProtectedRoute>
                          <ReportIdeaPage />
                        </ProtectedRoute>
                      }
                    />

                    {/* Role-Based Admin Route */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminDashboardPage />
                        </AdminRoute>
                      }
                    />

                    {/* 404 Not Found */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </main>
              <Footer />
            </div>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
