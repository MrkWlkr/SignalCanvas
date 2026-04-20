"use client";

import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <HeroSection />
      <DemoSection />
      <FrameworkSection />
      <CtaSection />
    </>
  );
}

function HeroSection() {
  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gray-950 px-6 py-28 text-center">
      {/* Radial pulse animation */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
        <span className="absolute h-[500px] w-[500px] rounded-full border border-blue-900/40 animate-[ping_3s_ease-out_infinite]" />
        <span className="absolute h-[380px] w-[380px] rounded-full border border-blue-800/30 animate-[ping_3s_ease-out_0.8s_infinite]" />
        <span className="absolute h-[260px] w-[260px] rounded-full border border-blue-700/20 animate-[ping_3s_ease-out_1.6s_infinite]" />
        <span className="absolute h-[140px] w-[140px] rounded-full bg-blue-950/30 blur-2xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight mb-5 leading-tight">
          Signal Canvas
        </h1>

        <p className="text-xl sm:text-2xl text-gray-300 mb-3 font-medium leading-snug">
          Human oversight for agentic AI.
        </p>

        <p className="text-base text-gray-500 mb-6 max-w-xl mx-auto leading-relaxed">
          See what your agents decide. Understand why. Stay in control.
        </p>

        <p className="text-sm text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          As AI agents take on more complex operational decisions, the hardest problem isn&apos;t
          building the agent — it&apos;s maintaining meaningful human oversight without requiring
          domain expertise to interpret what the agent did and why. Signal Canvas is the
          infrastructure layer that makes agentic AI decisions transparent, traceable, and
          governable in high-stakes operational environments.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <button
            onClick={scrollToDemo}
            className="px-7 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/40"
          >
            View live demo →
          </button>
          <a
            href="#framework"
            className="px-7 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
          >
            How it works
          </a>
        </div>

        <p className="text-xs text-gray-600">
          Built with Claude · Next.js · React Flow · Recharts
        </p>
      </div>
    </section>
  );
}

function DemoSection() {
  return (
    <section id="demo" className="bg-gray-950 border-t border-gray-800 py-16">
      {/* Heading stays centered with padding */}
      <div className="px-6 text-center mb-8">
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
          Live demo — Enterprise Compliance Intelligence
        </div>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          The scenario below demonstrates Signal Canvas monitoring a complex multi-system
          compliance workflow in real time. Watch how the agent reasons across immigration,
          tax, payroll, and policy signals simultaneously — and how Signal Canvas makes
          every inference visible and auditable.
        </p>
        <p className="text-xs text-gray-600 mt-3 max-w-xl mx-auto">
          Click any node to see what the agent consulted and concluded. Click a source node to see what was queried and returned.
        </p>
      </div>
      {/* Dashboard spans full viewport width — no max-w cap */}
      <Dashboard />
    </section>
  );
}

function FrameworkSection() {
  return (
    <section id="framework" className="bg-gray-900 border-t border-gray-800 px-6 py-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Agentic AI you can actually oversee.
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Signal Canvas is not the agent. It is the layer that makes any agentic AI system
            trustworthy and deployable in environments where decisions have real consequences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          <FrameworkCard
            step="01"
            title="Observe"
            description="Every signal the agent receives, every tool it calls, every inference it makes — visible in real time, organized by source system, and connected to the decisions they produced. Not log files. Not alert lists. A coherent picture of what the agent knows and how it got there."
          />
          <FrameworkCard
            step="02"
            title="Understand"
            description="Causal chains, not just outcomes. Signal Canvas surfaces why the agent reached its conclusion — which signals converged, which deadlines were missed, which dependencies cascaded. A human can follow the reasoning without understanding the underlying model."
          />
          <FrameworkCard
            step="03"
            title="Control"
            description="Confidence-calibrated autonomy. Signal Canvas shows where the agent is certain enough to act and where it needs human input — making the boundary between AI autonomy and human oversight explicit, visible, and adjustable."
          />
        </div>

        <div className="text-center space-y-3 mb-10">
          <p className="text-sm text-gray-500">
            This demo uses enterprise compliance workflow data as the proof point. The reasoning engine is domain-agnostic — the same framework applies to any operational environment where AI agents are making consequential decisions that humans need to understand, audit, and govern.
          </p>
        </div>

        <div className="text-center">
          <button
            onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try the demo →
          </button>
        </div>
      </div>
    </section>
  );
}

function FrameworkCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 font-mono font-bold">{step}</span>
      </div>
      <div>
        <div className="text-white font-semibold mb-2">{title}</div>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function CtaSection() {
  return (
    <section className="bg-gray-950 border-t border-gray-800 px-6 py-20">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-5">
          Applying this to your domain.
        </h2>
        <p className="text-gray-400 leading-relaxed mb-8">
          Signal Canvas is a working prototype demonstrating a domain-agnostic agentic AI
          observability framework. The compliance scenario is the proof point — the architecture
          is built to transfer to any regulated operational domain where complex multi-system
          workflows are currently managed by human specialists.
        </p>
        <p className="text-gray-400 leading-relaxed mb-8">
          If you are thinking about AI agent governance, operational observability, or decision
          intelligence in your organization, I would like to hear about it.
        </p>
        <a
          href="mailto:wlkr.mrk@gmail.com"
          className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/40"
        >
          Get in touch →
        </a>
        <p className="text-xs text-gray-600 mt-6">
          signalcanvas.ai is an independent research and demonstration project.
        </p>
      </div>
    </section>
  );
}
