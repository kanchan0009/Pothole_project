import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCamera, FaCity, FaHardHat } from 'react-icons/fa';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

const stats = [
  { value: '1,240', label: 'Reports filed' },
  { value: '92%', label: 'Resolution rate' },
  { value: '4.2', label: 'Avg. days to fix' },
  { value: '38', label: 'Municipalities' },
];

const pillars = [
  {
    icon: <FaCamera className="text-2xl text-accent" />,
    title: 'For citizens',
    text: 'A one-minute way to report road hazards with photo and GPS, then follow the repair from start to finish.',
  },
  {
    icon: <FaCity className="text-2xl text-accent" />,
    title: 'For municipalities',
    text: 'A live picture of road conditions, with duplicate detection and severity scoring so budgets go where they matter.',
  },
  {
    icon: <FaHardHat className="text-2xl text-accent" />,
    title: 'For crews',
    text: 'Clear work orders, automatic nearest-crew assignment, and photo proof of every completed repair.',
  },
];

export function About() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6">
          <Badge tone="info" className="bg-accent/15 !text-accent">
            Our mission
          </Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
            Safer roads, driven by citizens and verified by the municipality.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/70">
            RoadGuard connects the people who see the potholes with the teams who fix them. A photo, a GPS pin,
            and a smart workflow turn scattered complaints into prioritized, tracked work orders — with
            before-and-after proof for every repair.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              to="/map"
              className="rounded-lg bg-accent px-7 py-3.5 text-base font-bold text-primary shadow-card transition hover:bg-accent-light"
            >
              View the live map
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-white/25 px-7 py-3.5 text-base font-semibold text-white transition hover:border-accent hover:text-accent"
            >
              Start reporting
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="p-6 text-center">
              <div className="text-3xl font-extrabold text-accent">{s.value}</div>
              <div className="mt-1 text-sm text-primary/60">{s.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {pillars.map((p) => (
            <Card key={p.title} hover className="p-6">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10">{p.icon}</span>
              <h3 className="mt-4 text-lg font-bold text-primary">{p.title}</h3>
              <p className="mt-2 text-sm text-primary/60">{p.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
