import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaCamera,
  FaMapMarkedAlt,
  FaClipboardCheck,
  FaBell,
  FaRoad,
  FaUsers,
} from "react-icons/fa";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

const STEPS = [
  {
    num: "01",
    title: "Spot the Pothole",
    desc: "See a pothole on your commute? Stop safely and note the location — street name, intersection, or landmark.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="18" stroke="#00B4D8" strokeWidth="2" />
        <path
          d="M20 11v9l6 3"
          stroke="#00B4D8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Submit a Report",
    desc: "Fill in the location, describe the damage severity, and attach a photo. Takes under 90 seconds.",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <rect
          x="8"
          y="6"
          width="24"
          height="28"
          rx="3"
          stroke="#00B4D8"
          strokeWidth="2"
        />
        <path
          d="M14 14h12M14 20h8M14 26h6"
          stroke="#00B4D8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Track Progress",
    desc: 'Receive a reference number and email updates as your report moves from "submitted" to "repaired".',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <path
          d="M8 20l8 8 16-16"
          stroke="#00B4D8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "GPS Auto-locate",
    desc: "One tap captures your exact coordinates — no address typing needed.",
  },
  {
    title: "Photo Evidence",
    desc: "Attach up to 4 photos directly from your camera roll or device camera.",
  },
  {
    title: "Severity Rating",
    desc: "Rate damage from minor to critical so crews prioritize the worst first.",
  },
  {
    title: "Live Status",
    desc: "Track your report through four clear stages: Received → Assessed → Scheduled → Repaired.",
  },
  {
    title: "Anonymous Option",
    desc: "Report without creating an account if you prefer privacy.",
  },
  {
    title: "Community Upvoting",
    desc: "Confirm existing reports so authorities know how many residents are affected.",
  },
];

const STATS = [
  { value: "14,200+", label: "Potholes Reported" },
  { value: "9,800+", label: "Repairs Completed" },
  { value: "38 days", label: "Average Repair Time" },
  { value: "92%", label: "Resident Satisfaction" },
];

