import type { PaginationMeta } from './api';

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TicketCategory = 'billing' | 'account' | 'technical' | 'orders' | 'general';

export interface TicketAuthor {
  id: string;
  name: string;
  role?: string;
  email?: string;
}

export interface Comment {
  id: string;
  ticketId?: string;
  authorId?: string;
  author?: TicketAuthor;
  body: string;
  isInternal?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Ticket {
  id: string;
  ticketNumber?: string;
  customerId?: string;
  assigneeId?: string | null;
  customer?: TicketAuthor;
  assignee?: TicketAuthor | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
}

export interface AuditLog {
  id: string;
  ticketId?: string | null;
  userId?: string | null;
  user?: TicketAuthor | null;
  action: string;
  details?: string | null;
  createdAt: string;
}

export interface TicketFilterParams {
  search?: string;
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  category?: TicketCategory | 'all';
  page?: number;
  pageSize?: number;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  pagination: PaginationMeta;
}
