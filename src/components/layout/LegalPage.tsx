import type { ReactNode } from 'react'
import { PublicLayout } from '@/components/layout/PublicLayout'

export type LegalSection = {
  id: string
  title: string
  body: ReactNode
}

/**
 * Long-form layout shared by the privacy policy and terms of use: a title
 * block, a sticky contents list on wide screens, and numbered sections that
 * can be linked to directly (/privacy#biometric-data).
 */
export function LegalPage({
  eyebrow,
  title,
  intro,
  effective,
  sections,
}: {
  eyebrow: string
  title: string
  intro: ReactNode
  effective: string
  sections: LegalSection[]
}) {
  return (
    <PublicLayout>
      <div className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <div className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600">{intro}</div>
          <p className="mt-6 text-sm text-muted">Effective {effective}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_1fr] lg:py-16">
        <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contents</p>
          <ol className="mt-4 space-y-2 border-l border-slate-200 text-sm">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px block border-l-2 border-transparent py-0.5 pl-4 text-slate-600
                             transition-colors hover:border-brand-500 hover:text-slate-900"
                >
                  <span className="id-text mr-1.5 text-slate-400">{index + 1}.</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 max-w-3xl">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-b border-slate-100 py-8 first:pt-0 last:border-0">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                <span className="id-text mr-2 text-brand-600">{index + 1}.</span>
                {section.title}
              </h2>
              <div className="legal-prose mt-4">{section.body}</div>
            </section>
          ))}
        </article>
      </div>
    </PublicLayout>
  )
}
