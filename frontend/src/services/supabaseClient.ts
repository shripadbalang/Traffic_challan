import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hecwndibwlifchukdskd.supabase.co';
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// A non-empty fallback key ensures createClient does not crash synchronously at module load time
// before the user configures their actual Supabase anon key in frontend/.env
const safeAnonKey = rawAnonKey || 'placeholder-anon-key-configure-in-frontend-env';

export const isSupabaseConfigured = () => {
  return rawAnonKey !== '' && rawAnonKey !== 'placeholder-anon-key-configure-in-frontend-env';
};

if (!isSupabaseConfigured()) {
  console.warn(
    '[Supabase Auth] Notice: VITE_SUPABASE_ANON_KEY is not configured in frontend/.env. ' +
    'Please set VITE_SUPABASE_ANON_KEY from Supabase Dashboard -> Project Settings -> API to enable live OTP delivery.'
  );
}

export const getDemoUserId = (email: string): string => {
  const clean = email.trim().toLowerCase();
  const storageKey = `demo_uid_${clean}`;
  let uid = localStorage.getItem(storageKey);
  if (!uid) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      uid = crypto.randomUUID();
    } else {
      uid = 'a0000000-0000-4000-8000-' + Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0');
    }
    localStorage.setItem(storageKey, uid);
  }
  return uid;
};

export const supabase = createClient(supabaseUrl, safeAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


