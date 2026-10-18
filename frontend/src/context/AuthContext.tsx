import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { DEMO_USERS } from '../services/mockData';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loginCitizen: (user: User, token?: string) => void;
  loginOwner: (user: User, token?: string) => void;
  loginOfficerOrAdmin: (user: User, token?: string) => void;
  updateUser: (updatedUser: Partial<User>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('echallan_current_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('echallan_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('echallan_current_user');
      localStorage.removeItem('auth_token');
    }
  }, [user]);

  const loginCitizen = (userData: User, token?: string) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    setUser({ ...userData, role: userData.role || 'owner' });
  };

  const loginOwner = (userData: User, token?: string) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    setUser({ ...userData, role: 'owner' });
  };

  const loginOfficerOrAdmin = (userData: User, token?: string) => {
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    setUser(userData);
  };

  const updateUser = (updatedUser: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('echallan_current_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : null,
        isAuthenticated: !!user,
        loginCitizen,
        loginOwner,
        loginOfficerOrAdmin,
        updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
