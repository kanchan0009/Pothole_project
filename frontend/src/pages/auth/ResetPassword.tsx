import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';
import { passwordRule } from '../../lib/validators';

const schema = z
  .object({
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await authApi.resetPassword(token, values.password);
      toast.success('Password updated. You can now log in.');
      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Reset failed');
    }
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account.">
      {!token ? (
        <div className="glass-card p-6 text-center">
          <p className="text-sm text-danger">This reset link is invalid or missing.</p>
          <Link to="/forgot-password" className="mt-4 inline-block font-semibold text-accent hover:text-accent-light">
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="password" className="label-field">New password</label>
            <input id="password" type="password" autoComplete="new-password" className="input-field" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label-field">Confirm password</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" className="input-field" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
          </div>

          {serverError && <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{serverError}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
