import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Clock,
  EyeOff,
  FileSpreadsheet,
  Fingerprint,
  History,
  KeyRound,
  Lock,
  Moon,
  ScanFace,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { ShieldMark } from '@/components/brand/Logo'

/**
 * Public landing page.
 *
 * Every claim on this page describes something the system actually does —
 * no invented statistics, customers or testimonials. If a feature changes,
 * change the sentence here with it.
 */
export function Landing() {
  return (
    <PublicLayout>
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Roles />
      <DataProtection />
      <ClosingCall />
    </PublicLayout>
  )
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-shell-950 text-white">
      {/* Soft teal glow behind the station illustration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Northcrest General Hospital · Staff attendance
          </p>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Know who is on duty,{' '}
            <span className="text-brand-300">verified at the point of care.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            BioAttend records staff arrival and departure with fingerprint and
            facial recognition, checks every scan against the shift roster, and
            gives supervisors an accurate picture of attendance — without
            storing a single fingerprint image or photograph.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/sign-in"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-brand-500 px-5 py-3
                         text-sm font-semibold text-white transition-colors hover:bg-brand-400"
            >
              Sign in to the console
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-white/15
                         px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              See how it works
            </a>
          </div>

          <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <HeroFact term="Biometrics" value="Fingerprint + face" />
            <HeroFact term="Images stored" value="None" />
            <HeroFact term="Staff passwords" value="None needed" />
          </dl>
        </div>

        <StationIllustration />
      </div>
    </section>
  )
}

function HeroFact({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">{term}</dt>
      <dd className="mt-1.5 text-sm font-semibold text-white sm:text-base">{value}</dd>
    </div>
  )
}

/**
 * A drawing of the check-in station, not a screenshot: it shows the three
 * states a person sees, without presenting any real staff member's data.
 */
function StationIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="rounded-[1.75rem] border border-white/10 bg-shell-900 p-3 shadow-2xl shadow-black/40">
        <div className="rounded-[1.25rem] bg-shell-950 px-6 pb-8 pt-6">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldMark tone="light" className="h-4" />
              Check-in station
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success-500" />
              Check-in open
            </span>
          </div>

          <div className="mt-10 flex flex-col items-center text-center">
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/20" />
              <div className="relative grid size-24 place-items-center rounded-full border border-brand-400/40 bg-brand-500/10">
                <Fingerprint className="size-12 text-brand-300" strokeWidth={1.4} />
              </div>
            </div>
            <p className="mt-6 text-2xl font-semibold text-white">Place your finger</p>
            <p className="mt-1.5 text-sm text-slate-400">or look at the camera</p>
          </div>

          <div className="mt-10 space-y-2.5">
            <StationRow icon={BadgeCheck} tone="success" title="Identity confirmed" note="Matched on the reader" />
            <StationRow icon={Clock} tone="brand" title="Checked against your shift" note="Inside the check-in window" />
            <StationRow icon={ClipboardCheck} tone="brand" title="Attendance recorded" note="Visible to your supervisor" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StationRow({
  icon: Icon,
  title,
  note,
  tone,
}: {
  icon: LucideIcon
  title: string
  note: string
  tone: 'success' | 'brand'
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-2.5">
      <Icon
        className={tone === 'success' ? 'size-4 text-success-500' : 'size-4 text-brand-300'}
        strokeWidth={2}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <p className="text-xs text-slate-500">{note}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow: string
  title: string
  lead?: string
  center?: boolean
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {lead && <p className="mt-4 text-base leading-relaxed text-slate-600">{lead}</p>}
    </div>
  )
}

function Problem() {
  const points = [
    {
      title: 'Paper registers can be signed for someone else',
      body: 'A signature proves that a name was written, not that the person was present. Biometric check-in can only be completed by the person themselves.',
    },
    {
      title: 'Records are assembled after the fact',
      body: 'Handwritten sheets are collected, read and typed up days later. BioAttend records each scan the moment it happens, ready for the supervisor that same shift.',
    },
    {
      title: 'Rosters and attendance live in different places',
      body: 'Without a link between the two, a late or missing arrival is found only by comparing lists by hand. Here every scan is checked against the staff member’s shift.',
    },
  ]

  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Why it exists"
          title="Attendance a hospital can rely on"
          lead="Staffing decisions, overtime and patient safety all depend on knowing who was actually on the ward. Manual registers make that hard to prove."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {points.map((point, index) => (
            <div key={point.title} className="rounded-card border border-slate-200 bg-slate-50 p-6">
              <p className="id-text text-sm font-semibold text-brand-600">0{index + 1}</p>
              <h3 className="mt-3 text-base font-semibold text-slate-900">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      icon: UserCog,
      title: 'Enrol, with consent',
      body: 'HR registers the staff member and records three separate consent statements. Only then does the system allow fingerprint or face capture.',
    },
    {
      icon: Fingerprint,
      title: 'Check in at a station',
      body: 'At the start and end of a shift, staff present a finger or their face at a registered check-in station. No card, PIN or password to remember.',
    },
    {
      icon: CalendarClock,
      title: 'Checked against the roster',
      body: 'Each scan is matched to the staff member’s shift and its check-in and check-out windows. Late arrivals are recorded and flagged, never silently dropped.',
    },
    {
      icon: ClipboardCheck,
      title: 'Supervisors review',
      body: 'Supervisors see live attendance and exceptions for their own department, approve late arrivals, and export reports.',
    },
  ]

  return (
    <section id="how-it-works" className="scroll-mt-16 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="From enrolment to report, in four steps"
          center
        />
        <ol className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-shell-900 text-brand-300">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="id-text text-xs font-semibold text-slate-400">Step {index + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Features() {
  const features: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: Fingerprint,
      title: 'Fingerprint matching on the device',
      body: 'Up to four fingers are enrolled per person. Matching runs inside the reader itself, and the database remains the system of record.',
    },
    {
      icon: ScanFace,
      title: 'Face recognition with liveness checks',
      body: 'A 512-number facial representation is compared at the station, after a liveness check that rejects photographs held up to the camera.',
    },
    {
      icon: ShieldCheck,
      title: 'Ambiguous matches name nobody',
      body: 'If two people score too closely, the station does not guess. It asks for a staff number and confirms that single person instead.',
    },
    {
      icon: Clock,
      title: 'Time windows, not scan order',
      body: 'Check-in and check-out each have their own window. A scan between them is logged as an attempt rather than mistaken for a departure.',
    },
    {
      icon: Moon,
      title: 'Night shifts handled properly',
      body: 'A shift that starts at 23:00 and ends the next morning is filed under the day it began, so overnight attendance is never split in two.',
    },
    {
      icon: Lock,
      title: 'Only stations can record attendance',
      body: 'Attendance is written only by a registered check-in station holding its own credential. A laptop and a webcam at home cannot mark anyone present.',
    },
    {
      icon: History,
      title: 'Full audit trail',
      body: 'Changes to staff, rosters and approvals are logged with who made them and when. Biometric data is removed from every log entry.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Reports and exports',
      body: 'Attendance, lateness and exceptions can be reviewed by date and department, and exported as CSV for payroll or HR follow-up.',
    },
  ]

  return (
    <section id="features" className="scroll-mt-16 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Features"
          title="Designed around how a hospital actually runs"
          lead="Each rule below is enforced by the database, not just the screen, so it holds no matter which device is used."
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="bg-white p-6">
              <feature.icon className="size-5 text-brand-600" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Roles() {
  const roles = [
    {
      icon: Users,
      name: 'Staff',
      access: 'No account, no password',
      points: [
        'Check in and out at a station with a finger or face',
        'View their own attendance record at the station',
        'Never sign in to the console',
      ],
    },
    {
      icon: ClipboardCheck,
      name: 'Department supervisor',
      access: 'Signs in to the console',
      points: [
        'Live attendance for their own department',
        'Shift roster and exceptions',
        'Approve late arrivals; run reports',
        'No access to biometric data',
      ],
    },
    {
      icon: KeyRound,
      name: 'HR administrator',
      access: 'Signs in to the console',
      points: [
        'Enrol staff and record consent',
        'Manage stations, readers and console access',
        'Hospital settings and the audit log',
        'Deactivate staff who leave and act on deletion requests',
      ],
    },
  ]

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Who uses it"
          title="Each person sees only what their role needs"
          center
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.name} className="flex flex-col rounded-card border border-slate-200 bg-white p-7">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <role.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">{role.name}</h3>
              <p className="text-sm text-muted">{role.access}</p>
              <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                {role.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm text-slate-700">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DataProtection() {
  const commitments: { icon: LucideIcon; title: string; body: string }[] = [
    {
      icon: ClipboardCheck,
      title: 'Consent before capture',
      body: 'The enrolment screen keeps the fingerprint and camera controls locked until all three consent statements are recorded.',
    },
    {
      icon: EyeOff,
      title: 'Templates, never images',
      body: 'Only mathematical templates are kept. No fingerprint image or face photograph is stored, and neither can be rebuilt from what is kept.',
    },
    {
      icon: Lock,
      title: 'No one can view biometric data',
      body: 'No screen displays it. Supervisors have no access to it at all, a restriction enforced by the database itself.',
    },
    {
      icon: Trash2,
      title: 'Deleted on request or departure',
      body: 'Biometric data is deleted when a staff member leaves or withdraws consent. Their attendance history is kept separately.',
    },
  ]

  return (
    <section id="privacy" className="scroll-mt-16 bg-shell-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">Data protection</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Biometric data is sensitive. We treat it that way.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Under Rwanda’s Law No. 058/2021 on the protection of personal data
            and privacy, biometric data is sensitive personal data that may be
            processed only with clear consent. BioAttend was designed from the
            first table onwards to meet that standard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/privacy"
              className="inline-flex items-center justify-center gap-2 rounded-control bg-white px-5 py-3
                         text-sm font-semibold text-shell-950 transition-colors hover:bg-slate-100"
            >
              Read the privacy policy
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              to="/privacy#biometric-data"
              className="inline-flex items-center justify-center rounded-control border border-white/15 px-5 py-3
                         text-sm font-semibold text-white transition-colors hover:bg-white/5"
            >
              Biometric data notice
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {commitments.map((item) => (
            <div key={item.title} className="rounded-card border border-white/10 bg-white/[0.03] p-6">
              <item.icon className="size-5 text-brand-300" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ClosingCall() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-brand-50 p-8 ring-1 ring-brand-100 sm:p-12 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Supervisors and HR: sign in to the console
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Staff do not need an account. To be enrolled, or to ask about
              your data, contact the Human Resources Office.
            </p>
          </div>
          <Link
            to="/sign-in"
            className="inline-flex shrink-0 items-center gap-2 rounded-control bg-brand-600 px-6 py-3
                       text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
