import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../features/auth/auth-context';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { AuthShell } from './AuthShell';
import { passwordRule } from '../../lib/validators';
import { GoogleLogin } from '@react-oauth/google';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().max(20).optional(),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function Register() {
  const { register: registerUser, googleLogin } = useAuth();
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
      await registerUser({
        name: values.name,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
      toast.success('Account created — welcome!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start reporting road hazards in your community.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="label-field">Full name</label>
          <input id="name" autoComplete="name" className="input-field" placeholder="Jane Citizen" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="email" className="label-field">Email</label>
          <input id="email" type="email" autoComplete="email" className="input-field" placeholder="you@example.com" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="label-field">Phone (optional)</label>
          <input id="phone" autoComplete="tel" className="input-field" placeholder="+1 555 010 0000" {...register('phone')} />
          {errors.phone && <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="label-field">Password</label>
            <input id="password" type="password" autoComplete="new-password" className="input-field" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label-field">Confirm</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" className="input-field" placeholder="••••••••" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword.message}</p>}
          </div>
        </div>

        {serverError && (
          <p className="rounded-lg bg-danger/10 px-4 py-2.5 text-sm text-danger">{serverError}</p>
        )}

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <span className="w-1/5 border-b border-primary/10 lg:w-1/4"></span>
        <span className="text-xs text-center text-primary/40 uppercase tracking-wider font-semibold">Or continue with</span>
        <span className="w-1/5 border-b border-primary/10 lg:w-1/4"></span>
      </div>

      <div className="mt-6 flex justify-center">
        <GoogleLogin
          onSuccess={async (credentialResponse) => {
            if (credentialResponse.credential) {
              setServerError('');
              try {
                await googleLogin(credentialResponse.credential);
                toast.success('Account created — welcome!');
                navigate('/dashboard', { replace: true });
              } catch (err) {
                setServerError(err instanceof Error ? err.message : 'Google Sign-up failed');
              }
            }
          }}
          onError={() => {
            setServerError('Google Sign-up Failed');
          }}
          useOneTap
        />
      </div>

      <p className="mt-6 text-center text-sm text-primary/60">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-accent hover:text-accent-light">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
