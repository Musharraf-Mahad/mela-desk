import type { User } from './auth';

/**
 * Ticket status matching backend Prisma schema:
 * open | in_progress | pending | resolved | closed
 */
export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';

/**
 * Ticket priority matching backend Prisma schema:
 * low | normal | high | urgent
 */
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Ticket category matching backend Prisma schema:
 * billing | account | technical | orders | general
 */
export type TicketCategory = 'billing' | 'account' | 'technical' | 'orders' | 'general';

export interface Comment {
  id: string;
  ticketId: string;
  authorId: string;
  author?: Pick<User, 'id' | 'name' | 'role'>;
  body: string;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  assigneeId?: string | null;
  customer?: Pick<User, 'id' | 'name' | 'email'>;
  assignee?: Pick<User, 'id' | 'name' | 'email'> | null;
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
  user?: Pick<User, 'id' | 'name' | 'role'> | null;
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
  limit?: number;
}
