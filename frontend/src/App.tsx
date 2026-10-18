import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { LandingPage } from './components/public/LandingPage';
import { OwnerCreateAccount } from './components/citizen/OwnerCreateAccount';
import { OwnerLogin } from './components/citizen/OwnerLogin';
import { OwnerDashboard } from './components/citizen/OwnerDashboard';
import { MyVehicles } from './components/citizen/MyVehicles';
import { MyChallans } from './components/citizen/MyChallans';
import { OwnerProfile } from './components/citizen/OwnerProfile';
import { VerifyReceipt } from './components/public/VerifyReceipt';
import { OfficerLogin } from './components/officer/OfficerLogin';
import { OfficerDashboard } from './components/officer/OfficerDashboard';

// Admin Portal Components
import { AdminLogin } from './components/admin/AdminLogin';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminOfficers } from './components/admin/AdminOfficers';
import { AdminOwners } from './components/admin/AdminOwners';
import { AdminVehicles } from './components/admin/AdminVehicles';
import { AdminChallans } from './components/admin/AdminChallans';
import { AdminPayments } from './components/admin/AdminPayments';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminAIMonitoring } from './components/admin/AdminAIMonitoring';
import { AdminReports } from './components/admin/AdminReports';
import { AdminAuditLogs } from './components/admin/AdminAuditLogs';
import { AdminSettings } from './components/admin/AdminSettings';

// Route guards
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('auth_token');

  if (!user || !token || token.startsWith('demo-')) {
    return <Navigate to="/admin/login" replace />;
  }

  // Strict role check: Non-admins are prevented from accessing any admin views
  if (user.role !== 'admin') {
    if (user.role === 'officer') {
      return <Navigate to="/officer/dashboard" replace />;
    }
    return <Navigate to="/citizen/dashboard" replace />;
  }

  return <>{children}</>;
};

const OfficerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('auth_token');

  if (!user || !token || token.startsWith('demo-')) {
    return <Navigate to="/officer/login" replace />;
  }

  // Route admins to their administrative command center
  if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (user.role !== 'officer') {
    return <Navigate to="/citizen/dashboard" replace />;
  }

  return <>{children}</>;
};

const OwnerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (user && user.role === 'officer') {
    return <Navigate to="/officer/dashboard" replace />;
  }
  if (user && user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <div className="min-h-screen flex flex-col bg-smart-traffic-dashboard text-[var(--text-main)] font-sans selection:bg-[#3B82F6] selection:text-white transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/verify-receipt" element={<VerifyReceipt />} />
                <Route path="/verify-receipt/:challanId" element={<VerifyReceipt />} />

                {/* Dedicated Admin Portal Routes */}
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/officers"
                  element={
                    <AdminRoute>
                      <AdminOfficers />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/owners"
                  element={
                    <AdminRoute>
                      <AdminOwners />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/vehicles"
                  element={
                    <AdminRoute>
                      <AdminVehicles />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/challans"
                  element={
                    <AdminRoute>
                      <AdminChallans />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/payments"
                  element={
                    <AdminRoute>
                      <AdminPayments />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/analytics"
                  element={
                    <AdminRoute>
                      <AdminAnalytics />
                    </AdminRoute>
                  }
                />
                <Route path="/admin/violations" element={<Navigate to="/admin/analytics" replace />} />
                <Route
                  path="/admin/ai-monitoring"
                  element={
                    <AdminRoute>
                      <AdminAIMonitoring />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <AdminRoute>
                      <AdminReports />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/audit-logs"
                  element={
                    <AdminRoute>
                      <AdminAuditLogs />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminRoute>
                      <AdminSettings />
                    </AdminRoute>
                  }
                />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Dedicated Officer Portal Routes */}
                <Route path="/officer/login" element={<OfficerLogin />} />
                <Route
                  path="/officer/dashboard"
                  element={
                    <OfficerRoute>
                      <OfficerDashboard />
                    </OfficerRoute>
                  }
                />
                <Route path="/officer" element={<Navigate to="/officer/dashboard" replace />} />

                {/* Owner / Citizen Account System Routes */}
                <Route
                  path="/citizen/signup"
                  element={
                    <OwnerRoute>
                      <OwnerCreateAccount />
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/citizen/login"
                  element={
                    <OwnerRoute>
                      <OwnerLogin />
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/citizen/dashboard"
                  element={
                    <OwnerRoute>
                      <OwnerDashboard />
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/citizen/vehicles"
                  element={
                    <OwnerRoute>
                      <MyVehicles />
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/citizen/challans"
                  element={
                    <OwnerRoute>
                      <MyChallans />
                    </OwnerRoute>
                  }
                />
                <Route
                  path="/citizen/profile"
                  element={
                    <OwnerRoute>
                      <OwnerProfile />
                    </OwnerRoute>
                  }
                />

                {/* Top-Level Convenience Aliases */}
                <Route path="/login" element={<Navigate to="/citizen/login" replace />} />
                <Route path="/signup" element={<Navigate to="/citizen/signup" replace />} />
                <Route path="/dashboard" element={<Navigate to="/citizen/dashboard" replace />} />
                <Route path="/vehicles" element={<Navigate to="/citizen/vehicles" replace />} />
                <Route path="/challans" element={<Navigate to="/citizen/challans" replace />} />
                <Route path="/profile" element={<Navigate to="/citizen/profile" replace />} />

                {/* Catch-all Fallback */}
                <Route path="*" element={<Navigate to="/citizen/dashboard" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  </ThemeProvider>
  );
};

export default App;
