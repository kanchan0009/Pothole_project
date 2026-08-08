import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../features/auth/auth-context';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  const from = (location.state as { from?: string } | null)?.from || '/dashboard';

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await login(values);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to track your reports and stay informed.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email" className="label-field">Email</label>
          <input id="email" type="email" autoComplete="email" className="input-field" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="label-field">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input-field" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-primary/70">
            <input type="checkbox" className="h-4 w-4 accent-accent" {...register('rememberMe')} />
            Remember me
          </label>
          <Link to="/forgot-password" className="font-semibold text-accent hover:text-accent-light">
            Forgot password?
          </Link>
        </div>

        {serverError && (
          <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{serverError}</p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-primary/60">
        New to RoadGuard?{' '}
        <Link to="/register" className="font-semibold text-accent hover:text-accent-light">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
