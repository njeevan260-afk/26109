import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardPlus,
  Database,
  HeartPulse,
  Languages,
  MapPinned,
  Menu,
  Milk,
  RadioTower,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getDashboardPath } from '../auth/dashboardPath';

const audiences = [
  {
    icon: Milk,
    title: 'Dairy farmers',
    description: 'Prioritise animals that need attention before visible symptoms or avoidable milk loss.',
  },
  {
    icon: Stethoscope,
    title: 'Veterinarians',
    description: 'Review risk evidence, clinical history and recommended next checks in one workflow.',
  },
  {
    icon: Building2,
    title: 'Dairy cooperatives',
    description: 'See herd-level patterns, support field teams and protect milk quality across villages.',
  },
  {
    icon: ShieldCheck,
    title: 'Animal health authorities',
    description: 'Identify emerging clusters and strengthen data-led surveillance and response planning.',
  },
];

const solutionPillars = [
  {
    icon: Database,
    number: '01',
    title: 'Connect fragmented signals',
    description: 'Combine milk conductivity, temperature, yield, SCC, activity, treatment history, environment and manual observations.',
  },
  {
    icon: Activity,
    number: '02',
    title: 'Forecast the preclinical window',
    description: 'Turn changing patterns into individual-animal and herd risk for the 7–14 days before clinical signs appear.',
  },
  {
    icon: BellRing,
    number: '03',
    title: 'Move from risk to action',
    description: 'Prioritised alerts explain why risk changed and recommend the next preventive or confirmatory step.',
  },
  {
    icon: BarChart3,
    number: '04',
    title: 'Learn across the network',
    description: 'Role-aware dashboards and outcome feedback support continuous improvement from farm to district scale.',
  },
];

const evidence = [
  {
    value: '247.87',
    unit: 'million tonnes',
    label: 'India’s milk production in 2024–25',
    href: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2195049&lang=2&reg=3',
  },
  {
    value: '8+',
    unit: 'crore farmers',
    label: 'directly employed by India’s dairy sector',
    href: 'https://www.pib.gov.in/PressNoteDetails.aspx?ModuleId=3&NoteId=155298&lang=1&reg=3',
  },
  {
    value: '~45%',
    unit: 'pooled estimate',
    label: 'subclinical mastitis prevalence in India',
    href: 'https://www.sciencedirect.com/science/article/pii/S003452882100120X',
  },
  {
    value: '1.72',
    unit: 'crore members',
    label: 'in dairy cooperatives across ~2.35 lakh villages',
    href: 'https://www.dahd.gov.in/sites/default/files/2025-05/Annual-Report202425.pdf',
  },
];

const impactScenarios = [
  { reduction: '5%', value: '₹358 crore', width: '33%' },
  { reduction: '10%', value: '₹717 crore', width: '66%' },
  { reduction: '15%', value: '₹1,075 crore', width: '100%' },
];

