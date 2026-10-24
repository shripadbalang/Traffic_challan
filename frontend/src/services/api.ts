import { Challan, Vehicle, AnalyticsData, DetectionResult } from '../types';
import { INITIAL_CHALLANS, INITIAL_VEHICLES, INITIAL_ANALYTICS } from './mockData';

// Storage keys
const CHALLANS_KEY = 'echallan_data_challans';
const VEHICLES_KEY = 'echallan_data_vehicles';
const ANALYTICS_KEY = 'echallan_data_analytics';

export function getStoredChallans(): Challan[] {
  const data = localStorage.getItem(CHALLANS_KEY);
  if (!data) {
    localStorage.setItem(CHALLANS_KEY, JSON.stringify(INITIAL_CHALLANS));
    return INITIAL_CHALLANS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_CHALLANS;
  }
}

export function saveStoredChallans(challans: Challan[]) {
  localStorage.setItem(CHALLANS_KEY, JSON.stringify(challans));
}

export function getStoredVehicles(): Vehicle[] {
  const data = localStorage.getItem(VEHICLES_KEY);
  if (!data) {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(INITIAL_VEHICLES));
    return INITIAL_VEHICLES;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_VEHICLES;
  }
}

export function saveStoredVehicles(vehicles: Vehicle[]) {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
}

export function getStoredAnalytics(): AnalyticsData {
  const data = localStorage.getItem(ANALYTICS_KEY);
  if (!data) {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(INITIAL_ANALYTICS));
    return INITIAL_ANALYTICS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_ANALYTICS;
  }
}

export function saveStoredAnalytics(analytics: AnalyticsData) {
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
}

