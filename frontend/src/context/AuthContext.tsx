import React, { createContext, useContext, useState } from 'react';
import type { User, UserRole, LoginCredentials, RegisterData } from '../types/auth';
import { MOCK_USERS } from '../mocks/mockData';

/**
 * DEVELOPMENT AUTHENTICATION CONTEXT
 *
 * IMPORTANT SECURITY NOTICE:
 * This client-side authentication context and role switcher are strictly for
 * local development, UI prototyping, and testing.
 *
 * Client-side role guards are UX aids only to provide appropriate navigation;
 * real authorization and security MUST be enforced independently by the backend
 * API using HttpOnly session cookies (mela_desk_session).
 */

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  /** Dev-only role switcher to easily test Customer, Agent, and Admin views */
  devSwitchRole: (role: UserRole) => void;
}

const STORAGE_KEY = 'mela_desk_dev_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback if localStorage parsing fails
    }
    // Default to mock customer for initial preview
    return MOCK_USERS.customer;
  });

  const login = async (credentials: LoginCredentials): Promise<void> => {
    // Determine which mock persona matches or default based on email
    let matchedUser = Object.values(MOCK_USERS).find(
      (u) => u.email.toLowerCase() === credentials.email.toLowerCase()
    );

    if (!matchedUser) {
      // If user typed admin/agent/customer or custom email, assign appropriately
      if (credentials.email.toLowerCase().includes('admin')) {
        matchedUser = MOCK_USERS.admin;
      } else if (credentials.email.toLowerCase().includes('agent')) {
        matchedUser = MOCK_USERS.agent;
      } else {
        matchedUser = {
          id: `usr-${Date.now()}`,
          name: credentials.email.split('@')[0] || 'Customer User',
          email: credentials.email,
          role: 'customer',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
      }
    }

    setUser(matchedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matchedUser));
  };

  const register = async (data: RegisterData): Promise<void> => {
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: data.name,
      email: data.email,
      role: 'customer', // Public registration ALWAYS registers as customer
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const devSwitchRole = (newRole: UserRole) => {
    const switched = MOCK_USERS[newRole];
    setUser(switched);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(switched));
  };

  const value: AuthContextType = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    devSwitchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
