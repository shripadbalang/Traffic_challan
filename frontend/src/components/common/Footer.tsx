import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PhoneCall, Mail, ExternalLink, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const Footer: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const isAdminPath = location.pathname.startsWith('/admin');
  const isOfficerPath = location.pathname.startsWith('/officer');

  // AdminLayout is full-height with its own sidebar; hide global footer on authenticated admin views
  if (isAdminPath && location.pathname !== '/admin/login' && user?.role === 'admin') {
    return null;
  }

  const isDepartmentView =
    user?.role === 'officer' ||
    user?.role === 'admin' ||
    isOfficerPath ||
    isAdminPath;

  return (
    <footer className="border-t border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#111C2E] text-[#64748B] dark:text-[#94A3B8] text-xs font-sans transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1: Government Identity */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-[#172033] dark:text-[#F1F5F9] font-bold text-sm">
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#162238] border border-[#BFDBFE] dark:border-[#24344D] flex items-center justify-center text-[#3B82F6] dark:text-[#38BDF8]">
                <Building2 className="w-4 h-4" />
              </div>
              <span>{isDepartmentView ? 'MahaTraffic E-Challan' : t('nav.brandTitle')}</span>
            </div>
            <p className="text-[#64748B] dark:text-[#94A3B8] text-xs leading-relaxed">
              {isDepartmentView
                ? 'Official Enforcement & Supervisory Portal operated under the Motor Vehicles Act, 1988 by the Maharashtra State Traffic Police.'
                : 'Official Vehicle Owner Portal operated under the Motor Vehicles Act, 1988 by the Maharashtra State Traffic Police.'}
            </p>
            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              National Informatics Centre (NIC) • Parivahan Digital Highway Standards
            </div>
          </div>

          {/* Col 2: Portal-Specific Services */}
          <div className="space-y-2.5">
            {isDepartmentView ? (
              <>
                <h4 className="text-[#172033] dark:text-[#F1F5F9] font-bold text-xs uppercase tracking-wider">Enforcement Standards</h4>
                <ul className="space-y-1.5 text-[#64748B] dark:text-[#94A3B8]">
                  <li>Motor Vehicles (Amendment) Act, 2019</li>
                  <li>Central Motor Vehicles Rules (CMVR)</li>
                  <li>IT Act Section 65B Electronic Evidence</li>
                </ul>
              </>
            ) : (
              <>
                <h4 className="text-[#172033] dark:text-[#F1F5F9] font-bold text-xs uppercase tracking-wider">Owner Services</h4>
                <ul className="space-y-1.5">
                  <li>
                    <Link to="/citizen/vehicles" className="hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors">
                      {t('nav.myVehicles')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/citizen/challans" className="hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors">
                      {t('nav.myChallans')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/verify-receipt" className="hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors">
                      Verify QR Payment Receipt
                    </Link>
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* Col 3: Official Portals */}
          <div className="space-y-2.5">
            <h4 className="text-[#172033] dark:text-[#F1F5F9] font-bold text-xs uppercase tracking-wider">Government Links</h4>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="https://parivahan.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors"
                >
                  Parivahan Sewa (MoRTH) <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://transport.maharashtra.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors"
                >
                  Maharashtra Motor Vehicles Dept <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
              <li>
                <a
                  href="https://echallan.parivahan.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#3B82F6] dark:hover:text-[#38BDF8] transition-colors"
                >
                  National E-Challan Repository <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Official Helpline */}
          <div className="space-y-2.5">
            <h4 className="text-[#172033] dark:text-[#F1F5F9] font-bold text-xs uppercase tracking-wider">Assistance & Helpline</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                <PhoneCall className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>
                  Traffic Emergency Helpline: <strong className="text-[#172033] dark:text-[#F1F5F9] font-mono">103</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                <PhoneCall className="w-3.5 h-3.5 text-[#3B82F6] dark:text-[#38BDF8]" />
                <span>
                  Toll-Free Control Desk: <strong className="text-[#172033] dark:text-[#F1F5F9] font-mono">1800-22-0110</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                <Mail className="w-3.5 h-3.5 text-[#3B82F6] dark:text-[#38BDF8]" />
                <span className="truncate">support-echallan@mahapolice.gov.in</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#E2E8F0] dark:border-[#1E293B] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[#64748B] dark:text-[#94A3B8] text-[11px]">
          <p>© 2026 Government of Maharashtra • Maharashtra State Traffic Police.</p>
          <div className="flex items-center gap-4 text-[#64748B] dark:text-[#94A3B8]">
            <span>Website Policies</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Help & FAQ</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
