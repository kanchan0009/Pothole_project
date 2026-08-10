
import { motion } from 'framer-motion';
import { FaCheck, FaHandHoldingHeart } from 'react-icons/fa';

export function About() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-white">
      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6">
        <div className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
          About Us
        </div>
        <h1 className="mb-12 max-w-4xl text-5xl font-medium tracking-tight text-gray-900 md:text-6xl">
          Safer roads, driven by citizens and verified by the municipality
        </h1>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="h-[500px] md:col-span-2">
            <img 
              src="https://images.unsplash.com/photo-1541888086425-d81bb19240f5?w=1200&q=80" 
              alt="Community repair" 
              className="h-full w-full object-cover" 
            />
          </div>
          <div className="flex h-[500px] items-center justify-center bg-[#fdf9ea]">
            <FaHandHoldingHeart className="text-8xl text-gray-900" />
          </div>
        </div>
      </section>

      {/* Our Story / Mission */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="mb-4 text-xs font-bold tracking-widest text-gray-500 uppercase">
              Our Mission
            </div>
            <h2 className="text-3xl font-medium tracking-tight text-gray-900 md:text-4xl leading-tight">
              RoadGuard connects the people who see the potholes with the teams who fix them
            </h2>
          </div>
          <div className="flex flex-col justify-center space-y-6 text-[17px] leading-relaxed text-gray-700 md:col-span-7">
            <p>
              For decades, reporting road issues has been built around paperwork, not people. Processes that only make sense after something goes wrong. We started with a simple question: what if civic maintenance felt as straightforward as any other modern service?
            </p>
            <p>
              We believe civic participation should be clear enough to explain in one conversation and flexible enough to change when life does. A photo, a GPS pin, and a smart workflow turn scattered complaints into prioritized, tracked work orders. Our mission is to rebuild trust by making road repairs transparent, human, and genuinely useful.
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4 border-t border-gray-100 pt-16">
          <div>
            <div className="mb-2 text-5xl font-medium text-gray-900">
              1,240 <span className="text-3xl font-normal">+</span>
            </div>
            <div className="text-sm text-gray-500">reports filed</div>
          </div>
          <div>
            <div className="mb-2 text-5xl font-medium text-gray-900">
              92 <span className="text-3xl font-normal">%</span>
            </div>
            <div className="text-sm text-gray-500">resolution rate</div>
          </div>
          <div>
            <div className="mb-2 text-5xl font-medium text-gray-900">
              4.2
            </div>
            <div className="text-sm text-gray-500">avg. days to fix</div>
          </div>
          <div>
            <div className="mb-2 text-5xl font-medium text-gray-900">
              38
            </div>
            <div className="text-sm text-gray-500">municipalities</div>
          </div>
        </div>
      </section>

      {/* Pillars / Bottom Section */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid items-center gap-16 md:grid-cols-2 border-t border-gray-100 pt-24">
          <div className="h-[500px]">
            <img 
              src="https://images.unsplash.com/photo-1517606555307-e43594b79b29?w=1000&q=80" 
              alt="People near road" 
              className="h-full w-full object-cover" 
            />
          </div>
          <div>
            <h2 className="mb-6 text-3xl font-medium tracking-tight text-gray-900 md:text-4xl">
              A platform designed around cities
            </h2>
            <p className="mb-8 text-lg text-gray-600">
              We make sure every step feels simple and transparent. From filing a report to verifying a repair, our process is built to save time and avoid confusion.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start">
                <FaCheck className="mr-4 mt-1 flex-shrink-0 text-gray-900" />
                <p className="text-[15px] text-gray-600">
                  <span className="font-medium text-gray-900">For citizens:</span> A one-minute way to report road hazards with photo and GPS.
                </p>
              </div>
              <div className="flex items-start">
                <FaCheck className="mr-4 mt-1 flex-shrink-0 text-gray-900" />
                <p className="text-[15px] text-gray-600">
                  <span className="font-medium text-gray-900">For municipalities:</span> A live picture of road conditions with severity scoring.
                </p>
              </div>
              <div className="flex items-start">
                <FaCheck className="mr-4 mt-1 flex-shrink-0 text-gray-900" />
                <p className="text-[15px] text-gray-600">
                  <span className="font-medium text-gray-900">For crews:</span> Clear work orders and photo proof of every completed repair.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