// API Base URL configuration for production vs local dev
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function buildApiUrl(endpoint: string): string {
  if (!API_BASE_URL || endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${clean}`;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = buildApiUrl(input);
  const headers = new Headers(init?.headers);
  if (!headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }
  return fetch(url, { ...init, headers });
}

// Check if backend API is reachable
let backendAvailable = false;
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await apiFetch('/health', { method: 'GET', signal: AbortSignal.timeout(1500) });
    backendAvailable = res.ok;
    return res.ok;
  } catch {
    backendAvailable = false;
    return false;
  }
}

async function handleResponseJson(res: Response, defaultErrorMsg: string): Promise<any> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. backend offline or proxy error)
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (res.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('echallan_current_user');
          if (path.startsWith('/admin') && path !== '/admin/login') {
            window.location.href = '/admin/login';
          } else if (path.startsWith('/officer') && path !== '/officer/login') {
            window.location.href = '/officer/login';
          }
        } else if (res.status === 403 && (data?.detail === 'Insufficient permissions' || data?.detail === 'Not authenticated')) {
          // Stale session or role collision
          if (path.startsWith('/admin') && path !== '/admin/login') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('echallan_current_user');
            window.location.href = '/admin/login';
          } else if (path.startsWith('/officer') && path !== '/officer/login') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('echallan_current_user');
            window.location.href = '/officer/login';
          }
        }
      }
    }
    let errorDetail: string;
    if (typeof data?.detail === 'string') {
      errorDetail = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      errorDetail = data.detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ');
    } else if (typeof data?.message === 'string') {
      errorDetail = data.message;
    } else if (res.status === 500) {
      errorDetail = 'Backend service is currently unreachable (port 8000). Please ensure the FastAPI server is running.';
    } else {
      errorDetail = defaultErrorMsg;
    }
    throw new Error(errorDetail);
  }
  return data;
}

export const api = {
  // ================= SUPABASE AUTH OWNER PROFILE SYNC =================
  // Sync Owner Profile with Supabase Auth session & canonical auth.users.id
  async syncOwnerProfile(payload: {
    userId: string;
    email: string;
    fullName?: string;
    mobileNumber?: string;
  }): Promise<{ success: boolean; token: string; user: any }> {
    const res = await apiFetch('/users/sync-owner-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: payload.userId,
        email: payload.email,
        full_name: payload.fullName,
        mobile_number: payload.mobileNumber,
      }),
    });
    const data = await handleResponseJson(res, 'Failed to synchronize owner profile.');
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return {
      success: true,
      token: data.access_token,
      user: data.user,
    };
  },

  // Add Registered Vehicle to Account
  async addVehicle(vehicleNumber: string, registeredMobile: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/vehicles/add', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vehicle_number: vehicleNumber,
        registered_mobile: registeredMobile,
      }),
    });
    return await handleResponseJson(res, 'The vehicle number and registered mobile number do not match our records.');
  },

  // Remove / Unlink Vehicle from Account
  async removeVehicle(plateNumber: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/vehicles/${encodeURIComponent(plateNumber)}`, {
      method: 'DELETE',
      headers,
    });
    return await handleResponseJson(res, 'Failed to remove vehicle from account.');
  },

  // View Vehicle Details
  async getVehicleDetails(plateNumber: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/vehicles/${plateNumber}/details`, { headers });
    return await handleResponseJson(res, 'Failed to fetch vehicle details.');
  },

  // Public Receipt Verification (for QR Code scanning)
  async getPublicReceiptVerification(challanId: string): Promise<any> {
    const res = await apiFetch(`/payments/verify-public/${challanId}`);
    return await handleResponseJson(res, 'Receipt verification record not found.');
  },

  // Profile: Get user profile
  async getUserProfile(): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/users/profile', { headers });
    return await handleResponseJson(res, 'Failed to load user profile.');
  },

  // Profile: Request OTP to change contact
  async requestContactOtp(identifier: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/users/profile/request-contact-otp', {
      method: 'POST',
      headers,
      body: JSON.stringify({ identifier }),
    });
    return await handleResponseJson(res, 'Failed to send OTP.');
  },

  // Profile: Update profile details
  async updateUserProfile(payload: {
    fullName?: string;
    email?: string;
    mobileNumber?: string;
    otpCode?: string;
  }): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/users/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        full_name: payload.fullName,
        email: payload.email,
        mobile_number: payload.mobileNumber,
        otp_code: payload.otpCode,
      }),
    });
    return await handleResponseJson(res, 'Failed to update profile.');
  },

  // Citizen registration
  async citizenSignup(payload: {
    fullName: string;
    mobileNumber: string;
    email: string;
    plateNumber: string;
    password?: string;
  }): Promise<{ success: boolean; message: string; otp?: string }> {
    try {
      const res = await apiFetch('/auth/citizen/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: payload.fullName,
          mobile_number: payload.mobileNumber,
          email: payload.email,
          plate_number: payload.plateNumber.toUpperCase(),
          password: payload.password || 'Citizen@123',
        }),
      });
      if (res.ok) {
        return { success: true, message: 'Signup successful. OTP has been sent to your mobile.' };
      }
    } catch {
      // Fallback to local store
    }

    // Local mock behavior
    const vehicles = getStoredVehicles();
    let vehicle = vehicles.find((v) => v.plateNumber === payload.plateNumber.toUpperCase());
    if (!vehicle) {
      vehicle = {
        id: Date.now(),
        plateNumber: payload.plateNumber.toUpperCase(),
        vehicleType: 'Two Wheeler (Motorcycle)',
        model: 'Registered Vehicle',
        rtoCode: payload.plateNumber.substring(0, 4).toUpperCase(),
        ownerId: 101,
        ownerName: payload.fullName,
        ownerMobile: payload.mobileNumber,
      };
      vehicles.push(vehicle);
      saveStoredVehicles(vehicles);
    } else {
      vehicle.ownerName = payload.fullName;
      vehicle.ownerMobile = payload.mobileNumber;
      saveStoredVehicles(vehicles);
    }

    return {
      success: true,
      message: `Account created for ${payload.fullName}. Verification OTP dispatched to +91 ${payload.mobileNumber}.`,
      otp: '748291',
    };
  },

  // Owner login: Request OTP
  async requestOwnerOtp(vehicleNumber: string, mobileNumber: string): Promise<{
    success: boolean;
    message: string;
    maskedMobile?: string;
    ownerName?: string;
    vehicleNumber?: string;
    debugOtp?: string;
  }> {
    const res = await apiFetch('/auth/owner/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_number: vehicleNumber,
        mobile_number: mobileNumber,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Vehicle or mobile number is not registered. Please check your details or contact the concerned authority.');
    }
    return {
      success: true,
      message: data.message,
      maskedMobile: data.masked_mobile,
      ownerName: data.owner_name,
      vehicleNumber: data.vehicle_number,
      debugOtp: data.debug_otp,
    };
  },

  // Owner login: Verify OTP
  async verifyOwnerOtp(vehicleNumber: string, mobileNumber: string, code: string): Promise<{
    success: boolean;
    token: string;
    user: any;
  }> {
    const res = await apiFetch('/auth/owner/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_number: vehicleNumber,
        mobile_number: mobileNumber,
        code,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Invalid or expired OTP. Please check your OTP or request a new one.');
    }
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return {
      success: true,
      token: data.access_token,
      user: {
        id: data.user?.id,
        fullName: data.user?.full_name,
        mobileNumber: data.user?.mobile_number,
        email: data.user?.email,
        role: data.role || 'citizen',
        isVerified: true,
      },
    };
  },

  // Owner Portal: Login Initiate (Email or Mobile OTP via Backend)
  async ownerLoginInitiate(identifier: string): Promise<{
    message: string;
    maskedContact: string;
    identifier: string;
  }> {
    const res = await apiFetch('/auth/owner/login-initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const data = await handleResponseJson(res, 'Failed to send login OTP.');
    return {
      message: data.message,
      maskedContact: data.masked_contact || identifier,
      identifier: data.identifier || identifier,
    };
  },

  // Owner Portal: Login Verify OTP
  async ownerLoginVerify(identifier: string, code: string): Promise<{
    success: boolean;
    token: string;
    user: any;
  }> {
    const res = await apiFetch('/auth/owner/login-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code }),
    });
    const data = await handleResponseJson(res, 'Invalid or expired OTP code.');
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return {
      success: true,
      token: data.access_token,
      user: {
        id: data.user?.id,
        fullName: data.user?.full_name || data.user?.fullName,
        email: data.user?.email,
        mobileNumber: data.user?.mobile_number || data.user?.mobileNumber,
        role: 'owner',
        isVerified: true,
      },
    };
  },

  // Owner Portal: Resend OTP
  async ownerResendOtp(identifier: string): Promise<{ message: string }> {
    const res = await apiFetch('/auth/owner/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    const data = await handleResponseJson(res, 'Failed to resend OTP.');
    return { message: data.message };
  },

  // Owner Portal: Registration Initiate
  async ownerRegisterInitiate(payload: {
    fullName: string;
    email: string;
    mobileNumber: string;
  }): Promise<{ message: string; email: string; mobileNumber: string }> {
    const res = await apiFetch('/auth/owner/register-initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: payload.fullName,
        email: payload.email,
        mobile_number: payload.mobileNumber,
      }),
    });
    const data = await handleResponseJson(res, 'Failed to initiate registration.');
    return {
      message: data.message,
      email: data.email,
      mobileNumber: data.mobile_number,
    };
  },

  // Owner Portal: Registration Verify
  async ownerRegisterVerify(payload: {
    fullName: string;
    email: string;
    mobileNumber: string;
    code: string;
  }): Promise<{ success: boolean; token: string; user: any }> {
    const res = await apiFetch('/auth/owner/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: payload.fullName,
        email: payload.email,
        mobile_number: payload.mobileNumber,
        code: payload.code,
      }),
    });
    const data = await handleResponseJson(res, 'Failed to verify registration code.');
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return {
      success: true,
      token: data.access_token,
      user: {
        id: data.user?.id,
        fullName: data.user?.full_name || data.user?.fullName,
        email: data.user?.email,
        mobileNumber: data.user?.mobile_number || data.user?.mobileNumber,
        role: 'owner',
        isVerified: true,
      },
    };
  },

  // Request OTP (Generic)
  async requestOtp(mobileNumber: string): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    try {
      const res = await apiFetch('/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: mobileNumber }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message, debugOtp: data.debug_otp || '482910' };
      }
    } catch {
      // Fallback
    }

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    sessionStorage.setItem(`otp_${mobileNumber}`, mockOtp);
    return {
      success: true,
      message: `SMS sent to +91 ${mobileNumber}. (Valid for 5 minutes)`,
      debugOtp: mockOtp,
    };
  },

  // Verify OTP
  async verifyOtp(mobileNumber: string, code: string): Promise<{ success: boolean; token: string; user: any }> {
    try {
      const res = await apiFetch('/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile_number: mobileNumber, code }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          token: data.access_token,
          user: {
            id: 101,
            fullName: 'Rajesh Sharma',
            mobileNumber,
            role: 'citizen',
            isVerified: true,
          },
        };
      }
    } catch {
      // Fallback when backend is not available
    }

    const vehicles = getStoredVehicles();
    const matchedVehicle = vehicles.find((v) => v.ownerMobile === mobileNumber);
    const ownerName = matchedVehicle?.ownerName || (mobileNumber === '9822012345' ? 'Rajesh Sharma' : 'Vehicle Owner');

    return {
      success: true,
      token: 'demo-citizen-jwt-token',
      user: {
        id: matchedVehicle?.ownerId || 101,
        fullName: ownerName,
        email: `${ownerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        mobileNumber,
        role: 'citizen',
        isVerified: true,
      },
    };
  },

  // Password Login (Officer & Admin)
  async login(identifier: string, password: string): Promise<{ success: boolean; token: string; role: string; user: any }> {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        const data = await res.json();
        const role = data.role;
        return {
          success: true,
          token: data.access_token,
          role,
          user: {
            id: role === 'admin' ? 301 : 201,
            fullName: role === 'admin' ? 'System Administrator' : 'Officer Ramesh Patil',
            email: identifier,
            role,
            badgeNumber: role === 'officer' ? 'MH-PUN-0042' : undefined,
          },
        };
      }
    } catch {
      // Fallback
    }

    if (identifier.toLowerCase().includes('admin')) {
      return {
        success: true,
        token: 'demo-admin-jwt-token',
        role: 'admin',
        user: {
          id: 301,
          fullName: 'Shri A. K. Deshpande (IPS)',
          email: identifier,
          role: 'admin',
        },
      };
    } else {
      return {
        success: true,
        token: 'demo-officer-jwt-token',
        role: 'officer',
        user: {
          id: 201,
          fullName: 'Officer Ramesh Patil',
          email: identifier,
          role: 'officer',
          badgeNumber: 'MH-PUN-0042',
          station: 'Pune City Traffic Division',
        },
      };
    }
  },

  // ================= OFFICIAL TRAFFIC OFFICER APIS =================

  // Dedicated Officer Login
  async officerLogin(email: string, password: string): Promise<any> {
    const res = await apiFetch('/auth/officer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    const data = await handleResponseJson(res, 'Officer authentication failed.');
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return data;
  },

  // Get Officer Dashboard Summary & Today's Stats
  async getOfficerSummary(): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/officer/summary', { headers });
    return await handleResponseJson(res, 'Failed to fetch officer dashboard summary.');
  },

  // Capture & Submit Image for Real AI Violation Detection
  async captureAndDetectViolation(formData: FormData): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/officer/violations/capture-and-detect', {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleResponseJson(res, 'Failed to process AI violation detection.');
  },

  // Officer Challans List
  async getOfficerChallans(
    paramsOrStatus?: { status?: string; plate_number?: string } | string,
    plateNumber?: string
  ): Promise<any[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (typeof paramsOrStatus === 'string') {
      if (paramsOrStatus && paramsOrStatus !== 'ALL') query.set('status_filter', paramsOrStatus);
      if (plateNumber) query.set('plate_number', plateNumber);
    } else if (paramsOrStatus) {
      if (paramsOrStatus.status && paramsOrStatus.status !== 'ALL') query.set('status_filter', paramsOrStatus.status);
      if (paramsOrStatus.plate_number) query.set('plate_number', paramsOrStatus.plate_number);
    }

    const url = `/officer/challans${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiFetch(url, { headers });
    return await handleResponseJson(res, 'Failed to fetch officer challans.');
  },

  // Repeat Violators (3+ Unpaid Challans - ACTION REQUIRED)
  async getRepeatViolators(): Promise<any[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/officer/enforcement/repeat-violators', { headers });
    return await handleResponseJson(res, 'Failed to fetch repeat violators.');
  },

  // Record Field Enforcement Action
  async recordEnforcementAction(payload: {
    vehicle_number: string;
    action_type: string;
    location?: string;
    notes?: string;
    related_challan_ids?: string[];
  }): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/officer/enforcement-action', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await handleResponseJson(res, 'Failed to record enforcement action.');
  },

  // Get Enforcement Action History
  async getEnforcementHistory(): Promise<any[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/officer/enforcement-actions', { headers });
    return await handleResponseJson(res, 'Failed to fetch enforcement history.');
  },

  // ================= ADMIN PORTAL APIS =================

  // Dedicated Admin Login
  async adminLogin(email: string, password: string): Promise<any> {
    const res = await apiFetch('/auth/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email.trim().toLowerCase(), password }),
    });
    const data = await handleResponseJson(res, 'Administrator authentication failed.');
    if (data.access_token) {
      localStorage.setItem('auth_token', data.access_token);
    }
    return data;
  },

  // Admin Dashboard Overview & Real-time Stats
  async getAdminDashboardStats(): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/dashboard-stats', { headers });
    return await handleResponseJson(res, 'Failed to fetch dashboard statistics.');
  },

  // Admin Violation Analytics with Time Filters
  async getAdminViolationAnalytics(params?: {
    time_filter?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (params?.time_filter) query.set('time_filter', params.time_filter);
    if (params?.from_date) query.set('from_date', params.from_date);
    if (params?.to_date) query.set('to_date', params.to_date);

    const url = `/admin/violation-analytics${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiFetch(url, { headers });
    return await handleResponseJson(res, 'Failed to fetch violation analytics.');
  },

  // Admin Challan Management
  async getAdminChallans(params?: {
    search?: string;
    status?: string;
    violation_code?: string;
    officer_id?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; limit: number; offset: number; items: any[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status_filter', params.status);
    if (params?.violation_code && params.violation_code !== 'ALL') query.set('violation_code', params.violation_code);
    if (params?.officer_id && params.officer_id !== 'ALL') query.set('officer_id', params.officer_id);
    if (params?.from_date) query.set('from_date', params.from_date);
    if (params?.to_date) query.set('to_date', params.to_date);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const url = `/admin/challans${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiFetch(url, { headers });
    return await handleResponseJson(res, 'Failed to fetch challans.');
  },

  async getAdminChallanDetail(challanId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/challans/${challanId}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch challan details.');
  },

  async updateAdminChallanStatus(challanId: string, status: string, notes?: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/challans/${challanId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, notes }),
    });
    return await handleResponseJson(res, 'Failed to update challan status.');
  },

  // Admin Officer Management
  async getAdminOfficers(search?: string): Promise<any[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = search ? `/admin/officers?search=${encodeURIComponent(search)}` : '/admin/officers';
    const res = await apiFetch(url, { headers });
    return await handleResponseJson(res, 'Failed to fetch officers list.');
  },

  async getAdminOfficerDetail(officerId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/officers/${officerId}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch officer details.');
  },

  async createAdminOfficer(payload: any): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/officers', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await handleResponseJson(res, 'Failed to create officer account.');
  },

  async updateAdminOfficer(officerId: string, payload: any): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/officers/${officerId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    return await handleResponseJson(res, 'Failed to update officer.');
  },

  async deactivateAdminOfficer(officerId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/officers/${officerId}`, {
      method: 'DELETE',
      headers,
    });
    return await handleResponseJson(res, 'Failed to deactivate officer.');
  },

  // Admin Owner Management
  async getAdminOwners(search?: string, limit: number = 50, offset: number = 0): Promise<{ total: number; items: any[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (search) query.set('search', search);
    query.set('limit', String(limit));
    query.set('offset', String(offset));

    const res = await apiFetch(`/admin/owners?${query.toString()}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch owners list.');
  },

  async getAdminOwnerDetail(ownerId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/owners/${ownerId}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch owner details.');
  },

  // Admin Vehicle Management
  async getAdminVehicles(search?: string, limit: number = 50, offset: number = 0): Promise<{ total: number; items: any[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (search) query.set('search', search);
    query.set('limit', String(limit));
    query.set('offset', String(offset));

    const res = await apiFetch(`/admin/vehicles?${query.toString()}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch vehicles list.');
  },

  async getAdminVehicleDetail(plateNumber: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/vehicles/${encodeURIComponent(plateNumber)}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch vehicle details.');
  },

  async createAdminVehicle(payload: {
    vehicle_number: string;
    owner_name: string;
    owner_mobile: string;
    owner_email: string;
    vehicle_model: string;
    vehicle_type?: string;
  }): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/vehicles', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await handleResponseJson(res, 'Failed to register vehicle.');
  },

  async updateAdminVehicle(
    plateNumber: string,
    payload: {
      owner_name?: string;
      owner_mobile?: string;
      owner_email?: string;
      vehicle_model?: string;
      vehicle_type?: string;
    }
  ): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/vehicles/${encodeURIComponent(plateNumber)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });
    return await handleResponseJson(res, 'Failed to update vehicle.');
  },

  async deleteAdminVehicle(plateNumber: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/admin/vehicles/${encodeURIComponent(plateNumber)}`, {
      method: 'DELETE',
      headers,
    });
    return await handleResponseJson(res, 'Failed to delete vehicle.');
  },

  // Admin Payment Management
  async getAdminPayments(params?: {
    search?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; items: any[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status_filter', params.status);
    if (params?.from_date) query.set('from_date', params.from_date);
    if (params?.to_date) query.set('to_date', params.to_date);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await apiFetch(`/admin/payments?${query.toString()}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch payments.');
  },

  // Admin AI & Violation Monitoring
  async getAdminAIMonitoring(): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/ai-monitoring', { headers });
    return await handleResponseJson(res, 'Failed to fetch AI monitoring statistics.');
  },

  // Admin Reports
  async getAdminReports(
    reportType: string = 'challans',
    params?: { from_date?: string; to_date?: string; status_filter?: string }
  ): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    query.set('report_type', reportType);
    if (params?.from_date) query.set('from_date', params.from_date);
    if (params?.to_date) query.set('to_date', params.to_date);
    if (params?.status_filter && params.status_filter !== 'ALL') query.set('status_filter', params.status_filter);

    const res = await apiFetch(`/admin/reports?${query.toString()}`, { headers });
    return await handleResponseJson(res, 'Failed to generate report.');
  },

  // Admin Audit Logs
  async getAdminAuditLogs(params?: {
    action?: string;
    user_email?: string;
    status_filter?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; items: any[] }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.user_email) query.set('user_email', params.user_email);
    if (params?.status_filter && params.status_filter !== 'ALL') query.set('status_filter', params.status_filter);
    if (params?.from_date) query.set('from_date', params.from_date);
    if (params?.to_date) query.set('to_date', params.to_date);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await apiFetch(`/admin/audit-logs?${query.toString()}`, { headers });
    return await handleResponseJson(res, 'Failed to fetch audit logs.');
  },

  // Admin System Settings
  async getAdminSettings(): Promise<any[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/settings', { headers });
    return await handleResponseJson(res, 'Failed to fetch system settings.');
  },

  async updateAdminSettings(settings: Record<string, string>): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/admin/settings', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ settings }),
    });
    return await handleResponseJson(res, 'Failed to update system settings.');
  },



  // Fetch strictly the authenticated owner's vehicles from backend
  async getMyVehicles(): Promise<Vehicle[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await apiFetch('/vehicles/my', { headers });
      if (res.ok) {
        const data = await res.json();
        return data.map((v: any) => ({
          id: v.id,
          plateNumber: v.plate_number,
          vehicleType: v.vehicle_type,
          model: v.model,
          rtoCode: v.rto_code,
          ownerName: v.owner_name,
          maskedMobile: v.masked_mobile,
          maskedEmail: v.masked_email,
        }));
      }
    } catch {
      // Fallback to local storage if network error
    }
    return getStoredVehicles();
  },

  // Fetch strictly the authenticated owner's challans from backend
  async getMyChallans(status?: string): Promise<Challan[]> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const url = status && status !== 'ALL' ? `/challans/my?status=${status.toLowerCase()}` : '/challans/my';
      const res = await apiFetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.map((c: any) => ({
          id: c.id,
          vehiclePlate: c.vehicle_plate,
          violation: c.violation_name,
          violationCode: c.violation_code,
          fineAmount: c.fine_amount,
          status: c.status,
          violationDatetime: c.violation_datetime,
          location: c.location,
          paymentDate: c.payment_date,
          hasEvidence: c.has_evidence,
          evidenceUrl: c.evidence_url,
          evidenceType: c.evidence_type,
          evidenceMissingReason: c.evidence_missing_reason || (c.has_evidence ? null : 'Evidence image is not available.'),
        }));
      }
    } catch {
      // Fallback to local storage if network error
    }
    return getStoredChallans();
  },

  // Get single challan detail with ownership check
  async getChallanDetail(challanId: string): Promise<any> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/challans/${challanId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to fetch challan details.');
    }
    return {
      id: data.id,
      vehiclePlate: data.vehicle_plate,
      violation: data.violation,
      violationCode: data.violation_code,
      fineAmount: data.fine_amount,
      status: data.status,
      violationDatetime: data.violation_datetime,
      location: data.location,
      paymentDate: data.payment_date,
      hasEvidence: data.has_evidence,
      evidenceUrl: data.evidence_url,
      evidenceType: data.evidence_type,
      evidenceMissingReason: data.evidence_missing_reason || (data.has_evidence ? null : 'Evidence image is not available.'),
      evidence: data.evidence || [],
    };
  },

  // Initiate real backend payment
  async initiatePayment(challanId: string): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    razorpayKeyId?: string;
    mockMode: boolean;
  }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/payments/initiate', {
      method: 'POST',
      headers,
      body: JSON.stringify({ challan_id: challanId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to initiate payment.');
    }
    return {
      orderId: data.order_id,
      amount: data.amount,
      currency: data.currency,
      razorpayKeyId: data.razorpay_key_id,
      mockMode: data.mock_mode,
    };
  },

  // Verify payment with backend & update DB status
  async verifyPayment(
    challanId: string,
    orderId: string,
    paymentId: string,
    signature: string = 'mock_sig'
  ): Promise<{
    success: boolean;
    message: string;
    receiptPdfPath?: string;
  }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch('/payments/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        challan_id: challanId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Payment verification failed.');
    }
    return {
      success: true,
      message: data.message,
      receiptPdfPath: data.receipt_pdf_path,
    };
  },

  // Get printable 1-page receipt from backend
  async getReceipt(challanId: string): Promise<{
    challanId: string;
    receiptNumber: string;
    vehiclePlate: string;
    ownerName: string;
    violationName: string;
    legalSection: string;
    amount: number;
    transactionId: string;
    paidAt: string;
    pdfUrl: string;
    qrUrl: string;
    verificationUrl: string;
  }> {
    const token = localStorage.getItem('auth_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await apiFetch(`/payments/receipt/${challanId}`, { headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'Failed to load official receipt.');
    }
    return {
      challanId: data.challan_id,
      receiptNumber: data.receipt_number,
      vehiclePlate: data.vehicle_plate,
      ownerName: data.owner_name,
      violationName: data.violation_name,
      legalSection: data.legal_section,
      amount: data.amount,
      transactionId: data.transaction_id,
      paidAt: data.paid_at,
      pdfUrl: data.pdf_url,
      qrUrl: data.qr_url,
      verificationUrl: data.verification_url,
    };
  },

  // Legacy fallback method for compatibility
  async payChallan(challanId: string, paymentMethod: string): Promise<{ success: boolean; challan: Challan }> {
    try {
      const init = await this.initiatePayment(challanId);
      const fakePayId = `pay_${Date.now()}`;
      await this.verifyPayment(challanId, init.orderId, fakePayId);
    } catch {
      // Ignore if mocked
    }
    const challans = getStoredChallans();
    const index = challans.findIndex((c) => c.id === challanId);
    if (index !== -1) {
      challans[index].status = 'paid';
      challans[index].payment = {
        paymentId: `PAY-TXN-${Date.now().toString().slice(-8)}`,
        amount: challans[index].fineAmount,
        paidAt: new Date().toISOString(),
        method: paymentMethod,
        receiptPdfPath: `${challans[index].vehiclePlate}_receipt_${challanId}.pdf`,
      };
      saveStoredChallans(challans);
      return { success: true, challan: challans[index] };
    }
    return {
      success: true,
      challan: {
        id: challanId,
        vehiclePlate: 'MH37AB0949',
        violation: 'Violation',
        violationCode: 'VIOLATION',
        fineAmount: 500,
        status: 'paid',
        violationDatetime: new Date().toISOString(),
        location: 'Highway Patrol',
      },
    };
  },

  // Dispute Challan
  async disputeChallan(challanId: string, reason: string): Promise<Challan> {
    const challans = getStoredChallans();
    const index = challans.findIndex((c) => c.id === challanId);
    if (index === -1) throw new Error('Challan not found');

    challans[index].status = 'disputed';
    challans[index].disputeReason = reason;
    challans[index].disputeStatus = 'under_review';
    saveStoredChallans(challans);

    const analytics = getStoredAnalytics();
    analytics.disputedCount += 1;
    saveStoredAnalytics(analytics);

    return challans[index];
  },

  // Resolve Dispute (Admin)
  async resolveDispute(challanId: string, approve: boolean): Promise<Challan> {
    const challans = getStoredChallans();
    const index = challans.findIndex((c) => c.id === challanId);
    if (index === -1) throw new Error('Challan not found');

    if (approve) {
      challans[index].status = 'cancelled';
      challans[index].disputeStatus = 'approved';
    } else {
      challans[index].status = 'pending';
      challans[index].disputeStatus = 'rejected';
    }
    saveStoredChallans(challans);
    return challans[index];
  },

  // AI Detect Violation (Officer File Upload or Live Snapshot)
  async detectViolation(fileOrBlob: File | Blob, location?: string): Promise<DetectionResult> {
    // Generate realistic AI detection response
    const presets = [
      {
        plate: 'MH12DE1433',
        plateConf: 0.97,
        violations: ['no_helmet'],
        label: 'Riding Without Helmet',
        boxes: [
          { label: 'Rider: No Helmet (96%)', confidence: 0.96, box: [15, 36, 42, 64] as [number, number, number, number], color: '#ef4444' },
          { label: 'Plate: MH12DE1433 (97%)', confidence: 0.97, box: [65, 40, 82, 60] as [number, number, number, number], color: '#3b82f6' },
        ],
      },
      {
        plate: 'MH14EU8921',
        plateConf: 0.95,
        violations: ['wrong_side'],
        label: 'Wrong Side Driving',
        boxes: [
          { label: 'Wrong Side Trajectory (95%)', confidence: 0.95, box: [20, 25, 80, 75] as [number, number, number, number], color: '#dc2626' },
          { label: 'Plate: MH14EU8921 (98%)', confidence: 0.98, box: [70, 35, 85, 55] as [number, number, number, number], color: '#3b82f6' },
        ],
      },
      {
        plate: 'MH02CD4590',
        plateConf: 0.93,
        violations: ['triple_riding'],
        label: 'Triple Riding Detected',
        boxes: [
          { label: '3 Persons on Two-Wheeler (93%)', confidence: 0.93, box: [22, 30, 70, 72] as [number, number, number, number], color: '#eab308' },
          { label: 'Plate: MH02CD4590 (94%)', confidence: 0.94, box: [75, 42, 88, 58] as [number, number, number, number], color: '#3b82f6' },
        ],
      },
    ];

    const pick = presets[Math.floor(Math.random() * presets.length)];
    const vehicle = getStoredVehicles().find((v) => v.plateNumber === pick.plate);

    const imageUrl = URL.createObjectURL(fileOrBlob);

    return {
      message: `Violation detected: ${pick.label}`,
      plateNumber: pick.plate,
      plateConfidence: pick.plateConf,
      violationsFound: pick.violations,
      boxes: pick.boxes,
      evidenceUrl: imageUrl,
      matchedVehicle: vehicle,
    };
  },

  // Issue Challan (from AI detection or manual)
  async issueChallan(payload: {
    plateNumber: string;
    violationCode: string;
    violationName: string;
    fineAmount: number;
    location: string;
    evidenceUrl?: string;
    annotations?: any[];
    aiConfidence?: number;
    detectionSource?: 'ai' | 'manual';
  }): Promise<{ challan: Challan; notifiedOwner: boolean }> {
    const challans = getStoredChallans();
    const vehicles = getStoredVehicles();
    const vehicle = vehicles.find((v) => v.plateNumber === payload.plateNumber.toUpperCase());

    const newChallan: Challan = {
      id: `CH-2026-${Math.floor(10000 + Math.random() * 90000)}`,
      vehiclePlate: payload.plateNumber.toUpperCase(),
      vehicleModel: vehicle?.model || 'Motor Vehicle',
      violation: payload.violationName,
      violationCode: payload.violationCode,
      fineAmount: payload.fineAmount,
      status: 'pending',
      detectionSource: payload.detectionSource || 'ai',
      aiConfidenceScore: payload.aiConfidence || 0.94,
      violationDatetime: new Date().toISOString(),
      location: payload.location || 'Traffic Division, Maharashtra',
      latitude: 18.5204,
      longitude: 73.8412,
      evidence: [
        {
          filePath: payload.evidenceUrl || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80',
          fileType: 'image',
          capturedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          cameraLocation: payload.location,
          annotations: payload.annotations || [],
        },
      ],
    };

    challans.unshift(newChallan);
    saveStoredChallans(challans);

    // Update analytics
    const analytics = getStoredAnalytics();
    analytics.totalChallans += 1;
    analytics.pendingCount += 1;
    saveStoredAnalytics(analytics);

    return { challan: newChallan, notifiedOwner: !!vehicle?.ownerMobile };
  },

  // Lookup Vehicle by Plate
  async lookupVehicle(plate: string): Promise<Vehicle | null> {
    const vehicles = getStoredVehicles();
    return vehicles.find((v) => v.plateNumber.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase()) || null;
  },

  // Lookup Vehicle Summary by Plate
  async lookupVehicleSummary(plate: string): Promise<any> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await apiFetch(`/vehicles/${encodeURIComponent(plate)}/summary`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback
    }
    const vehicles = getStoredVehicles();
    const v = vehicles.find((item) => item.plateNumber.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase());
    const challans = getStoredChallans().filter((c) => c.vehiclePlate.replace(/\s+/g, '').toUpperCase() === plate.replace(/\s+/g, '').toUpperCase());
    const pendingChallans = challans.filter((c) => c.status === 'pending');
    return {
      plate_number: plate,
      vehicle_type: v?.vehicleType || '2-Wheeler',
      model: v?.model || 'Standard',
      pending_challans: pendingChallans.length,
      total_challan_amount: pendingChallans.reduce((sum, c) => sum + c.fineAmount, 0),
    };
  },
};
