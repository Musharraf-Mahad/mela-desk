import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

export function AccessDeniedPage() {
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleReturn = () => {
    if (role === 'admin') navigate('/admin/dashboard');
    else if (role === 'agent') navigate('/agent/dashboard');
    else navigate('/customer/dashboard');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-5xl font-extrabold text-[#0F172A] tracking-tight">403</h1>
      <p className="text-sm text-[#64748B]">You don't have access.</p>
      <div className="pt-2">
        <Button onClick={handleReturn} className="px-6">
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}
