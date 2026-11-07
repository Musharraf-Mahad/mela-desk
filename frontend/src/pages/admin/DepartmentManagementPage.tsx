import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
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
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { departmentApi } from '../../api/departments.api';
import { userApi, type AgentItem } from '../../api/users.api';
import type { Department, User } from '../../types/auth';
import type { PaginationMeta } from '../../types/api';
import { Search, Plus, Building2, Users, Edit2, Trash2, UserPlus, UserMinus, ShieldCheck } from 'lucide-react';

export function DepartmentManagementPage() {
  const { t } = useTranslation();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Available agents list for assigning head or members
  const [allAgents, setAllAgents] = useState<AgentItem[]>([]);

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formHeadId, setFormHeadId] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Members Management Modal State
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedDeptForMembers, setSelectedDeptForMembers] = useState<Department | null>(null);
  const [deptMembers, setDeptMembers] = useState<User[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberToAddId, setMemberToAddId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load departments
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await departmentApi.getDepartments({
          search: debouncedSearch.trim() || undefined,
          page,
          pageSize: 20,
        });
        if (isMounted) {
          setDepartments(data.departments);
          setPagination(data.pagination);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('departments.loadError', 'Failed to load departments'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, page, refreshTrigger, t]);

  // Load active agents for dropdowns
  useEffect(() => {
    (async () => {
      try {
        const data = await userApi.getAgents({ pageSize: 100 });
        setAllAgents(data.agents);
      } catch {
        // Non-fatal if agents fail to preload
      }
    })();
  }, [refreshTrigger]);

  const handleOpenCreateModal = () => {
    setEditingDept(null);
    setFormName('');
    setFormDescription('');
    setFormHeadId('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (dept: Department) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setFormDescription(dept.description || '');
    setFormHeadId(dept.headId || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError(t('departments.nameRequired', 'Department name is required'));
      return;
    }

    setIsSubmittingForm(true);
    setFormError(null);

    try {
      if (editingDept) {
        await departmentApi.updateDepartment(editingDept.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          headId: formHeadId || null,
        });
        setSuccessMessage(t('departments.updateSuccess', 'Department updated successfully'));
      } else {
        await departmentApi.createDepartment({
          name: formName.trim(),
          description: formDescription.trim() || null,
          headId: formHeadId || null,
        });
        setSuccessMessage(t('departments.createSuccess', 'Department created successfully'));
      }
      setIsFormModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t('common.error', 'An error occurred'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleOpenMembersModal = async (dept: Department) => {
    setSelectedDeptForMembers(dept);
    setIsMembersModalOpen(true);
    setIsLoadingMembers(true);
    setMembersError(null);
    setMemberToAddId('');

    try {
      const members = await departmentApi.getDepartmentMembers(dept.id);
      setDeptMembers(members);
    } catch (err: unknown) {
      setMembersError(err instanceof Error ? err.message : t('departments.membersLoadError', 'Failed to load department members'));
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptForMembers || !memberToAddId) return;

    setIsAddingMember(true);
    setMembersError(null);

    try {
      await departmentApi.addDepartmentMember(selectedDeptForMembers.id, memberToAddId);
      const updatedMembers = await departmentApi.getDepartmentMembers(selectedDeptForMembers.id);
      setDeptMembers(updatedMembers);
      setMemberToAddId('');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setMembersError(err instanceof Error ? err.message : t('departments.addMemberError', 'Failed to add member'));
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedDeptForMembers) return;
    setIsLoadingMembers(true);
    try {
      await departmentApi.removeDepartmentMember(selectedDeptForMembers.id, userId);
      const updatedMembers = await departmentApi.getDepartmentMembers(selectedDeptForMembers.id);
      setDeptMembers(updatedMembers);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setMembersError(err instanceof Error ? err.message : t('departments.removeMemberError', 'Failed to remove member'));
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deptToDelete) return;
    setIsDeleting(true);
    try {
      await departmentApi.deleteDepartment(deptToDelete.id);
      setSuccessMessage(t('departments.deleteSuccess', 'Department deleted successfully'));
      setIsDeleteModalOpen(false);
      setDeptToDelete(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('departments.deleteError', 'Failed to delete department'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Agents available to be added as members (not currently in selected department)
  const availableAgentsForMember = allAgents.filter(
    (ag) => !deptMembers.some((m) => m.id === ag.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            {t('departments.title', 'Department Management')}
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            {t('departments.subtitle', 'Organize support agents into functional departments and designate department heads.')}
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} className="shrink-0 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('departments.newDepartment', 'New Department')}
        </Button>
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert type="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('departments.searchPlaceholder', 'Search departments by name or description...')}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('departments.departmentName', 'Department')}</TableHead>
                <TableHead>{t('departments.description', 'Description')}</TableHead>
                <TableHead>{t('departments.departmentHead', 'Department Head')}</TableHead>
                <TableHead>{t('departments.membersCount', 'Agents')}</TableHead>
                <TableHead>{t('departments.ticketsCount', 'Tickets')}</TableHead>
                <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                    {t('common.loading', 'Loading...')}
                  </TableCell>
                </TableRow>
              ) : departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium">{t('departments.noDepartmentsFound', 'No departments found')}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search ? t('departments.tryDifferentSearch', 'Try a different search term') : t('departments.createFirstDepartment', 'Create your first department to organize agents.')}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-semibold text-slate-900">
                      {dept.name}
                    </TableCell>
                    <TableCell className="text-slate-600 max-w-xs truncate text-xs">
                      {dept.description || <span className="text-slate-400 italic">—</span>}
                    </TableCell>
                    <TableCell>
                      {dept.head ? (
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-slate-800">{dept.head.name}</p>
                            <p className="text-[11px] text-slate-400">{dept.head.email}</p>
                          </div>
                        </div>
                      ) : (
                        <Badge variant="slate" size="sm">
                          {t('departments.noHeadAssigned', 'Unassigned')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="blue" size="sm">
                        <Users className="w-3 h-3 mr-1 inline" />
                        {dept._count?.members ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="slate" size="sm">
                        {dept._count?.tickets ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenMembersModal(dept)}
                          className="text-xs flex items-center gap-1"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {t('departments.manageMembers', 'Members')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(dept)}
                          title={t('common.edit', 'Edit')}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeptToDelete(dept);
                            setIsDeleteModalOpen(true);
                          }}
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
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
          <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500">
            <span>
              {t('common.showingPage', 'Page {{page}} of {{total}}', {
                page: pagination.page,
                total: pagination.totalPages,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Department Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => !isSubmittingForm && setIsFormModalOpen(false)}
        title={editingDept ? t('departments.editDepartment', 'Edit Department') : t('departments.createDepartment', 'Create Department')}
      >
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          {formError && <Alert type="error">{formError}</Alert>}

          <Input
            label={t('departments.departmentName', 'Department Name')}
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('departments.namePlaceholder', 'e.g. Technical Support, Billing')}
            required
          />

          <Textarea
            label={t('departments.description', 'Description (Optional)')}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={t('departments.descriptionPlaceholder', 'Describe the scope of this department...')}
            rows={3}
          />

          <Select
            label={t('departments.assignHead', 'Designated Department Head (Optional)')}
            value={formHeadId}
            onChange={(e) => setFormHeadId(e.target.value)}
            options={[
              { value: '', label: t('departments.noHeadAssigned', 'None / Unassigned') },
              ...allAgents.map((ag) => ({
                value: ag.id,
                label: `${ag.name} (${ag.email})`,
              })),
            ]}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsFormModalOpen(false)}
              disabled={isSubmittingForm}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmittingForm}>
              {isSubmittingForm ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Member Management Modal */}
      <Modal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        title={`${selectedDeptForMembers?.name ?? ''} — ${t('departments.membersTitle', 'Department Members')}`}
        size="lg"
      >
        <div className="space-y-5">
          {membersError && <Alert type="error">{membersError}</Alert>}

          {/* Add Agent Form */}
          <form onSubmit={handleAddMember} className="flex items-end gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex-1">
              <Select
                label={t('departments.addAgentToDept', 'Add Active Agent to Department')}
                value={memberToAddId}
                onChange={(e) => setMemberToAddId(e.target.value)}
                options={[
                  { value: '', label: t('departments.selectAgent', 'Select an agent...') },
                  ...availableAgentsForMember.map((ag) => ({
                    value: ag.id,
                    label: `${ag.name} (${ag.email})`,
                  })),
                ]}
              />
            </div>
            <Button type="submit" disabled={!memberToAddId || isAddingMember} className="shrink-0 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" />
              {isAddingMember ? t('common.adding', 'Adding...') : t('common.add', 'Add')}
            </Button>
          </form>

          {/* Members List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('departments.currentMembers', 'Current Members')} ({deptMembers.length})
            </h4>

            {isLoadingMembers ? (
              <div className="py-6 text-center text-slate-400 text-sm">
                <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                {t('common.loading', 'Loading members...')}
              </div>
            ) : deptMembers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                {t('departments.noMembersYet', 'No agents currently assigned to this department.')}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                {deptMembers.map((member) => (
                  <div key={member.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{member.name}</span>
                        {selectedDeptForMembers?.headId === member.id && (
                          <Badge variant="indigo" size="sm">
                            {t('roles.department_head', 'Department Head')}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{member.email}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      title={t('departments.removeMember', 'Remove from department')}
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsMembersModalOpen(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Department Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title={t('departments.deleteConfirmTitle', 'Delete Department')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t(
              'departments.deleteConfirmMessage',
              'Are you sure you want to delete "{{name}}"? Associated agents and tickets will have their department unassigned safely without deleting their records.',
              { name: deptToDelete?.name }
            )}
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteDepartment}
              disabled={isDeleting}
            >
              {isDeleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
