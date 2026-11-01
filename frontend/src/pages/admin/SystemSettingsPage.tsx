import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

export function SystemSettingsPage() {
  const { t } = useTranslation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const SUPPORTED_CATEGORIES = useMemo(() => [
    {
      key: 'billing',
      name: t('categories.billing'),
      description: t('categories.descriptions.billing'),
      status: t('common.active'),
    },
    {
      key: 'account',
      name: t('categories.account'),
      description: t('categories.descriptions.account'),
      status: t('common.active'),
    },
    {
      key: 'technical',
      name: t('categories.technical'),
      description: t('categories.descriptions.technical'),
      status: t('common.active'),
    },
    {
      key: 'orders',
      name: t('categories.orders'),
      description: t('categories.descriptions.orders'),
      status: t('common.active'),
    },
    {
      key: 'general',
      name: t('categories.general'),
      description: t('categories.descriptions.general'),
      status: t('common.active'),
    },
  ], [t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            {t('settings.title')}
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            {t('settings.subtitle')}
          </p>
        </div>
        <div>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            {t('settings.addCategory')}
          </Button>
        </div>
      </div>

      <Alert type="info" title={t('settings.constraintTitle')}>
        {t('settings.constraintDesc')}
      </Alert>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.categoryKey')}</TableHead>
              <TableHead>{t('settings.displayName')}</TableHead>
              <TableHead>{t('settings.description')}</TableHead>
              <TableHead>{t('settings.status')}</TableHead>
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
        title={t('settings.modalTitle')}
        footer={
          <Button type="button" onClick={() => setIsAddModalOpen(false)}>
            {t('common.close')}
          </Button>
        }
      >
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{t('settings.notSupportedTitle')}</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t('settings.notSupportedDesc1')}
          </p>
          <p className="text-xs text-slate-500">
            {t('settings.notSupportedDesc2')}
          </p>
        </div>
      </Modal>
    </div>
  );
}
