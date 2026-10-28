import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('amina@example.com');
  const [password, setPassword] = useState('••••••••');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      if (email.toLowerCase().includes('admin')) {
        navigate('/admin/dashboard');
      } else if (email.toLowerCase().includes('agent') || email.toLowerCase().includes('abdi')) {
        navigate('/agent/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          Continue to your support workspace.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          className="w-full justify-center py-2.5 mt-2"
          isLoading={isLoading}
        >
          Sign In
        </Button>
      </form>

      <div className="pt-2 text-center text-sm text-[#64748B]">
        Don't have an account?{' '}
        <Link
          to="/customer-registration"
          className="font-medium text-[#2563EB] hover:text-[#1D4ED8]"
        >
          Create Account
        </Link>
      </div>

      {/* Quick Demo Logins for Student Team Testing */}
      <div className="mt-8 pt-4 border-t border-[#E2E8F0]">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Demo Accounts for Preview
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setDemoAccount('amina@example.com')}
            className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setDemoAccount('abdi@example.com')}
            className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            Agent
          </button>
          <button
            type="button"
            onClick={() => setDemoAccount('omar@example.com')}
            className="px-2 py-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-[#E2E8F0] transition-colors cursor-pointer"
          >
            Admin
          </button>
        </div>
      </div>
    </div>
  );
}