export default function HomePage() {
  const { session, identity } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const appPath = getDashboardPath(identity);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8f2] text-[#16342d]">
      <header className="sticky top-0 z-50 border-b border-[#16342d]/10 bg-[#f7f8f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="HerdVitals home">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#146b55] text-white">
              <HeartPulse className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-serif text-xl font-bold leading-none tracking-tight">HerdVitals</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#517067]">Predict early. Protect every herd.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex" aria-label="Primary navigation">
            <a className="transition hover:text-[#c55b2c]" href="#problem">The problem</a>
            <a className="transition hover:text-[#c55b2c]" href="#solution">Our solution</a>
            <a className="transition hover:text-[#c55b2c]" href="#stakeholders">Who it serves</a>
            <a className="transition hover:text-[#c55b2c]" href="#impact">India impact</a>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link className="rounded-full px-4 py-2.5 text-sm font-bold text-[#16342d] transition hover:bg-white" to="/register">
              Request access
            </Link>
            <Link className="inline-flex items-center gap-2 rounded-full bg-[#16342d] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#245448]" to={session ? appPath : '/login'}>
              {session ? 'Open dashboard' : 'Log in'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#16342d]/15 lg:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(value => !value)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <nav className="border-t border-[#16342d]/10 bg-[#f7f8f2] px-5 py-5 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-7xl gap-1">
              {[
                ['The problem', '#problem'],
                ['Our solution', '#solution'],
                ['Who it serves', '#stakeholders'],
                ['India impact', '#impact'],
              ].map(([label, href]) => (
                <a key={href} className="rounded-lg px-3 py-3 font-semibold hover:bg-white" href={href} onClick={closeMenu}>{label}</a>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Link className="rounded-full border border-[#16342d]/20 px-4 py-2.5 text-center text-sm font-bold" to="/register" onClick={closeMenu}>Request access</Link>
                <Link className="rounded-full bg-[#16342d] px-4 py-2.5 text-center text-sm font-bold text-white" to={session ? appPath : '/login'} onClick={closeMenu}>{session ? 'Dashboard' : 'Log in'}</Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div className="absolute -right-24 top-10 h-80 w-80 rounded-full border-[52px] border-[#e1e8ce] opacity-60" aria-hidden="true" />
        <div className="relative grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#146b55]/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#146b55]">
              <RadioTower className="h-4 w-4" aria-hidden="true" /> SIH 26109 · Predictive animal health
            </div>
            <h1 className="max-w-4xl font-serif text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-[#16342d] sm:text-6xl lg:text-7xl">
              See mastitis risk <span className="text-[#c55b2c]">before</span> the clinical signs.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#517067]">
              HerdVitals brings milk, animal and farm signals together to forecast individual and herd risk in the <strong className="text-[#16342d]">7–14-day preclinical window</strong>—giving teams time to verify, prioritise and intervene earlier.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c55b2c] px-6 py-3.5 font-bold text-white transition hover:bg-[#a94822]" href="#solution">
                Explore the solution <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link className="inline-flex items-center justify-center gap-2 rounded-full border border-[#16342d]/20 bg-white px-6 py-3.5 font-bold transition hover:border-[#16342d]/40" to="/login">
                Sign in to HerdVitals
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm font-semibold text-[#517067]">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#146b55]" /> Animal + herd risk</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#146b55]" /> Role-based workflows</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#146b55]" /> Mobile-ready alerts</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -left-5 -top-5 h-full w-full rounded-[2rem] bg-[#e1e8ce]" aria-hidden="true" />
            <div className="relative rounded-[2rem] border border-[#16342d]/10 bg-white p-5 shadow-[0_24px_80px_rgba(22,52,45,0.14)] sm:p-7">
              <div className="flex items-start justify-between border-b border-[#16342d]/10 pb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#517067]">Early-risk signal</p>
                  <p className="mt-1 font-serif text-2xl font-bold">Cow IND-0427</p>
                </div>
                <span className="rounded-full bg-[#fff0e8] px-3 py-1.5 text-xs font-bold text-[#a94822]">Elevated risk</span>
              </div>
              <div className="grid gap-4 py-5 sm:grid-cols-3">
                <div className="rounded-2xl bg-[#f7f8f2] p-4">
                  <p className="text-xs font-semibold text-[#517067]">Forecast window</p>
                  <p className="mt-2 text-2xl font-black text-[#16342d]">7–14 days</p>
                </div>
                <div className="rounded-2xl bg-[#f7f8f2] p-4">
                  <p className="text-xs font-semibold text-[#517067]">Risk score</p>
                  <p className="mt-2 text-2xl font-black text-[#c55b2c]">78<span className="text-sm">/100</span></p>
                </div>
                <div className="rounded-2xl bg-[#f7f8f2] p-4">
                  <p className="text-xs font-semibold text-[#517067]">Clinical signs</p>
                  <p className="mt-2 text-2xl font-black text-[#146b55]">None</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  ['Conductivity trend', '+18%', 'bg-[#c55b2c]'],
                  ['Milk temperature', '+0.7°C', 'bg-[#e6a12a]'],
                  ['Activity variance', '-11%', 'bg-[#146b55]'],
                ].map(([label, value, colour], index) => (
                  <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-[#16342d]/10 p-3.5">
                    <div>
                      <div className="flex justify-between text-sm font-semibold"><span>{label}</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8ece6]"><div className={`h-full rounded-full ${colour}`} style={{ width: `${68 + index * 8}%` }} /></div>
                    </div>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#e9f4ef] p-4 text-sm">
                <ClipboardPlus className="mt-0.5 h-5 w-5 shrink-0 text-[#146b55]" aria-hidden="true" />
                <p><strong>Suggested next step:</strong> verify udder health and collect a confirmatory SCC/CMT reading within 24 hours.</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[#6c7d77]">Illustrative interface. Risk support is not a veterinary diagnosis.</p>
          </div>
        </div>
      </section>

      <section id="problem" className="bg-[#16342d] px-5 py-20 text-white lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9bd8c8]">The problem</p>
              <h2 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">By the time mastitis looks obvious, the window for prevention is already closing.</h2>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#bed0ca]">Subclinical changes can develop before swelling, abnormal milk, clots or a visible yield decline. Meanwhile, useful evidence sits across sensors, registers, lab records and people.</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-2">
              {[
                ['01', 'Hidden progression', 'Early biological changes are easy to miss without continuous, connected monitoring.'],
                ['02', 'Fragmented evidence', 'Milk quality, behaviour, climate and health history rarely meet in one decision view.'],
                ['03', 'Reactive treatment', 'Late detection increases the chance of production loss, treatment cost and antibiotic use.'],
                ['04', 'Limited network visibility', 'Cooperatives and authorities need herd and cluster patterns—not isolated farm records.'],
              ].map(([number, title, description]) => (
                <article key={number} className="bg-[#1d463c] p-7">
                  <span className="font-mono text-xs font-bold text-[#e6a12a]">{number}</span>
                  <h3 className="mt-8 text-xl font-bold">{title}</h3>
                  <p className="mt-3 leading-7 text-[#bed0ca]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="solution" className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c55b2c]">Our unique approach</p>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Not another disease log. A shared early-warning and action layer.</h2>
            <p className="mt-6 text-lg leading-8 text-[#517067]">The difference is the full loop: multimodal signals become an explainable risk, the right stakeholder receives a role-specific action, and the eventual outcome improves future forecasting.</p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {solutionPillars.map(({ icon: Icon, number, title, description }) => (
              <article key={number} className="group rounded-3xl border border-[#16342d]/10 bg-white p-7 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#16342d]/8 sm:p-8">
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e9f4ef] text-[#146b55]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <span className="font-mono text-sm font-bold text-[#9aa9a3]">{number}</span>
                </div>
                <h3 className="mt-8 text-2xl font-bold">{title}</h3>
                <p className="mt-3 leading-7 text-[#517067]">{description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 rounded-3xl border border-[#16342d]/10 bg-[#e1e8ce] p-6 sm:grid-cols-2 lg:grid-cols-4 lg:p-8">
            {[
              [RadioTower, 'Sense', 'Low-cost farm and animal signals'],
              [Activity, 'Forecast', '7–14-day evolving risk'],
              [BellRing, 'Prioritise', 'Explainable, role-aware alerts'],
              [ClipboardPlus, 'Act & learn', 'Verify, intervene, record outcomes'],
            ].map(([Icon, title, detail], index) => {
              const StepIcon = Icon as typeof RadioTower;
              return (
                <div key={title as string} className="relative rounded-2xl bg-[#f7f8f2] p-5">
                  <StepIcon className="h-6 w-6 text-[#146b55]" aria-hidden="true" />
                  <p className="mt-5 font-bold">{index + 1}. {title as string}</p>
                  <p className="mt-1 text-sm leading-6 text-[#517067]">{detail as string}</p>
                  {index < 3 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 rounded-full bg-[#16342d] p-1 text-white lg:block" aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="stakeholders" className="border-y border-[#16342d]/10 bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#146b55]">Built for the whole chain</p>
              <h2 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight">One health signal. Four useful views.</h2>
              <p className="mt-5 leading-7 text-[#517067]">Information is translated to the decisions each person can actually make, with secure role-based access.</p>
              <div className="mt-8 flex items-center gap-3 text-sm font-bold text-[#146b55]"><Languages className="h-5 w-5" /> Designed for multilingual, mobile-first use</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {audiences.map(({ icon: Icon, title, description }) => (
                <article key={title} className="rounded-2xl border border-[#16342d]/10 p-6">
                  <Icon className="h-7 w-7 text-[#c55b2c]" aria-hidden="true" />
                  <h3 className="mt-6 text-xl font-bold">{title}</h3>
                  <p className="mt-2 leading-7 text-[#517067]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="impact" className="px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c55b2c]">Why this matters at Indian scale</p>
              <h2 className="mt-4 font-serif text-4xl font-bold leading-tight tracking-tight sm:text-5xl">A small improvement can travel through a very large dairy system.</h2>
            </div>
            <p className="max-w-md leading-7 text-[#517067]">These are sourced national and published research figures. They describe the opportunity—not results already achieved by HerdVitals.</p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-[#16342d]/10 bg-[#16342d]/10 sm:grid-cols-2 lg:grid-cols-4">
            {evidence.map(item => (
              <a key={item.value} href={item.href} target="_blank" rel="noreferrer" className="group bg-white p-6 transition hover:bg-[#eef3e3] lg:p-7">
                <p className="font-serif text-4xl font-bold tracking-tight text-[#16342d]">{item.value}</p>
                <p className="mt-1 text-sm font-bold text-[#c55b2c]">{item.unit}</p>
                <p className="mt-6 text-sm leading-6 text-[#517067]">{item.label}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#146b55]">View source <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" /></span>
              </a>
            ))}
          </div>

          <div className="mt-8 grid gap-8 rounded-3xl bg-[#16342d] p-7 text-white lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#9bd8c8]">Illustrative national scenario</p>
              <h3 className="mt-4 font-serif text-3xl font-bold">What if earlier action reduced avoidable mastitis loss?</h3>
              <p className="mt-4 leading-7 text-[#bed0ca]">Applied to a published historical Indian loss estimate of ₹7,165.51 crore per year. This is a sensitivity model, not a claim or forecast.</p>
              <a className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#f5c56a] hover:underline" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9831082/" target="_blank" rel="noreferrer">Review the loss estimate <ArrowRight className="h-4 w-4" /></a>
            </div>
            <div className="space-y-5 rounded-2xl bg-white/7 p-5">
              {impactScenarios.map(scenario => (
                <div key={scenario.reduction}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <p className="text-sm text-[#bed0ca]"><strong className="text-white">{scenario.reduction}</strong> reduction</p>
                    <p className="font-serif text-xl font-bold text-[#f5c56a]">{scenario.value}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#5ac1a6]" style={{ width: scenario.width }} /></div>
                </div>
              ))}
              <p className="pt-2 text-xs leading-5 text-[#9eb4ad]">Potential avoided loss per year, arithmetically modelled. Real impact requires prospective field trials, economic validation and safe adoption.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              [Milk, 'Milk quality & farmer income', 'Earlier confirmation and targeted action can help reduce discarded milk and production loss.'],
              [ShieldCheck, 'Responsible antibiotic use', 'Risk prioritisation can support testing and veterinary oversight instead of indiscriminate treatment.'],
              [MapPinned, 'Stronger cooperative surveillance', 'Aggregated patterns can help field teams identify hotspots and allocate limited support.'],
            ].map(([Icon, title, description]) => {
              const ImpactIcon = Icon as typeof Milk;
              return (
                <article key={title as string} className="rounded-2xl border border-[#16342d]/10 p-6">
                  <ImpactIcon className="h-6 w-6 text-[#146b55]" aria-hidden="true" />
                  <h3 className="mt-5 font-bold">{title as string}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#517067]">{description as string}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8 lg:pb-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#e6a12a] p-8 text-[#16342d] sm:p-10 lg:flex-row lg:items-center lg:p-12">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.16em]">Earlier insight. Better-timed care.</p>
            <h2 className="mt-3 font-serif text-4xl font-bold leading-tight">Build a healthier, more resilient dairy network.</h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link className="rounded-full bg-[#16342d] px-6 py-3.5 text-center font-bold text-white" to={session ? appPath : '/login'}>{session ? 'Open dashboard' : 'Log in'}</Link>
            <Link className="rounded-full border border-[#16342d]/30 px-6 py-3.5 text-center font-bold" to="/register">Request access</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#16342d]/10 bg-white px-5 py-10 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 font-serif text-xl font-bold"><HeartPulse className="h-5 w-5 text-[#146b55]" /> HerdVitals</div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#517067]">An AI-assisted mastitis risk forecasting prototype for Indian dairy systems, developed in response to SIH problem statement 26109.</p>
          </div>
          <div className="text-sm text-[#517067] sm:text-right">
            <p>Decision support only · Not a veterinary diagnosis</p>
            <p className="mt-1">© 2026 HerdVitals team</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
