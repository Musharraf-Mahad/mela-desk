export type UserRole = 'customer' | 'agent' | 'department_head' | 'head' | 'admin';

export interface DepartmentWorkload {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  closed: number;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  headId?: string | null;
  head?: User | null;
  members?: User[];
  _count?: {
    members?: number;
    tickets?: number;
  };
  workload?: {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  departmentId?: string | null;
  department?: Department | null;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileData {
  name: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
  };
}
