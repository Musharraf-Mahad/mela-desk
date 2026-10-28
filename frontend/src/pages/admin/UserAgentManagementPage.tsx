import { useState, useMemo } from 'react';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
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
import { RoleBadge, Badge } from '../../components/common/Badge';
import { MOCK_ALL_USERS } from '../../mocks/mockData';
import { Search } from 'lucide-react';
import type { UserRole } from '../../types/auth';

export function UserAgentManagementPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const filteredUsers = useMemo(() => {
    return MOCK_ALL_USERS.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [search, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <Input
          label="Search"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <Select
          label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'customer', label: 'Customer' },
            { value: 'agent', label: 'Support Agent' },
            { value: 'admin', label: 'Administrator' },
          ]}
        />

        <div>
          <Button type="button" className="w-full justify-center">
            Filter
          </Button>
        </div>
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-semibold text-[#0F172A]">
                  {user.name}
                </TableCell>
                <TableCell className="text-slate-600 font-mono text-xs">
                  {user.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role as UserRole} />
                </TableCell>
                <TableCell>
                  {user.isActive ? (
                    <Badge variant="emerald">Active</Badge>
                  ) : (
                    <Badge variant="slate">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#64748B]">
                  {new Date(user.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
