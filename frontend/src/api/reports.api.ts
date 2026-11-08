import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type {
  ReportsOverviewData,
  ReportTicketItem,
  DepartmentReportItem,
  AgentPerformanceItem,
  ReportFilterParams,
} from '../types/reports';

export interface PaginatedTicketsReportResponse {
  tickets: ReportTicketItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const reportsApi = {
  async getOverview(params?: ReportFilterParams): Promise<ReportsOverviewData> {
    const res = await apiClient.get<ApiResponse<ReportsOverviewData>>('/reports/overview', {
      params,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch reports overview');
    }
    return res.data.data;
  },

  async getTickets(params?: ReportFilterParams): Promise<PaginatedTicketsReportResponse> {
    const res = await apiClient.get<ApiResponse<PaginatedTicketsReportResponse>>('/reports/tickets', {
      params,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch ticket reports');
    }
    return res.data.data;
  },

  async getDepartments(params?: ReportFilterParams): Promise<DepartmentReportItem[]> {
    const res = await apiClient.get<ApiResponse<{ departments: DepartmentReportItem[] }>>(
      '/reports/departments',
      { params }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch department reports');
    }
    return res.data.data.departments;
  },

  async getAgents(params?: ReportFilterParams): Promise<AgentPerformanceItem[]> {
    const res = await apiClient.get<ApiResponse<{ agents: AgentPerformanceItem[] }>>(
      '/reports/agents',
      { params }
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch agent performance reports');
    }
    return res.data.data.agents;
  },

  async exportReport(
    type: 'overview' | 'tickets' | 'departments' | 'agents',
    params?: ReportFilterParams
  ): Promise<void> {
    const res = await apiClient.get('/reports/export', {
      params: { ...params, type },
      responseType: 'blob',
    });

    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `meladesk-${type}-report-${dateStr}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
