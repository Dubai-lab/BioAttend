import { ShieldMark } from '@/components/brand/Logo'

export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <ShieldMark className="h-12 animate-pulse" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  )
}
