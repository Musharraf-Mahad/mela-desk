import { useState } from 'react';
import { Button } from '../../components/common/Button';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Plus, ShieldAlert } from 'lucide-react';

interface SystemCategory {
  key: string;
  name: string;
  description: string;
  status: 'Active';
}

const SUPPORTED_CATEGORIES: SystemCategory[] = [
  {
    key: 'billing',
    name: 'Billing & Payments',
    description: 'Invoicing, payment processing, charge disputes, and subscription queries',
    status: 'Active',
  },
  {
    key: 'account',
    name: 'Account Access',
    description: 'Authentication issues, password resets, login lockouts, and permissions',
    status: 'Active',
  },
  {
    key: 'technical',
    name: 'Technical Issue',
    description: 'Software defects, API errors, system crashes, and platform bugs',
    status: 'Active',
  },
  {
    key: 'orders',
    name: 'Orders & Deliveries',
    description: 'Order fulfillment status, package tracking, and shipment delays',
    status: 'Active',
  },
  {
    key: 'general',
    name: 'General Inquiries',
    description: 'General support requests and non-technical customer inquiries',
    status: 'Active',
  },
];

export function SystemSettingsPage() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            System Settings & Categories
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            View system-wide ticket categories, database constraints, and service configurations.
          </p>
        </div>
        <div>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Category
          </Button>
        </div>
      </div>

      <Alert type="info" title="Backend Configuration Constraint">
        Ticket categories are governed by the database schema enum (<code>billing</code>,{' '}
        <code>account</code>, <code>technical</code>, <code>orders</code>, <code>general</code>).
        Dynamic runtime category mutation is not currently supported by the backend API.
      </Alert>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category Key</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SUPPORTED_CATEGORIES.map((cat) => (
              <TableRow key={cat.key}>
                <TableCell className="font-mono text-xs text-blue-700 font-semibold">
                  {cat.key}
                </TableCell>
                <TableCell className="font-semibold text-[#0F172A]">
                  {cat.name}
                </TableCell>
                <TableCell className="text-slate-600 text-xs">
                  {cat.description}
                </TableCell>
                <TableCell>
                  <Badge variant="emerald">{cat.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add Category Modal informing unsupported action */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Ticket Category"
        footer={
          <Button type="button" onClick={() => setIsAddModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>Operation not supported by backend</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            The backend API does not currently expose a persistent endpoint to register new ticket
            categories. Ticket categories are constrained by the Prisma schema enum and MySQL database
            definition.
          </p>
          <p className="text-xs text-slate-500">
            To add new categories, contact the engineering team to coordinate a Prisma schema migration.
          </p>
        </div>
      </Modal>
    </div>
  );
}
