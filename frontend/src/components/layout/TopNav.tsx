import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, Search, HelpCircle, User as UserIcon, LogOut, Check } from 'lucide-react';
import { RoleBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import type { UserRole } from '../../types/auth';

interface TopNavProps {
  onToggleSidebar: () => void;
}

export function TopNav({ onToggleSidebar }: TopNavProps) {
  const { user, role, logout, devSwitchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute page title from path
  const getPageTitle = (pathname: string): string => {
    if (pathname.includes('/customer/dashboard') || pathname === '/customer-dashboard') return 'Customer Dashboard';
    if (pathname.includes('/customer/create-ticket') || pathname === '/create-ticket') return 'Create Ticket';
    if (pathname.includes('/customer/tickets') || pathname === '/my-tickets') return 'My Tickets';
    if (pathname.includes('/customer/profile') || pathname === '/customer-profile-&-settings') return 'Customer Profile & Settings';
    if (pathname.includes('/agent/dashboard') || pathname === '/support-dashboard') return 'Support Dashboard';
    if (pathname.includes('/agent/queue') || pathname === '/support-queue') return 'Support Queue';
    if (pathname.includes('/agent/assigned') || pathname === '/assigned-tickets') return 'Assigned Tickets';
    if (pathname.includes('/agent/tickets') || pathname === '/ticket-management-workspace') return 'Ticket Management Workspace';
    if (pathname.includes('/agent/profile') || pathname === '/agent-profile-&-settings') return 'Agent Profile & Settings';
    if (pathname.includes('/admin/dashboard') || pathname === '/admin-dashboard') return 'Admin Dashboard';
    if (pathname.includes('/admin/tickets') || pathname === '/all-tickets') return 'All Tickets';
    if (pathname.includes('/admin/users') || pathname === '/user-&-agent-management') return 'User & Agent Management';
    if (pathname.includes('/admin/reports') || pathname === '/reports-&-analytics') return 'Reports & Analytics';
    if (pathname.includes('/admin/settings') || pathname === '/system-settings-&-categories') return 'System Settings & Categories';
    if (pathname.includes('/tickets/')) return 'Ticket Details & Conversation';
    return 'MelaDesk';

  };

  const handleRoleChange = (newRole: UserRole) => {
    devSwitchRole(newRole);
    setIsUserMenuOpen(false);
    // Navigate to respective dashboard
    if (newRole === 'customer') navigate('/customer/dashboard');
    else if (newRole === 'agent') navigate('/agent/dashboard');
    else if (newRole === 'admin') navigate('/admin/dashboard');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
          {getPageTitle(location.pathname)}
        </h2>
      </div>

      {/* Right: "Search · Help · User" Concept Matching */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Search */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          title="Search tickets or resources"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Search</span>
        </button>

        <span className="text-slate-300 hidden sm:inline">·</span>

        {/* Help */}
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          title="Help & documentation"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Help</span>
        </button>

        <span className="text-slate-300 hidden sm:inline">·</span>

        {/* User Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left cursor-pointer"
            aria-expanded={isUserMenuOpen}
          >
            <div className="w-7 h-7 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-xs font-semibold text-[#0F172A] truncate max-w-[120px]">
                {user?.name || 'User'}
              </span>
              <span className="text-[10px] text-slate-500 capitalize">
                {role || 'Customer'}
              </span>
            </div>
          </button>

          {/* User Menu Modal / Dropdown */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#E2E8F0] py-2 z-50 text-left">
              <div className="px-4 py-2 border-b border-[#E2E8F0]">
                <p className="text-xs font-semibold text-[#0F172A] truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-500 truncate mb-1.5">{user?.email}</p>
                {role && <RoleBadge role={role} />}
              </div>

              {/* Dev Persona Switcher */}
              <div className="px-3 py-2 border-b border-[#E2E8F0] bg-slate-50/60">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Local Dev Persona Preview
                </p>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('customer')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                      role === 'customer' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span>Customer (Amina)</span>
                    {role === 'customer' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('agent')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                      role === 'agent' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span>Support Agent (Abdi)</span>
                    {role === 'agent' && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('admin')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                      role === 'admin' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-white'
                    }`}
                  >
                    <span>Administrator (Omar)</span>
                    {role === 'admin' && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    if (role === 'agent') navigate('/agent/profile');
                    else navigate('/customer/profile');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Profile & Settings</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Search Modal */}
      <Modal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Search MelaDesk"
      >
        <div className="space-y-4">
          <Input
            placeholder="Type ticket number or keywords (e.g. #MD-1048, password, billing)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            autoFocus
          />
          <div className="text-xs text-slate-500">
            Quick jump:
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  navigate('/tickets/MD-1048');
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs font-mono cursor-pointer"
              >
                #MD-1048
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen(false);
                  navigate('/customer/tickets');
                }}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs cursor-pointer"
              >
                My Tickets
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        title="MelaDesk Help & Documentation"
      >
        <div className="space-y-3 text-xs sm:text-sm text-slate-600">
          <p>
            Welcome to <strong>MelaDesk</strong> — Customer Support Ticketing System for university projects.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Customers:</strong> Submit new tickets, track resolution status, and reply to agent updates.</li>
            <li><strong>Agents:</strong> Triage unassigned queue tickets, claim work, reply to customers, and add private internal notes.</li>
            <li><strong>Administrators:</strong> Monitor team metrics, oversee tickets, manage user and agent accounts, and configure ticket categories.</li>
          </ul>
        </div>
      </Modal>
    </header>
  );
}
