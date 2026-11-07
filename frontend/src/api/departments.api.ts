import apiClient from './client';
import type { ApiResponse, PaginationMeta } from '../types/api';
import type { Department, User } from '../types/auth';

export interface DepartmentWorkloadSummary {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  closed: number;
}

export interface MyDepartmentResponse {
  department: Department;
  workload: DepartmentWorkloadSummary;
}

export interface OrganizationOverviewResponse {
  departments: Array<Department & { workload: { open: number; inProgress: number; resolved: number; closed: number } }>;
  globalStatus: Record<string, number>;
  totalTickets: number;
  agents: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    department?: { id: string; name: string } | null;
    activeAssignedTickets: number;
  }>;
}

export interface DepartmentListResponse {
  departments: Department[];
  pagination: PaginationMeta;
}

export const departmentApi = {
  async getDepartments(params?: { search?: string; page?: number; pageSize?: number }): Promise<DepartmentListResponse> {
    const res = await apiClient.get<ApiResponse<DepartmentListResponse>>('/departments', { params });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load departments');
    }
    return res.data.data;
  },

  async getDepartmentById(id: string): Promise<Department> {
    const res = await apiClient.get<ApiResponse<{ department: Department }>>(`/departments/${id}`);
    if (!res.data.data?.department) {
      throw new Error(res.data.message || 'Failed to load department details');
    }
    return res.data.data.department;
  },

  async createDepartment(data: { name: string; description?: string | null; headId?: string | null }): Promise<Department> {
    const res = await apiClient.post<ApiResponse<{ department: Department }>>('/departments', data);
    if (!res.data.data?.department) {
      throw new Error(res.data.message || 'Failed to create department');
    }
    return res.data.data.department;
  },

  async updateDepartment(
    id: string,
    data: { name?: string; description?: string | null; headId?: string | null }
  ): Promise<Department> {
    const res = await apiClient.patch<ApiResponse<{ department: Department }>>(`/departments/${id}`, data);
    if (!res.data.data?.department) {
      throw new Error(res.data.message || 'Failed to update department');
    }
    return res.data.data.department;
  },

  async deleteDepartment(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/departments/${id}`);
  },

  async getDepartmentMembers(id: string): Promise<User[]> {
    const res = await apiClient.get<ApiResponse<{ members: User[] }>>(`/departments/${id}/members`);
    if (!res.data.data?.members) {
      throw new Error(res.data.message || 'Failed to load department members');
    }
    return res.data.data.members;
  },

  async addDepartmentMember(id: string, userId: string): Promise<void> {
    await apiClient.post<ApiResponse<null>>(`/departments/${id}/members`, { userId });
  },

  async removeDepartmentMember(id: string, userId: string): Promise<void> {
    await apiClient.delete<ApiResponse<null>>(`/departments/${id}/members/${userId}`);
  },

  async getMyDepartmentDashboard(): Promise<MyDepartmentResponse> {
    const res = await apiClient.get<ApiResponse<MyDepartmentResponse>>('/departments/my');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load department dashboard');
    }
    return res.data.data;
  },

  async getOrganizationOverview(): Promise<OrganizationOverviewResponse> {
    const res = await apiClient.get<ApiResponse<OrganizationOverviewResponse>>('/departments/overview');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load organization overview');
    }
    return res.data.data;
  },
};
