import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Car,
  FileText,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Building2,
  LayoutDashboard,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { ThemeToggle } from './ThemeToggle';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isAdminPath = location.pathname.startsWith('/admin');
  const isOfficerPath = location.pathname.startsWith('/officer');

  // AdminLayout provides its own full sidebar and header for authenticated admin views
  if (isAdminPath && location.pathname !== '/admin/login' && user?.role === 'admin') {
    return null;
  }

  const portalContext: 'admin' | 'officer' | 'owner' =
    user?.role === 'admin' || isAdminPath
      ? 'admin'
      : user?.role === 'officer' || isOfficerPath
      ? 'officer'
      : 'owner';

  // Authenticated Owner navigation links (localized via useLanguage)
  const ownerNavLinks = [
    { label: t('nav.dashboard'), path: '/citizen/dashboard', icon: LayoutDashboard },
    { label: t('nav.myVehicles'), path: '/citizen/vehicles', icon: Car },
    { label: t('nav.myChallans'), path: '/citizen/challans', icon: FileText },
    { label: t('nav.profile'), path: '/citizen/profile', icon: UserIcon },
  ];

  // Only show role-specific navigation links when authenticated as an owner
  const currentNavLinks = user && portalContext === 'owner' ? ownerNavLinks : [];

  // Brand navigation target & labels isolated by portal context
  const getBrandDetails = () => {
    if (portalContext === 'officer') {
      return {
        path: user?.role === 'officer' ? '/officer/dashboard' : '/officer/login',
        badge: 'Officer Console',
        subtext: 'Maharashtra State Traffic Police • Field Enforcement Command',
        headerTitle: 'Traffic Officer Enforcement Console',
      };
    }
    if (portalContext === 'admin') {
      return {
        path: user?.role === 'admin' ? '/admin/dashboard' : '/admin/login',
        badge: 'Admin Portal',
        subtext: 'Maharashtra State Traffic Police • Supervisory Control',
        headerTitle: 'Administrative Supervisory Portal',
      };
    }
    return {
      path: user ? '/citizen/dashboard' : '/',
      badge: t('auth.ownerPortalBadge'),
      subtext: t('nav.brandSubtitle'),
      headerTitle: t('nav.brandTitle'),
    };
  };

  const brand = getBrandDetails();

  const handleLogout = () => {
    const currentPortal = portalContext;
    logout();
    setMobileMenuOpen(false);
    if (currentPortal === 'officer') {
      navigate('/officer/login');
    } else if (currentPortal === 'admin') {
      navigate('/admin/login');
    } else {
      navigate('/citizen/login');
    }
  };

  const isOnOwnerLogin =
    location.pathname === '/citizen/login' ||
    location.pathname === '/login' ||
    location.pathname === '/citizen/signup' ||
    location.pathname === '/signup';
  const isOnOfficerLogin = location.pathname === '/officer/login';
  const isOnAdminLogin = location.pathname === '/admin/login';

  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#111C2E] border-b border-[#E2E8F0] dark:border-[#1E293B] text-[#172033] dark:text-[#F1F5F9] shadow-sm transition-colors duration-200">
      {/* Indian National Tricolor Accent Bar */}
      <div className="h-[3px] w-full flex">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white dark:bg-[#94A3B8]" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Top Government Info Bar */}
      <div className="bg-[#F5F7FB] dark:bg-[#0B1220] px-4 sm:px-6 lg:px-8 py-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#1E293B] flex justify-between items-center transition-colors">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-bold tracking-wider text-[#3B82F6] dark:text-[#38BDF8]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            MAHATRAFFIC
          </span>
          <span className="text-[#CBD5E1] dark:text-[#334155]">•</span>
          <span className="text-[#172033] dark:text-[#E2E8F0] font-medium truncate max-w-[280px] sm:max-w-none">
            Government of Maharashtra • {brand.headerTitle}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-5 text-[#64748B] dark:text-[#94A3B8] text-[11px]">
          <span>
            Traffic Emergency: <strong className="text-[#F59E0B] font-mono">103</strong>
          </span>
          <span>
            Toll-Free: <strong className="text-[#3B82F6] dark:text-[#38BDF8] font-mono">1800-22-0110</strong>
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <Link to={brand.path} className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#162238] border border-[#BFDBFE] dark:border-[#24344D] flex items-center justify-center text-[#3B82F6] dark:text-[#38BDF8] group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-[#172033] dark:text-[#F1F5F9]">
                  {portalContext === 'owner' ? t('nav.brandTitle') : 'MahaTraffic'}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${
                    portalContext === 'officer'
                      ? 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 text-[#D97706] dark:text-[#F59E0B] border-[#FDE68A] dark:border-[#F59E0B]/30'
                      : 'bg-[#EFF6FF] dark:bg-[#3B82F6]/10 text-[#174EA6] dark:text-[#38BDF8] border-[#BFDBFE] dark:border-[#3B82F6]/30'
                  }`}
                >
                  {brand.badge}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-tight">{brand.subtext}</p>
            </div>
          </Link>

          {/* Desktop Navigation Links (Only shown when logged in as Owner) */}
          {currentNavLinks.length > 0 && (
            <nav className="hidden md:flex items-center gap-1 bg-[#F5F7FB] dark:bg-[#0B1220] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#1E293B]">
              {currentNavLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#3B82F6] text-white shadow-sm'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-white dark:hover:bg-[#111C2E]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#64748B] dark:text-[#94A3B8]'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Right Action: ThemeToggle + Logged-in User Info OR Login Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Theme Switcher */}
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-3.5 pl-3 border-l border-[#E2E8F0] dark:border-[#1E293B]">
                <div className="text-right">
                  <span className="block text-xs font-bold text-[#172033] dark:text-[#F1F5F9]">{user.fullName}</span>
                  <span className="block text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                    {user.role === 'officer'
                      ? `Badge: ${user.badgeNumber || 'MH-TRF-1001'}`
                      : user.role === 'admin'
                      ? 'Administrator'
                      : `+91 ${user.mobileNumber ? `******${user.mobileNumber.slice(-4)}` : '******6011'}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title={`Logout from ${brand.badge}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FEF2F2] dark:bg-[#EF4444]/10 hover:bg-[#FEE2E2] dark:hover:bg-[#EF4444]/20 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#EF4444]/30 text-xs font-semibold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {portalContext === 'owner' ? t('nav.logout') : 'Logout'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/citizen/login"
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    isOnOwnerLogin
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-sm'
                      : 'bg-white dark:bg-[#111C2E] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#3B82F6]/50'
                  }`}
                >
                  <UserIcon className={`w-3.5 h-3.5 ${isOnOwnerLogin ? 'text-white' : 'text-[#3B82F6]'}`} />
                  Owner Login
                </Link>
                <Link
                  to="/officer/login"
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    isOnOfficerLogin
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-sm'
                      : 'bg-white dark:bg-[#111C2E] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#3B82F6]/50'
                  }`}
                >
                  <Shield className={`w-3.5 h-3.5 ${isOnOfficerLogin ? 'text-white' : 'text-[#F59E0B]'}`} />
                  Officer Login
                </Link>
                <Link
                  to="/admin/login"
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    isOnAdminLogin
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-sm'
                      : 'bg-white dark:bg-[#111C2E] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#3B82F6]/50'
                  }`}
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isOnAdminLogin ? 'text-white' : 'text-[#10B981]'}`} />
                  Admin Login
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger button + ThemeToggle */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#172033] dark:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238] border border-[#E2E8F0] dark:border-[#1E293B]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] p-4 space-y-3 shadow-lg">
          {currentNavLinks.length > 0 && (
            <div className="space-y-1">
              {currentNavLinks.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold ${
                      isActive
                        ? 'bg-[#3B82F6] text-white'
                        : 'text-[#172033] dark:text-[#F1F5F9] hover:bg-[#F5F7FB] dark:hover:bg-[#162238]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#3B82F6]'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {user ? (
            <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#172033] dark:text-[#F1F5F9]">{user.fullName}</p>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-mono">
                  {user.role === 'officer'
                    ? `Badge: ${user.badgeNumber || 'MH-TRF-1001'}`
                    : user.role === 'admin'
                    ? 'Administrator'
                    : `+91 ${user.mobileNumber ? `******${user.mobileNumber.slice(-4)}` : '******6011'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FEF2F2] dark:bg-[#EF4444]/10 hover:bg-[#FEE2E2] text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#EF4444]/30 text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                {portalContext === 'owner' ? t('nav.logout') : 'Logout'}
              </button>
            </div>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                to="/citizen/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold border ${
                  isOnOwnerLogin
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B]'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" /> Owner Login
              </Link>
              <Link
                to="/officer/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold border ${
                  isOnOfficerLogin
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B]'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Officer Login
              </Link>
              <Link
                to="/admin/login"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold border ${
                  isOnAdminLogin
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                    : 'bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9] border-[#E2E8F0] dark:border-[#1E293B]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Login
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
