import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function About() {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }} 
      className="min-h-screen bg-[#071428] text-slate-100 selection:bg-accent/30 selection:text-white"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-32">
        {}
        <div className="mb-12 text-xs font-bold tracking-widest text-[#00B4D8] uppercase">
          About
        </div>

        {}
        <section className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-20">
          {}
          <div className="lg:col-span-7 flex flex-col justify-between items-start">
            <h1 className="text-4xl md:text-5xl font-normal tracking-tight text-slate-400 leading-[1.2] mb-10">
              RoadGuard helps <span className="text-white font-medium">communities report</span> and <span className="text-white font-medium">municipalities resolve</span> road hazards in a world where <span className="text-white font-medium">everyone deserves safe streets</span>.
            </h1>
            
            <Link 
              to="/map" 
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-[#0B1F3A] hover:bg-slate-100 transition-colors shadow-sm mt-auto"
            >
              Explore the live map <span className="text-[10px] font-bold">→</span>
            </Link>
          </div>

          {}
          <div className="lg:col-span-5 flex flex-col space-y-8 text-[15px] leading-relaxed text-slate-400 font-light">
            <p>
              We started building RoadGuard to bridge the gap between community needs and local government action. While mobile technology has evolved to put a camera and GPS in every pocket, civic maintenance reporting remained stuck in legacy phone lines, physical forms, and fragmented emails. We realized that reporting should be as simple as taking a photo, and tracking resolution should be completely transparent.
            </p>
            <p>
              At RoadGuard, we believe that safer infrastructure is a collaborative effort. By empowering citizens with AI-assisted detection and providing public works departments with a structured, data-rich dashboard, we transform scattered complaints into prioritized work orders. Our focus is on response time, accuracy, and building lasting trust between communities and local authorities.
            </p>
          </div>
        </section>

        {}
        <div className="my-24 border-t border-slate-800" />

        {}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-4">
            <h2 className="text-2xl font-light text-white tracking-tight">
              AI-Powered Verification
            </h2>
          </div>
          <div className="lg:col-span-8 text-[15px] leading-relaxed text-slate-400 font-light max-w-xl">
            RoadGuard combines the power of citizen reporting with artificial intelligence. Every submitted report runs through our custom Convolutional Neural Network (CNN) to verify and classify potholes, helping cities prioritize repairs based on severity and reduce false alarms.
          </div>
        </section>

        {}
        <div className="my-20 border-t border-slate-800" />

        {}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-20">
          <div className="lg:col-span-4">
            <h2 className="text-2xl font-light text-white tracking-tight">
              Designed for modern municipalities.
            </h2>
          </div>
          <div className="lg:col-span-8 text-[15px] leading-relaxed text-slate-400 font-light max-w-xl">
            RoadGuard is built to scale from small towns to large municipal regions. By replacing legacy report systems with real-time analytics, automated routing, and transparent status updates, we help public works departments work smarter, faster, and more efficiently.
          </div>
        </section>
      </div>
    </motion.div>
  );
}

