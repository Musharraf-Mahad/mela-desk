import React, { useState } from 'react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
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
import { MOCK_CATEGORIES } from '../../mocks/mockData';
import { Plus } from 'lucide-react';

export function SystemSettingsPage() {
  const [categories, setCategories] = useState(MOCK_CATEGORIES);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setCategories((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        name: newCatName.trim(),
        description: newCatDesc.trim() || 'Custom department tickets',
        status: 'Enabled',
      },
    ]);

    setNewCatName('');
    setNewCatDesc('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#0F172A]">Ticket categories</h3>
        <Button
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Category
        </Button>
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-semibold text-[#0F172A]">
                  {cat.name}
                </TableCell>
                <TableCell className="text-slate-600">
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

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Ticket Category"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" form="add-category-form">
              Save Category
            </Button>
          </>
        }
      >
        <form
          id="add-category-form"
          onSubmit={handleAddCategory}
          className="space-y-4"
        >
          <Input
            label="Category Name"
            placeholder="e.g. Hardware Support"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Description"
            placeholder="Brief explanation of when to select this category"
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
