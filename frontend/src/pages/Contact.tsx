import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FaClock, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import { contactApi } from '../api/contact';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TextArea, TextInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.string().trim().email('Enter a valid email'),
  subject: z.string().trim().min(3, 'Add a short subject').max(120),
  message: z.string().trim().min(10, 'Please write a few more words').max(2000),
});

type FormValues = z.infer<typeof schema>;

const channels = [
  { icon: <FaEnvelope />, label: 'Email', value: 'support@roadguard.gov.np' },
  { icon: <FaPhoneAlt />, label: 'Phone', value: '+977 1 400 1234' },
  { icon: <FaMapMarkerAlt />, label: 'Office', value: 'Municipal Hall, Kathmandu 44600' },
  { icon: <FaClock />, label: 'Hours', value: 'Sun–Fri, 9:00–17:00' },
];

export function Contact() {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await contactApi.submitMessage(values);
      toast.success('Message sent — our team will respond within 2 business days.');
      reset();
    } catch {
      toast.error('Could not send your message. Please try again.');
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-primary">Contact us</h1>
        <p className="mt-1 text-sm text-primary/60">
          Questions about a report, the platform, or municipal data — we're here to help.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Channels */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-primary">Reach us</h2>
          <p className="mt-1 text-sm text-primary/60">Prefer direct contact? Any of these works.</p>
          <div className="mt-5 space-y-5">
            {channels.map((c) => (
              <div key={c.label} className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                  {c.icon}
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-primary/40">{c.label}</p>
                  <p className="text-sm font-semibold text-primary">{c.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Form */}
        <Card className="p-6 lg:col-span-3">
          <h2 className="text-lg font-bold text-primary">Send us a message</h2>
          <p className="mt-1 text-sm text-primary/60">We typically reply within two business days.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="c-name" className="label-field">Name</label>
                <TextInput id="c-name" autoComplete="name" placeholder="Jane Citizen" {...register('name')} />
                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="c-email" className="label-field">Email</label>
                <TextInput id="c-email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="c-subject" className="label-field">Subject</label>
              <TextInput id="c-subject" placeholder="Pothole on Ashok Road" {...register('subject')} />
              {errors.subject && <p className="mt-1 text-xs text-danger">{errors.subject.message}</p>}
            </div>
            <div>
              <label htmlFor="c-message" className="label-field">Message</label>
              <TextArea id="c-message" rows={5} placeholder="Tell us what's happening…" {...register('message')} />
              {errors.message && <p className="mt-1 text-xs text-danger">{errors.message.message}</p>}
            </div>
            <Button type="submit" loading={isSubmitting}>
              Send message
            </Button>
          </form>
        </Card>
      </div>
    </motion.div>
  );
}
