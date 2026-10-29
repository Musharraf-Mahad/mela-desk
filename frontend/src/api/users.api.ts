import apiClient from './client';
import type { ApiResponse, PaginationMeta } from '../types/api';
import type { User, RegisterData } from '../types/auth';

export interface AgentItem {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
}

export interface CustomerItem {
  id: string;
  name: string;
  email: string;
  role?: string;
  isActive?: boolean;
  createdAt: string;
  _count?: {
    tickets: number;
  };
}

export interface PaginatedAgents {
  agents: AgentItem[];
  pagination: PaginationMeta;
}

export interface PaginatedCustomers {
  customers: CustomerItem[];
  pagination: PaginationMeta;
}

export const userApi = {
  async getAgents(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<PaginatedAgents> {
    const res = await apiClient.get<ApiResponse<PaginatedAgents>>('/users/agents', { params });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load agents');
    }
    return res.data.data;
  },

  async getCustomers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedCustomers> {
    const res = await apiClient.get<ApiResponse<PaginatedCustomers>>('/users/customers', { params });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load customers');
    }
    return res.data.data;
  },

  async createAgent(data: RegisterData): Promise<User> {
    const res = await apiClient.post<ApiResponse<{ agent: User }>>('/users/agents', data);
    if (!res.data.data?.agent) {
      throw new Error(res.data.message || 'Failed to create agent');
    }
    return res.data.data.agent;
  },

  async resetAgentPassword(agentId: string, password: string): Promise<string> {
    const res = await apiClient.patch<ApiResponse<void>>(`/users/agents/${agentId}/password`, {
      password,
    });
    return res.data.message || 'Password reset successfully';
  },

  async updateUserStatus(userId: string, isActive: boolean): Promise<User> {
    const res = await apiClient.patch<ApiResponse<{ user: User }>>(`/users/${userId}/status`, {
      isActive,
    });
    if (!res.data.data?.user) {
      throw new Error(res.data.message || 'Failed to update user status');
    }
    return res.data.data.user;
  },
};
