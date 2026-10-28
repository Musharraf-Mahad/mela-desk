import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const loggedInUser = await login({ email, password });
      if (loggedInUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (loggedInUser.role === 'agent') {
        navigate('/agent/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Invalid email or password. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
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
    </div>
  );
}
