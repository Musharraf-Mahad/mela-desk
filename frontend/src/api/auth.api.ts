import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type {
  User,
  LoginCredentials,
  RegisterData,
  ChangePasswordData,
  UpdateProfileData,
} from '../types/auth';

export const authApi = {
  async register(data: RegisterData): Promise<{ user: User }> {
    const res = await apiClient.post<ApiResponse<{ user: User }>>('/auth/register', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Registration failed');
    }
    return res.data.data;
  },

  async login(credentials: LoginCredentials): Promise<{ user: User }> {
    const res = await apiClient.post<ApiResponse<{ user: User }>>('/auth/login', credentials);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Login failed');
    }
    return res.data.data;
  },

  async getMe(): Promise<{ user: User }> {
    const res = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Session expired or invalid');
    }
    return res.data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post<ApiResponse<void>>('/auth/logout');
  },

  async updateProfile(data: UpdateProfileData): Promise<{ user: User }> {
    const res = await apiClient.patch<ApiResponse<{ user: User }>>('/auth/profile', data);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update profile');
    }
    return res.data.data;
  },

  async changePassword(data: ChangePasswordData): Promise<string> {
    const res = await apiClient.post<ApiResponse<void>>('/auth/change-password', data);
    return res.data.message || 'Password changed successfully';
  },
};
