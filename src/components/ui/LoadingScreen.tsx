import { Fingerprint } from 'lucide-react'

export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex size-12 animate-pulse items-center justify-center rounded-xl bg-brand-500 text-white">
        <Fingerprint className="size-6" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
