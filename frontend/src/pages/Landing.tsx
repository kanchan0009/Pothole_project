import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FaCamera,
  FaClipboardCheck,
} from "react-icons/fa";
import { Card } from "../components/ui/Card";
import { useAuth } from "../features/auth/auth-context";

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
    q: "Do I need an account to report a pothole?",
    a: "Yes. Create a free citizen account to submit reports, track status, receive notifications, and download PDF receipts. You can browse the public pothole map without signing in.",
  },
  {
    q: "How does RoadGuard check my photo?",
    a: "When you upload or capture a photo, our AI scans the image for road damage, estimates severity, and highlights the detected area. Submissions without a clear pothole are flagged so crews only receive valid reports.",
  },
  {
    q: "What if the same pothole was already reported?",
    a: "RoadGuard checks for open reports within 20 metres of your pin. If one exists, you'll see a duplicate warning and can continue or cancel — reducing repeat tickets for the same hazard.",
  },
  {
    q: "How do I track my report after submitting?",
    a: "Your dashboard lists every report with status updates: Pending → Verified → Assigned → In Progress → Completed. Open any report for a full timeline, AI confidence score, and a downloadable PDF receipt.",
  },
  {
    q: "How does the municipality prioritize repairs?",
    a: "Admins use a priority queue ranked by severity, duplicate confirmations, and report age. Reports can be verified, assigned to the nearest field worker, and routed on the admin map using shortest-path planning.",
  },
  {
    q: "Can I delete a report I submitted by mistake?",
    a: "Yes. From your dashboard or report detail, you can permanently delete reports that are not yet assigned or in progress. Once a crew is working on it, the report stays on record until the repair is complete.",
  },
];

export function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-primary">
      <main>
        <section className="relative flex h-[calc(100vh-64px)] min-h-[600px] flex-col overflow-hidden bg-slate-900 text-white">
          {/* Background Image with Duotone Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="/hero-bg.png"
              alt="Background"
              className="h-full w-full object-cover grayscale opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a25b0] via-[#2138c2] to-[#e60073] mix-blend-multiply opacity-90" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-transparent mix-blend-overlay" />
          </div>

          {/* Abstract Vector Lines (SVG) */}
          <div className="absolute right-0 bottom-0 z-0 opacity-[0.25] pointer-events-none">
            <svg width="800" height="600" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M200 600 V400 Q200 300 300 300 H450 Q550 300 550 200 V0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M400 600 V400 Q400 300 500 300 H650 Q750 300 750 200 V0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M600 600 V400 Q600 300 700 300 H850 Q950 300 950 200 V0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-1 flex-col justify-center w-full">
            <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-16">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-3xl"
              >
                <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">
                  Trusted by city departments and residents
                </p>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
                  Report potholes fast.<br />
                  <span className="opacity-90 text-white">Track repairs clearly.</span>
                </h1>
                <p className="mt-6 sm:mt-8 max-w-xl text-base sm:text-lg leading-relaxed text-white/70">
                  RoadGuard connects residents with maintenance crews in minutes.
                  Snap a photo, share a location, and follow your report from
                  submission to completion.
                </p>

                <div className="mt-8 sm:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  {user ? (
                    <Link
                      to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                      className="inline-flex justify-center items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-accent/80 hover:-translate-y-0.5"
                    >
                      Go to Dashboard
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      to="/register"
                      className="inline-flex justify-center items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-accent/80 hover:-translate-y-0.5"
                    >
                      Report a pothole
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  )}
                  <a
                    href="#how-it-works"
                    className="inline-flex justify-center items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3.5 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 hover:-translate-y-0.5"
                  >
                    See how it works
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 ml-1">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>


              </motion.div>
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 md:grid-cols-4">
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
                  RoadGuard has processed over 14,200
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
            {user ? (
              <Link
                to={user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard'}
                className="mt-10 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-primary transition hover:bg-accent-light"
              >
                Go to Dashboard
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path
                    fillRule="evenodd"
                    d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </Link>
            ) : (
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
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