const FAQS = [
  {
    q: "Who receives my report?",
    a: "Reports are routed directly to your city's Public Works department. We don't hold reports — they're forwarded within minutes.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. Anonymous reports are accepted. Creating an account lets you track status updates and receive repair notifications.",
  },
  {
    q: "What if the pothole is on a highway?",
    a: "Highways fall under state jurisdiction. After submission, we'll detect the road type and route your report to the correct agency.",
  },
  {
    q: "How long does a repair take?",
    a: "The city targets 30 days for standard repairs and 48 hours for critical hazards. Our dashboard shows live repair timelines.",
  },
];

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-primary">
      <main className="pt-16">
        <section className="relative overflow-hidden bg-primary text-white">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge tone="info" className="bg-accent/15 !text-accent">
                Trusted by city departments and residents
              </Badge>
              <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Report potholes fast. Track repairs clearly.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-200">
                RoadGuard connects residents with maintenance crews in minutes.
                Snap a photo, share a location, and follow your report from
                submission to completion.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-primary transition hover:bg-accent-light"
                >
                  Report a pothole
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-accent hover:text-accent"
                >
                  See how it works
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative flex items-center justify-center"
            >
              <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-slate-950 shadow-2xl ring-1 ring-white/10">
                <img
                  src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=840&h=560&fit=crop&auto=format"
                  alt="Road with pothole report"
                  className="h-[360px] w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 rounded-3xl bg-white/95 p-5 shadow-xl backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                        Report #PT-2847
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        Main St &amp; 4th Ave — Critical
                      </p>
                    </div>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                      Repair Scheduled
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {["Received", "Assessed", "Scheduled", "Repaired"].map(
                      (status, index) => (
                        <div key={status} className="space-y-2">
                          <div
                            className={`h-1 rounded-full ${index < 3 ? "bg-accent" : "bg-slate-200"}`}
                          />
                          <p
                            className={`text-[10px] ${index < 3 ? "text-accent font-semibold" : "text-slate-400"}`}
                          >
                            {status}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="border-t border-white/10">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-extrabold text-accent">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                Process
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-primary">
                Three steps from problem to patch
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <div
                  key={step.num}
                  className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-8 shadow-sm transition hover:shadow-card"
                >
                  {index < STEPS.length - 1 && (
                    <div className="pointer-events-none absolute right-0 top-8 hidden h-px w-20 bg-gradient-to-r from-accent/50 to-transparent md:block" />
                  )}
                  <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-3xl bg-accent/10 text-accent">
                      {step.icon}
                    </div>
                    <span className="text-4xl font-extrabold text-slate-300">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="bg-background py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                  Features
                </p>
                <h2 className="mt-4 text-3xl font-extrabold text-primary">
                  Built for residents, designed for results
                </h2>
              </div>
              <p className="max-w-md text-sm text-slate-600">
                Every feature was shaped by feedback from commuters, cyclists,
                and local government teams.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <Card key={feature.title} hover className="p-6">
                  <div className="mb-4 h-1.5 w-12 rounded-full bg-accent" />
                  <h3 className="text-lg font-semibold text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {feature.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="impact" className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="relative">
                <img
                  src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=760&h=520&fit=crop&auto=format"
                  alt="Road repair crew filling a pothole"
                  className="h-[420px] w-full rounded-[1.75rem] object-cover shadow-xl"
                />
                <div className="absolute -bottom-6 -right-6 rounded-[1.5rem] bg-accent p-6 text-white shadow-2xl">
                  <p className="text-3xl font-extrabold">68%</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.3em]">
                    faster resolution vs. phone calls
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                  Impact
                </p>
                <h2 className="mt-4 text-3xl font-extrabold text-primary">
                  Real roads repaired. Real results.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                  Since launching in 2022, RoadGuard has processed over 14,200
                  resident reports and helped authorities repair the worst
                  hazards faster than traditional 311 channels.
                </p>
                <div className="mt-10 space-y-4">
                  {[
                    "Average 38-day turnaround from report to repair",
                    "Used by 24 municipalities in the region",
                    "Integrated with city fleet scheduling systems",
                    "92% of reporters rate the experience as easy",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <div className="mt-1 h-5 w-5 rounded-full bg-accent/10 text-accent grid place-items-center">
                        <FaClipboardCheck className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm text-slate-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-primary py-24 text-white">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,180,216,0.18),_transparent_35%)]" />
            <div className="relative grid gap-12 rounded-[2rem] border border-white/10 bg-primary/95 p-8 shadow-2xl md:grid-cols-2">
              <div className="space-y-6">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                  Report now
                </p>
                <h2 className="text-3xl font-extrabold text-white">
                  Spot a pothole? Tell us right now.
                </h2>
                <p className="max-w-xl text-sm leading-7 text-slate-200">
                  Takes less than two minutes. Your report is forwarded to the
                  right public works office immediately — no sign-up required.
                </p>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-6">
                  <div className="flex items-center gap-3 text-white">
                    <div className="grid h-10 w-10 place-items-center rounded-3xl bg-accent/15 text-accent">
                      <FaCamera className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        Your privacy is protected
                      </p>
                      <p className="text-xs text-slate-200">
                        Submit anonymously or include an email for status
                        updates.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[2rem] bg-white p-8 text-slate-900 shadow-xl">
                <h3 className="text-xl font-bold">Report details</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Use the app to mark the pothole location, add a photo, and
                  choose the severity.
                </p>
                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-primary">
                      Street / Intersection
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      e.g. Main St &amp; 4th Ave
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-primary">
                      Damage Severity
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Minor, moderate, or critical — selected by the reporter.
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-primary">
                      Live tracking
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Receive updates as your report moves through the repair
                      workflow.
                    </p>
                  </div>
                </div>
                <Link
                  to="/register"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-primary transition hover:bg-accent-light"
                >
                  Start a report
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
                FAQ
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-primary">
                Common questions
              </h2>
            </div>
            <div className="mt-12 space-y-4">
              {FAQS.map((faq, index) => (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-3xl border border-slate-200 transition hover:border-accent/30"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-left text-base font-semibold text-primary">
                      {faq.q}
                    </span>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${openFaq === index ? "border-accent bg-accent/10 text-accent" : "border-slate-200 text-slate-500"}`}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className={`h-4 w-4 transition-transform ${openFaq === index ? "rotate-180" : ""}`}
                      >
                        <path
                          d="M5 7.5l5 5 5-5"
                          stroke="#00B4D8"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-5 text-sm leading-7 text-slate-600">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold text-primary">
              Every report makes roads safer.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Join thousands of residents who have already helped improve road
              safety in their community.
            </p>
            <Link
              to="/register"
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-primary transition hover:bg-accent-light"
            >
              Report a pothole now
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
