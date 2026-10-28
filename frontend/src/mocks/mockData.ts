import type { User } from '../types/auth';
import type { Ticket, Comment } from '../types/ticket';

/**
 * Mock data for local UI preview and development.
 * Kept separate from real API integration code.
 */

export const MOCK_USERS: Record<'customer' | 'agent' | 'admin', User> = {
  customer: {
    id: 'user-c-101',
    name: 'Amina Yusuf',
    email: 'amina@example.com',
    role: 'customer',
    isActive: true,
    createdAt: '2026-10-10T08:00:00Z',
  },
  agent: {
    id: 'user-a-201',
    name: 'Abdi Ali',
    email: 'abdi@example.com',
    role: 'agent',
    isActive: true,
    createdAt: '2026-10-05T09:30:00Z',
  },
  admin: {
    id: 'user-adm-001',
    name: 'Omar Hassan',
    email: 'omar@example.com',
    role: 'admin',
    isActive: true,
    createdAt: '2026-09-01T12:00:00Z',
  },
};

export const MOCK_ALL_USERS: User[] = [
  MOCK_USERS.customer,
  MOCK_USERS.agent,
  {
    id: 'user-c-102',
    name: 'Sara Noor',
    email: 'sara@example.com',
    role: 'customer',
    isActive: false,
    createdAt: '2026-10-15T11:00:00Z',
  },
  MOCK_USERS.admin,
  {
    id: 'user-a-202',
    name: 'Hodan Muse',
    email: 'hodan@example.com',
    role: 'agent',
    isActive: true,
    createdAt: '2026-10-10T14:15:00Z',
  },
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'comm-1',
    ticketId: 'MD-1048',
    authorId: 'user-c-101',
    author: {
      id: 'user-c-101',
      name: 'Amina Yusuf',
      role: 'customer',
    },
    body: 'I cannot access my account.',
    isInternal: false,
    createdAt: '2026-10-28T08:30:00Z',
    updatedAt: '2026-10-28T08:30:00Z',
  },
  {
    id: 'comm-2',
    ticketId: 'MD-1048',
    authorId: 'user-a-201',
    author: {
      id: 'user-a-201',
      name: 'Abdi Ali',
      role: 'agent',
    },
    body: 'I will investigate this for you.',
    isInternal: false,
    createdAt: '2026-10-28T08:45:00Z',
    updatedAt: '2026-10-28T08:45:00Z',
  },
  {
    id: 'comm-3',
    ticketId: 'MD-1048',
    authorId: 'user-a-201',
    author: {
      id: 'user-a-201',
      name: 'Abdi Ali',
      role: 'agent',
    },
    body: 'Internal note: Customer account was locked due to 3 failed attempts. Password reset link dispatched.',
    isInternal: true,
    createdAt: '2026-10-28T09:00:00Z',
    updatedAt: '2026-10-28T09:00:00Z',
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'MD-1048',
    customerId: 'user-c-101',
    assigneeId: 'user-a-201',
    customer: {
      id: 'user-c-101',
      name: 'Amina Yusuf',
      email: 'amina@example.com',
    },
    assignee: {
      id: 'user-a-201',
      name: 'Abdi Ali',
      email: 'abdi@example.com',
    },
    subject: 'Password reset issue',
    description: 'I cannot access my account and password reset email is delayed.',
    category: 'account',
    priority: 'high',
    status: 'open',
    createdAt: '2026-10-28T08:30:00Z',
    updatedAt: '10 min ago',
    comments: MOCK_COMMENTS,
  },
  {
    id: 'MD-1047',
    customerId: 'user-c-101',
    assigneeId: 'user-a-201',
    customer: {
      id: 'user-c-101',
      name: 'Amina Yusuf',
      email: 'amina@example.com',
    },
    assignee: {
      id: 'user-a-201',
      name: 'Abdi Ali',
      email: 'abdi@example.com',
    },
    subject: 'Payment confirmation',
    description: 'Charged twice on invoice #INV-492.',
    category: 'billing',
    priority: 'normal',
    status: 'in_progress',
    createdAt: '2026-10-28T07:30:00Z',
    updatedAt: '1 hr ago',
  },
  {
    id: 'MD-1046',
    customerId: 'user-c-102',
    assigneeId: null,
    customer: {
      id: 'user-c-102',
      name: 'Sara Noor',
      email: 'sara@example.com',
    },
    assignee: null,
    subject: 'Account access',
    description: '2FA authentication code not received via SMS.',
    category: 'account',
    priority: 'urgent',
    status: 'open',
    createdAt: '2026-10-28T06:30:00Z',
    updatedAt: '2 hr ago',
  },
  {
    id: 'MD-1045',
    customerId: 'user-c-101',
    assigneeId: 'user-a-202',
    customer: {
      id: 'user-c-101',
      name: 'Amina Yusuf',
      email: 'amina@example.com',
    },
    assignee: {
      id: 'user-a-202',
      name: 'Hodan Muse',
      email: 'hodan@example.com',
    },
    subject: 'Profile update',
    description: 'Need to update billing address and registered phone number.',
    category: 'general',
    priority: 'low',
    status: 'resolved',
    createdAt: '2026-10-27T10:00:00Z',
    updatedAt: 'Yesterday',
  },
  {
    id: 'MD-1044',
    customerId: 'user-c-102',
    assigneeId: 'user-a-201',
    customer: {
      id: 'user-c-102',
      name: 'Sara Noor',
      email: 'sara@example.com',
    },
    assignee: {
      id: 'user-a-201',
      name: 'Abdi Ali',
      email: 'abdi@example.com',
    },
    subject: 'Email change',
    description: 'Requesting email change to new university address.',
    category: 'account',
    priority: 'normal',
    status: 'closed',
    createdAt: '2026-10-26T14:00:00Z',
    updatedAt: '2 days ago',
  },
];

export const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Account Access', description: 'Login and password issues', status: 'Enabled' },
  { id: 'cat-2', name: 'Billing', description: 'Payments and invoices', status: 'Enabled' },
  { id: 'cat-3', name: 'Technical Issue', description: 'Errors and product problems', status: 'Enabled' },
  { id: 'cat-4', name: 'General Question', description: 'Other customer requests', status: 'Enabled' },
];
