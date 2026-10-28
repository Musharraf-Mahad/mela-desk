import apiClient from './client';
import type { ApiResponse, PaginationMeta } from '../types/api';
import type { AuditLog } from '../types/ticket';

export interface PaginatedAuditLogs {
  auditLogs: AuditLog[];
  pagination: PaginationMeta;
}

export interface AuditLogFilterParams {
  ticketId?: string;
  userId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export const auditLogApi = {
  async getAuditLogs(params?: AuditLogFilterParams): Promise<PaginatedAuditLogs> {
    const res = await apiClient.get<ApiResponse<PaginatedAuditLogs>>('/audit-logs', { params });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load audit logs');
    }
    return res.data.data;
  },
};
