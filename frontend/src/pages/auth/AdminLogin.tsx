import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../features/auth/auth-context';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { FaShieldAlt } from 'react-icons/fa';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;


export function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from || '/admin/dashboard';

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      const user = await adminLogin(values);
      toast.success(`Welcome, ${user.name}`);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-primary p-6">
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="glass-card relative border-primary/20 !bg-primary-light p-8 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/20 text-accent">
              <FaShieldAlt className="text-xl" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Admin Portal</h1>
              <p className="text-xs text-white/50">Restricted access · Authorized personnel only</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-white/70">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-white/15 bg-primary px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="admin@roadguard.gov"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-white/70">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/15 bg-primary px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            {serverError && (
              <p className="rounded-lg bg-danger/15 px-4 py-2.5 text-sm text-red-300">{serverError}</p>
            )}

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full !bg-accent !text-primary hover:!bg-accent-light">
              Sign in to admin
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
