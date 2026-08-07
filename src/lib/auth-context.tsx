import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /**
   * False while a signed-in user's profile is still being fetched.
   *
   * Without this, `profile === null` is ambiguous: it means both "this user
   * has no profile" and "the profile hasn't arrived yet". Guards that cannot
   * tell those apart will bounce a valid admin to /no-access in the moment
   * between signing in and the profile resolving.
   */
  profileReady: boolean
  isAdmin: boolean
  isSupervisor: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

/**
 * Distinguish "could not reach Supabase" from "bad credentials".
 *
 * supabase-js surfaces DNS failures, offline states and CORS problems as
 * generic fetch errors. Without this check they all render as "wrong
 * password", which is actively misleading.
 */
function isNetworkFailure(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to send') ||
    m.includes('timeout') ||
    m.includes('econn')
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // The user id whose profile fetch has completed — success or failure.
  // Comparing this against the current session tells us whether `profile`
  // is trustworthy yet.
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)

  // Guards every setState against a unmounted component and against a stale
  // response from a previous session overwriting the current one.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    async function loadProfile(userId: string) {
      // maybeSingle(), never single(): a missing profile row is a legitimate
      // state (invited but not yet provisioned) and must not throw.
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted.current) return

      if (error) {
        console.error('[auth] profile load failed:', error.message)
        setProfile(null)
      } else {
        setProfile(data)
      }

      // Mark resolved either way — a failed fetch must not leave the app
      // spinning forever.
      setProfileLoadedFor(userId)
    }

    // 1. Restore any existing session on first paint.
    supabase.auth
      .getSession()
      .then(async ({ data: { session: restored } }) => {
        if (!mounted.current) return
        setSession(restored)
        if (restored?.user) await loadProfile(restored.user.id)
      })
      .catch((err) => {
        console.error('[auth] session restore failed:', err)
      })
      .finally(() => {
        // Always resolve loading, even on failure. A rejected promise that
        // never clears this flag is what produces an infinite spinner.
        if (mounted.current) setLoading(false)
      })

    // 2. React to future auth changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return

      setSession(nextSession)

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null)
        setProfileLoadedFor(null)
        setLoading(false)
        return
      }

      // Deferred deliberately. Calling another supabase method synchronously
      // inside this callback can deadlock the client's internal lock; pushing
      // it to the next tick avoids that.
      setTimeout(() => {
        if (mounted.current) void loadProfile(nextSession.user.id)
      }, 0)
    })

    return () => {
      mounted.current = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      profileReady: !session?.user || profileLoadedFor === session.user.id,
      isAdmin: profile?.role === 'admin',
      isSupervisor: profile?.role === 'supervisor',

      async signIn(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (!error) return { error: null }

          // A network failure is not a credentials failure. Reporting
          // "wrong password" when the server was never reached sends people
          // hunting for a typo that does not exist.
          if (isNetworkFailure(error.message)) {
            return { error: 'NETWORK' }
          }
          return { error: 'CREDENTIALS' }
        } catch (err) {
          console.error('[auth] sign-in threw:', err)
          return { error: 'NETWORK' }
        }
      },

      async signOut() {
        // Clear local state first so the UI never shows a signed-out user
        // still holding their old profile while the network call settles.
        setProfile(null)
        setProfileLoadedFor(null)
        setSession(null)
        await supabase.auth.signOut()
      },
    }),
    [session, profile, loading, profileLoadedFor],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
