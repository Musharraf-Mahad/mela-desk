import { useState, useEffect } from 'react';
import { Input } from '../../components/common/Input';
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
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { userApi, type AgentItem } from '../../api/users.api';
import type { PaginationMeta } from '../../types/api';
import { Search, Plus, KeyRound } from 'lucide-react';

export function UserAgentManagementPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create Agent modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  // Reset Password modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedAgentForReset, setSelectedAgentForReset] = useState<AgentItem | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await userApi.getAgents({ page, pageSize: 20 });
        if (isMounted) {
          setAgents(data.agents);
          setPagination(data.pagination);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load agents');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [page, refreshTrigger]);

  const handleCreateAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);
    setIsCreatingAgent(true);

    try {
      await userApi.createAgent({
        name: newAgentName.trim(),
        email: newAgentEmail.trim(),
        password: newAgentPassword,
      });

      setSuccessMessage(`Agent "${newAgentName}" created successfully!`);
      setIsCreateModalOpen(false);
      setNewAgentName('');
      setNewAgentEmail('');
      setNewAgentPassword('');
      setIsLoading(true);
      setRefreshTrigger((t) => t + 1);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to create agent. Password must be 12-128 characters.';
      setCreateModalError(msg);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForReset) return;

    setResetModalError(null);
    setIsResettingPassword(true);

    try {
      const msg = await userApi.resetAgentPassword(selectedAgentForReset.id, resetPasswordValue);
      setSuccessMessage(msg);
      setIsResetModalOpen(false);
      setSelectedAgentForReset(null);
      setResetPasswordValue('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to reset password. Must be 12-128 characters.';
      setResetModalError(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleToggleAgentStatus = async (agent: AgentItem) => {
    setError(null);
    const newStatus = !agent.isActive;

    try {
      await userApi.updateUserStatus(agent.id, newStatus);
      setSuccessMessage(`Agent status updated.`);
      setIsLoading(true);
      setRefreshTrigger((t) => t + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update agent status');
    }
  };

  const filteredAgents = agents.filter(
    (ag) =>
      ag.name.toLowerCase().includes(search.toLowerCase()) ||
      ag.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            Support Agent Management
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            Create agent accounts, manage assignments, and reset agent credentials.
          </p>
        </div>
        <div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Agent
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      {/* Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <Input
          label="Search"
          placeholder="Search by agent name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Assigned Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  Loading agents...
                </TableCell>
              </TableRow>
            ) : filteredAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  No agents found. Click "Create Agent" to add the first agent.
                </TableCell>
              </TableRow>
            ) : (
              filteredAgents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-semibold text-[#0F172A]">
                    {agent.name}
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-xs">
                    {agent.email}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role="agent" />
                  </TableCell>
                  <TableCell>
                    {agent.isActive !== false ? (
                      <Badge variant="emerald">Active</Badge>
                    ) : (
                      <Badge variant="slate">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<KeyRound className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setSelectedAgentForReset(agent);
                          setResetModalError(null);
                          setResetPasswordValue('');
                          setIsResetModalOpen(true);
                        }}
                      >
                        Reset Password
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={agent.isActive !== false ? 'text-rose-600' : 'text-emerald-600'}
                        onClick={() => handleToggleAgentStatus(agent)}
                      >
                        {agent.isActive !== false ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-sm text-slate-500">
          <div>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} agents total)
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Support Agent Account"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isCreatingAgent}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-agent-form"
              isLoading={isCreatingAgent}
              disabled={isCreatingAgent}
            >
              Create Agent
            </Button>
          </>
        }
      >
        <form id="create-agent-form" onSubmit={handleCreateAgentSubmit} className="space-y-4">
          {createModalError && <Alert type="error">{createModalError}</Alert>}

          <Input
            label="Agent Full Name"
            placeholder="e.g. Abdi Ali"
            value={newAgentName}
            onChange={(e) => setNewAgentName(e.target.value)}
            required
          />

          <Input
            label="Agent Email Address"
            type="email"
            placeholder="agent@example.com"
            value={newAgentEmail}
            onChange={(e) => setNewAgentEmail(e.target.value)}
            required
          />

          <Input
            label="Temporary Password"
            type="password"
            placeholder="At least 12 characters"
            value={newAgentPassword}
            onChange={(e) => setNewAgentPassword(e.target.value)}
            helperText="Must be between 12 and 128 characters."
            required
          />
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title={`Reset Password for ${selectedAgentForReset?.name}`}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsResetModalOpen(false)}
              disabled={isResettingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="reset-password-form"
              isLoading={isResettingPassword}
              disabled={isResettingPassword}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <form id="reset-password-form" onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {resetModalError && <Alert type="error">{resetModalError}</Alert>}

          <p className="text-xs text-slate-500">
            Resetting the password will immediately revoke all active sessions for this agent.
          </p>

          <Input
            label="New Password"
            type="password"
            placeholder="At least 12 characters"
            value={resetPasswordValue}
            onChange={(e) => setResetPasswordValue(e.target.value)}
            helperText="Must be between 12 and 128 characters."
            required
          />
        </form>
      </Modal>
    </div>
  );
}
