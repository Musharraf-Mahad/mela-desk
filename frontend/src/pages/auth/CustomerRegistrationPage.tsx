import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';

export function CustomerRegistrationPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await register({ name, email, password });
      navigate('/customer/dashboard');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('auth.registrationFailed', 'Registration failed. Please try again.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">
          {t('auth.createYourAccount', 'Create your account')}
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          {t('auth.continueToWorkspace', 'Continue to your support workspace.')}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('auth.fullName', 'Full name')}
          type="text"
          placeholder={t('auth.fullNamePlaceholder', 'Your name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label={t('auth.emailAddress', 'Email address')}
          type="email"
          placeholder={t('auth.emailPlaceholder', 'you@example.com')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label={t('auth.password', 'Password')}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('auth.passwordLengthPlaceholder', 'At least 12 characters')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText={t('auth.passwordLengthHelper', 'Must be between 12 and 128 characters.')}
          required
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
              aria-label={
                showPassword
                  ? t('common.hidePassword', 'Hide password')
                  : t('common.showPassword', 'Show password')
              }
              title={
                showPassword
                  ? t('common.hidePassword', 'Hide password')
                  : t('common.showPassword', 'Show password')
              }
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
        />

        <Button
          type="submit"
          className="w-full justify-center py-2.5 mt-2"
          isLoading={isLoading}
        >
          {t('auth.createAccount', 'Create Account')}
        </Button>
      </form>

      <div className="pt-2 text-center text-sm text-[#64748B]">
        {t('auth.alreadyHaveAccount', 'Already have an account?')}{' '}
        <Link
          to="/login"
          className="font-medium text-[#2563EB] hover:text-[#1D4ED8]"
        >
          {t('auth.signIn', 'Sign In')}
        </Link>
      </div>
    </div>
  );
}
