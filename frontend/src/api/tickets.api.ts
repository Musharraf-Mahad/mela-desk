import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type {
  Ticket,
  Comment,
  CreateTicketPayload,
  PaginatedTickets,
  TicketFilterParams,
  TicketStatus,
} from '../types/ticket';

export const ticketApi = {
  async createTicket(payload: CreateTicketPayload): Promise<Ticket> {
    const res = await apiClient.post<ApiResponse<{ ticket: Ticket }>>('/tickets', payload);
    if (!res.data.data?.ticket) {
      throw new Error(res.data.message || 'Failed to create ticket');
    }
    return res.data.data.ticket;
  },

  async getTickets(params?: TicketFilterParams): Promise<PaginatedTickets> {
    const query: Record<string, string | number> = {};
    if (params?.status && params.status !== 'all') query.status = params.status;
    if (params?.priority && params.priority !== 'all') query.priority = params.priority;
    if (params?.category && params.category !== 'all') query.category = params.category;
    if (params?.search && params.search.trim()) query.search = params.search.trim();
    if (params?.page) query.page = params.page;
    if (params?.pageSize) query.pageSize = params.pageSize;

    const res = await apiClient.get<ApiResponse<PaginatedTickets>>('/tickets', { params: query });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load tickets');
    }
    return res.data.data;
  },

  async getQueue(params?: TicketFilterParams): Promise<PaginatedTickets> {
    const query: Record<string, string | number> = {};
    if (params?.priority && params.priority !== 'all') query.priority = params.priority;
    if (params?.category && params.category !== 'all') query.category = params.category;
    if (params?.search && params.search.trim()) query.search = params.search.trim();
    if (params?.page) query.page = params.page;
    if (params?.pageSize) query.pageSize = params.pageSize;

    const res = await apiClient.get<ApiResponse<PaginatedTickets>>('/tickets/queue', { params: query });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to load support queue');
    }
    return res.data.data;
  },

  async getTicketById(ticketId: string): Promise<Ticket> {
    const res = await apiClient.get<ApiResponse<{ ticket: Ticket }>>(`/tickets/${ticketId}`);
    if (!res.data.data?.ticket) {
      throw new Error(res.data.message || 'Failed to load ticket details');
    }
    return res.data.data.ticket;
  },

  async addComment(ticketId: string, body: string, isInternal = false): Promise<Comment> {
    const payload: { body: string; isInternal?: boolean } = { body };
    if (isInternal) {
      payload.isInternal = true;
    }
    const res = await apiClient.post<ApiResponse<{ comment: Comment }>>(
      `/tickets/${ticketId}/comments`,
      payload
    );
    if (!res.data.data?.comment) {
      throw new Error(res.data.message || 'Failed to post comment');
    }
    return res.data.data.comment;
  },

  async updateStatus(ticketId: string, status: TicketStatus): Promise<Ticket> {
    const res = await apiClient.patch<ApiResponse<{ ticket: Ticket }>>(
      `/tickets/${ticketId}/status`,
      { status }
    );
    if (!res.data.data?.ticket) {
      throw new Error(res.data.message || 'Failed to update ticket status');
    }
    return res.data.data.ticket;
  },

  async assignTicket(ticketId: string, assigneeId: string | null): Promise<Ticket> {
    const res = await apiClient.patch<ApiResponse<{ ticket: Ticket }>>(
      `/tickets/${ticketId}/assignee`,
      { assigneeId }
    );
    if (!res.data.data?.ticket) {
      throw new Error(res.data.message || 'Failed to update ticket assignee');
    }
    return res.data.data.ticket;
  },

  async claimTicket(ticketId: string): Promise<Ticket> {
    const res = await apiClient.post<ApiResponse<{ ticket: Ticket }>>(
      `/tickets/${ticketId}/claim`
    );
    if (!res.data.data?.ticket) {
      throw new Error(res.data.message || 'Failed to claim ticket');
    }
    return res.data.data.ticket;
  },
};
