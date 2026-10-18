import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Users,
  Car,
  FileText,
  CreditCard,
  BarChart3,
  Cpu,
  FileSpreadsheet,
  ClipboardList,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Officers', path: '/admin/officers', icon: Shield },
    { label: 'Owners', path: '/admin/owners', icon: Users },
    { label: 'Vehicles', path: '/admin/vehicles', icon: Car },
    { label: 'Challans', path: '/admin/challans', icon: FileText },
    { label: 'Payments', path: '/admin/payments', icon: CreditCard },
    { label: 'Violations / AI', path: '/admin/analytics', icon: BarChart3 },
    { label: 'AI Monitoring', path: '/admin/ai-monitoring', icon: Cpu },
    { label: 'Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-smart-traffic-dashboard flex flex-col md:flex-row text-[#172033] dark:text-[#F1F5F9] transition-colors duration-200">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9] p-4 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-[#172033] dark:text-[#F1F5F9] block">
              MAHATRAFFIC ADMIN
            </span>
            <span className="text-[10px] text-[#174EA6] dark:text-[#60A5FA] font-semibold uppercase">
              Supervisory Command
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] text-[#172033] dark:text-[#F1F5F9] hover:bg-[#F7F9FC] dark:hover:bg-[#162238]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Admin Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } md:block w-full md:w-64 bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9] border-r border-[#E2E8F0] dark:border-[#1E293B] flex-shrink-0 z-30 flex flex-col`}
      >
        {/* Department Branding */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#1E293B] hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E3A8A] text-[#174EA6] dark:text-[#60A5FA] flex items-center justify-center font-black shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-[#172033] dark:text-[#F1F5F9] text-base tracking-tight">
                  MahaTraffic
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EFF6FF] dark:bg-[#172554] text-[#174EA6] dark:text-[#60A5FA] font-bold border border-[#BFDBFE] dark:border-[#1E3A8A]">
                  ADMIN
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Maharashtra State Police</p>
            </div>
          </div>
        </div>

        {/* Admin Identity Card */}
        <div className="p-3.5 mx-3 my-3 rounded-xl bg-[#F7F9FC] dark:bg-[#162238]/60 border border-[#E2E8F0] dark:border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#174EA6] dark:bg-[#3B82F6] text-white flex items-center justify-center text-xs font-bold">
              AD
            </div>
            <div className="overflow-hidden">
              <span className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9] truncate">
                {user?.fullName || 'System Administrator'}
              </span>
              <span className="block text-[10px] text-[#174EA6] dark:text-[#60A5FA] font-semibold tracking-wide">
                Role: SUPERVISOR (ADMIN)
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                  isActive
                    ? 'bg-[#174EA6] dark:bg-[#3B82F6] text-white font-bold shadow-sm'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F7F9FC] dark:hover:bg-[#162238]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#64748B] dark:text-[#94A3B8]'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F7F9FC] dark:bg-[#162238]/60">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D]/50 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#DC2626]/40 text-xs font-bold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Operational Header */}
        <header className="bg-white dark:bg-[#111C2E] border-b border-[#E2E8F0] dark:border-[#1E293B] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8] mb-0.5">
              <span>Admin Portal</span>
              <span className="text-[#CBD5E1] dark:text-[#475569]">/</span>
              <span className="font-semibold text-[#174EA6] dark:text-[#60A5FA]">{title}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#172033] dark:text-[#F1F5F9] tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle in Desktop Admin Topbar */}
            <ThemeToggle />

            {/* Live Database Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#A7F3D0] dark:border-[#059669]/40 text-[#16856B] dark:text-[#34D399] text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#16856B] dark:bg-[#34D399]" />
              <span>Supabase DB: Active</span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
