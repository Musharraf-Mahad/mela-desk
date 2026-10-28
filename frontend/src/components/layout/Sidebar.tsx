import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { X } from 'lucide-react';
import type { UserRole } from '../../types/auth';


interface NavItem {
  label: string;
  path: string;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { role } = useAuth();

  const getNavItems = (currentRole: UserRole | null): NavItem[] => {
    switch (currentRole) {
      case 'agent':
        return [
          { label: 'Support Dashboard', path: '/agent/dashboard' },
          { label: 'Support Queue', path: '/agent/queue' },
          { label: 'Assigned Tickets', path: '/agent/assigned' },
          { label: 'Profile & Settings', path: '/agent/profile' },
        ];
      case 'admin':
        return [
          { label: 'Admin Dashboard', path: '/admin/dashboard' },
          { label: 'All Tickets', path: '/admin/tickets' },
          { label: 'Users & Agents', path: '/admin/users' },
          { label: 'Reports', path: '/admin/reports' },
          { label: 'System Settings', path: '/admin/settings' },
        ];
      case 'customer':
      default:
        return [
          { label: 'Dashboard', path: '/customer/dashboard' },
          { label: 'My Tickets', path: '/customer/tickets' },
          { label: 'Create Ticket', path: '/customer/create-ticket' },
          { label: 'Profile & Settings', path: '/customer/profile' },
        ];
    }
  };

  const navItems = getNavItems(role);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2E8F0]">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="w-3.5 h-3.5 bg-[#2563EB] rounded-xs inline-block" />
          <span className="text-lg font-bold text-[#0F172A] tracking-tight">MelaDesk</span>
        </NavLink>
        <button
          type="button"
          onClick={onClose}
          className="md:hidden text-slate-400 hover:text-slate-600 p-1"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50/70 text-[#2563EB] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                    isActive ? 'bg-[#2563EB] scale-110' : 'bg-slate-300'
                  }`}
                />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>


      {/* Role Footer Info */}
      <div className="p-4 border-t border-[#E2E8F0] bg-slate-50/50">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-0.5">
          Workspace View
        </p>
        <p className="text-xs font-medium text-slate-700 capitalize">
          {role === 'admin' ? 'Administrator' : role === 'agent' ? 'Support Agent' : 'Customer'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-60 shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
