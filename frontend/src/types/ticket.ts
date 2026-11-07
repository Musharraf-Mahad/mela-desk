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

export interface Attachment {
  id: string;
  ticketId?: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploadedBy?: {
    id: string;
    name: string;
    role?: string;
  } | null;
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
  customerId?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  assigneeId?: string | null;
  departmentId?: string | null;
  customer?: TicketAuthor | null;
  assignee?: TicketAuthor | null;
  department?: { id: string; name: string } | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  attachments?: Attachment[];
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
  departmentId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  departmentId?: string | null;
}

export interface PaginatedTickets {
  tickets: Ticket[];
  pagination: PaginationMeta;
}

export interface PublicTicketSubmissionPayload {
  guestName: string;
  guestEmail: string;
  subject: string;
  description: string;
  category: TicketCategory;
  files?: File[];
}

export interface PublicTicketSubmissionResponse {
  ticketNumber: string;
  trackingToken: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  attachments?: Array<{ id: string; originalFilename: string; mimeType: string; fileSize: number }>;
}

export interface PublicTrackedComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  isStaff: boolean;
}

export interface PublicTicketTrackResponse {
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  guestName?: string;
  createdAt: string;
  updatedAt: string;
  comments: PublicTrackedComment[];
  attachments: Attachment[];
}
