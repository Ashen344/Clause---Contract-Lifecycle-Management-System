import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Shield,
  Sparkles,
  Workflow,
  CalendarDays,
  AlertTriangle,
  Users,
  Upload,
  ChevronRight,
  Star,
  Zap,
  Lock,
  BarChart3,
  Clock3,
  SearchCheck,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, inView } = useInView(0.3);

  useEffect(() => {
    if (!inView) return;

    let start = 0;
    const duration = 1400;
    const step = 16;
    const inc = to / (duration / step);

    const timer = setInterval(() => {
      start += inc;
      if (start >= to) {
        setVal(to);
        clearInterval(timer);
      } else {
        setVal(Math.floor(start));
      }
    }, step);

    return () => clearInterval(timer);
  }, [inView, to]);

  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/clause-logo.jpeg" alt="Clause" className="h-9 w-9 rounded-xl object-contain" />
          <div>
            <p className="text-[17px] font-bold tracking-tight text-slate-900">
              Clause
            </p>
            <p className="text-[11px] text-slate-500">Contract Workspace</p>
          </div>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {[
            ["Features", "#features"],
            ["How it works", "#how-it-works"],
            ["Benefits", "#benefits"],
            ["Start", "#start"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/sign-in"
            className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
          >
            Sign In
          </Link>

          <Link to="/sign-up">
            <Button className="rounded-full bg-[#07153A] px-5 hover:bg-indigo-600">
              Get Started
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function MockDashboardCard() {
  const items = [
    {
      title: "Vendor Agreement",
      status: "Active",
      risk: "Low",
      tagClass: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Strategic Partnership",
      status: "Review",
      risk: "Medium",
      tagClass: "bg-amber-50 text-amber-700",
    },
    {
      title: "SaaS Licensing",
      status: "Approval",
      risk: "High",
      tagClass: "bg-rose-50 text-rose-600",
    },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-2xl shadow-indigo-200/40">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
        </div>

        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-400 shadow-sm">
          Dashboard
        </div>

        <div className="h-2 w-10 rounded-full bg-slate-200" />
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Total Contracts",
              value: "128",
              icon: FileText,
              bg: "bg-violet-50",
              text: "text-violet-600",
            },
            {
              label: "Pending Approvals",
              value: "14",
              icon: Clock3,
              bg: "bg-amber-50",
              text: "text-amber-600",
            },
            {
              label: "High Risk",
              value: "6",
              icon: AlertTriangle,
              bg: "bg-rose-50",
              text: "text-rose-600",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {card.label}
                  </span>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${card.text}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">
                  {card.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              Live Contracts
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{item.status}</p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${item.tagClass}`}
                >
                  {item.risk}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#F8FAFC] pt-32 pb-20 lg:pt-36">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-violet-200/40 blur-[90px]" />
        <div className="absolute top-[28%] -left-20 h-[320px] w-[320px] rounded-full bg-indigo-200/40 blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 h-[240px] w-[240px] rounded-full bg-cyan-100/40 blur-[70px]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
        <div className="space-y-8">

          <div className="space-y-4">
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 lg:text-6xl xl:text-7xl">
              One Workspace For
              <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                All Contracts
              </span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-slate-500">
              Draft, Analyze, Compare, and Track Contracts in one
              platform built for all teams.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link to="/sign-up">
              <Button className="rounded-full bg-[#07153A] px-7 py-6 text-[15px] hover:bg-indigo-600">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <Link to="/sign-in">
              <Button
                variant="outline"
                className="rounded-full border-slate-300 px-7 py-6 text-[15px]"
              >
                Sign In
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {["A", "S", "T", "S", "M"].map((char, i) => (
                <div
                  key={char}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white ${
                    [
                      "bg-indigo-500",
                      "bg-violet-500",
                      "bg-cyan-500",
                      "bg-rose-500",
                      "bg-amber-500",
                    ][i]
                  }`}
                >
                  {char}
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-sm text-slate-500">
                Trusted by Small to Medium Scale IT Businesses
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -top-4 right-6 z-10 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg">
            <p className="text-sm font-medium text-slate-700">
              AI Risk Analysis Ready
            </p>
          </div>

          <div className="absolute -bottom-5 -left-5 z-10 w-56 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                <Bot className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <p className="text-xs font-semibold text-slate-700">
                AI Contract Score
              </p>
            </div>
            <p className="text-3xl font-bold text-slate-900">87</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Low risk · Ready for review
            </p>
          </div>

          <MockDashboardCard />
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  const { ref, inView } = useInView();

  const stats = [
    { value: 12000, suffix: "+", label: "Contracts Processed" },
    { value: 96, suffix: "%", label: "Process Visibility" },
    { value: 3, suffix: "x", label: "Faster Review Cycles" },
    { value: 500, suffix: "+", label: "Teams Supported" },
  ];

  return (
    <section ref={ref} className="border-y border-slate-200/70 bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {stats.map((item, i) => (
            <div
              key={item.label}
              className={`text-center transition-all duration-700 ${
                inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <p className="text-4xl font-bold tracking-tight text-slate-900 xl:text-5xl">
                {inView ? (
                  <Counter to={item.value} suffix={item.suffix} />
                ) : (
                  `0${item.suffix}`
                )}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { ref, inView } = useInView();

  const features = [
    {
      icon: Sparkles,
      title: "AI Contract Analysis",
      desc: "Surface risks, missing clauses, and key obligations instantly.",
      color: "bg-violet-50 text-violet-600",
    },
    {
      icon: Shield,
      title: "Conflict Detection",
      desc: "Compare contracts and identify cross-document contradictions early.",
      color: "bg-indigo-50 text-indigo-600",
    },
    {
      icon: Workflow,
      title: "Approval Workflows",
      desc: "Move agreements through clear, trackable internal approvals.",
      color: "bg-cyan-50 text-cyan-600",
    },
    {
      icon: CalendarDays,
      title: "Renewal Visibility",
      desc: "Track deadlines, expiries, and renewal windows in one place.",
      color: "bg-rose-50 text-rose-600",
    },
    {
      icon: AlertTriangle,
      title: "Risk Scoring",
      desc: "Prioritize attention using clear risk indicators and summaries.",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      desc: "Support legal, operations, and management with role-based access.",
      color: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <section id="features" className="bg-[#F8FAFC] py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div
          ref={ref}
          className={`mb-14 text-center transition-all duration-700 ${
            inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl">
            Everything Contracts Need
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            Built for teams that want better contract control without messy
            spreadsheets or long email chains.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className={`rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-lg ${
                  inView ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div
                  className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${feature.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  const { ref, inView } = useInView();

  const items = [
    {
      icon: SearchCheck,
      title: "Reduce Surprises",
      desc: "Spot risky clauses and hidden conflicts between contracts before they slow down execution.",
    },
    {
      icon: BarChart3,
      title: "Improve Visibility",
      desc: "See contract status, approvals, and risk score across your contracts.",
    },
    {
      icon: Clock3,
      title: "Move Faster",
      desc: "Cut manual review effort and keep agreements moving through the business.",
    },
  ];

  return (
    <section id="benefits" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div
          ref={ref}
          className={`mb-14 text-center transition-all duration-700 ${
            inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="text-4xl font-bold tracking-tight text-slate-900 lg:text-5xl">
            Faster deals, fewer risks
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500">
            A single contract workspace that helps teams stay aligned and act
            with confidence.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`rounded-3xl border border-slate-200/80 bg-slate-50/60 p-8 transition-all duration-700 ${
                  inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#07153A] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const { ref, inView } = useInView();

  const steps = [
    {
      num: "01",
      icon: Upload,
      title: "Upload or Create",
      desc: "Bring in your existing contracts or start from a structured template.",
    },
    {
      num: "02",
      icon: Sparkles,
      title: "Analyze and Compare",
      desc: "Run AI analysis, review risks, and detect conflicts across contracts.",
    },
    {
      num: "03",
      icon: CheckCircle2,
      title: "Approve and Track",
      desc: "Move through workflows, approvals, and deadlines in one place.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-[#07153A] py-28"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-[70px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-violet-500/10 blur-[60px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <div
          ref={ref}
          className={`mb-16 text-center transition-all duration-700 ${
            inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">
            From Draft to Decision
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100/70">
            A clear process that helps contracts move without confusion.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className={`rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-700 ${
                  inView ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
                  <Icon className="h-6 w-6 text-white" />
                </div>

                <span className="mb-3 block text-xs font-bold uppercase tracking-[0.22em] text-white/30">
                  Step {step.num}
                </span>
                <h3 className="mb-3 text-xl font-semibold text-white">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-blue-100/60">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  const { ref, inView } = useInView();

  const items = [
    {
      quote:
        "Clause gives our team a cleaner way to manage reviews, approvals, and contract visibility.",
      name: "Sarah K.",
      role: "Legal Operations",
      color: "bg-indigo-500",
    },
    {
      quote:
        "The AI analysis and workflow tracking make the whole process faster and easier to monitor.",
      name: "Marcus T.",
      role: "Operations Manager",
      color: "bg-violet-500",
    },
    {
      quote:
        "We finally have one workspace for contracts instead of scattered documents and email threads.",
      name: "Priya R.",
      role: "General Counsel",
      color: "bg-cyan-500",
    },
  ];

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div
          ref={ref}
          className={`mb-12 text-center transition-all duration-700 ${
            inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
          }`}
        >
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
            Built for Teams that Handle Contracts Everyday
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <div
              key={item.name}
              className={`rounded-3xl border border-slate-200/80 bg-slate-50/60 p-7 transition-all duration-700 ${
                inView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, j) => (
                  <Star
                    key={j}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <p className="mb-6 text-sm leading-relaxed text-slate-600">
                “{item.quote}”
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white ${item.color}`}
                >
                  {item.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {item.name}
                  </p>
                  <p className="text-xs text-slate-400">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  const { ref, inView } = useInView();

  return (
    <section id="start" className="bg-[#F8FAFC] py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div
          ref={ref}
          className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#07153A] via-indigo-900 to-violet-900 p-12 text-center transition-all duration-700 md:p-20 ${
            inView ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
          }`}
        >
          <div className="absolute left-0 top-0 h-64 w-64 rounded-full bg-indigo-400/15 blur-[60px]" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-violet-400/15 blur-[60px]" />

          <div className="relative space-y-6">
            <div className="flex justify-center">
            </div>

            <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
              Ready to Manage Contracts
              <br className="hidden md:block" />
               in One Place?
            </h2>

            <p className="mx-auto max-w-lg text-lg text-blue-100/70">
              Start with a polished contract workspace built for visibility,
              risk awareness, and faster approvals.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link to="/sign-up">
                <Button className="rounded-full bg-white px-8 py-6 text-[15px] text-slate-900 hover:bg-indigo-50">
                  Start Free Today
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>

              <Link to="/sign-in">
                <Button
                  variant="outline"
                  className="rounded-full border-white/25 bg-transparent px-8 py-6 text-[15px] text-white hover:bg-white/10 hover:text-white"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <img src="/clause-logo.jpeg" alt="Clause" className="h-7 w-7 rounded-lg object-contain" />
          <span className="text-[15px] font-semibold text-slate-800">
            Clause
          </span>
        </div>

        <div className="flex items-center gap-6">
          {["Privacy", "Terms", "Security", "Contact"].map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm text-slate-400 transition-colors hover:text-slate-700"
            >
              {item}
            </a>
          ))}
        </div>

        <p className="text-sm text-slate-400">
          © {new Date().getFullYear()} Clause. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="font-sans antialiased">
      <Navbar />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <BenefitsSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </div>
  );
}