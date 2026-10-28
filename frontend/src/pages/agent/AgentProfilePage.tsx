import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { authApi } from '../../api/auth.api';

export function AgentProfilePage() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [prevUserName, setPrevUserName] = useState(user?.name);
  if (user?.name !== prevUserName) {
    setPrevUserName(user?.name);
    setName(user?.name || '');
  }

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSavingProfile(true);

    try {
      const { user: updatedUser } = await authApi.updateProfile({ name: name.trim() });
      updateUser(updatedUser);
      setSuccessMessage('Agent profile details saved.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsChangingPassword(true);

    try {
      const msg = await authApi.changePassword({ currentPassword, newPassword });
      setSuccessMessage(msg || 'Password changed successfully. Please log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to change password. Make sure the current password is correct.';
      setErrorMessage(msg);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && <Alert type="success">{successMessage}</Alert>}
      {errorMessage && <Alert type="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Profile Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Email address"
                value={user?.email || ''}
                disabled
                helperText="Email address cannot be changed directly."
              />

              <Input
                label="Role"
                value="Support Agent"
                disabled
                helperText="Role permissions are assigned by administrator."
              />

              <div className="pt-2">
                <Button type="submit" isLoading={isSavingProfile} disabled={isSavingProfile}>
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <Input
                label="Current password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />

              <Input
                label="New password"
                type="password"
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Must be between 12 and 128 characters."
                required
              />

              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                isLoading={isChangingPassword}
                disabled={isChangingPassword}
              >
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
