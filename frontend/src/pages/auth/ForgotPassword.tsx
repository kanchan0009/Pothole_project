import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/auth';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError('');
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new password.">
      {sent ? (
        <div className="glass-card p-6 text-center">
          <p className="text-lg font-bold text-primary">Check your inbox</p>
          <p className="mt-2 text-sm text-primary/60">
            If an account exists for that email, a reset link is on its way. (In development the link is
            printed to the server console.)
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-accent hover:text-accent-light">
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="label-field">Email</label>
            <input id="email" type="email" autoComplete="email" className="input-field" placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
          </div>

          {serverError && <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{serverError}</p>}

          <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-semibold text-accent hover:text-accent-light">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
