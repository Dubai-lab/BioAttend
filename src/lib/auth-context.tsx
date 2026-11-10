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
  /**
   * True when the profile could not be fetched at all (network, server) and
   * there is no earlier copy to fall back on. Distinct from "has no profile":
   * the person is not refused, the server simply could not be asked.
   */
  profileError: boolean
  /** Fetch the profile again — used by the retry buttons. */
  reloadProfile: () => Promise<void>
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

/**
 * Errors that mean the stored login itself is no good, as opposed to the
 * server being unreachable: an expired or invalid token (PostgREST PGRST301 /
 * PGRST303, or a "JWT" message).
 */
function isDeadSession(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()
  return code === 'PGRST301' || code === 'PGRST303' || message.includes('jwt')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // The user id whose profile fetch has completed — success or failure.
  // Comparing this against the current session tells us whether `profile`
  // is trustworthy yet.
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)

  const [profileError, setProfileError] = useState(false)

  // Guards every setState against a unmounted component and against a stale
  // response from a previous session overwriting the current one.
  const mounted = useRef(true)
  // The profile currently held, readable inside async loaders without
  // re-creating them on every change.
  const profileRef = useRef<Profile | null>(null)
  const loadProfileRef = useRef<(userId: string) => Promise<void>>(async () => {})
  const lastEmptyRefresh = useRef(0)

  useEffect(() => {
    mounted.current = true

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    async function fetchProfile(userId: string) {
      // maybeSingle(), never single(): a missing profile row is a legitimate
      // state (invited but not yet provisioned) and must not throw.
      return supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    }

    /**
     * Load the signed-in user's profile without ever mistaking a hiccup for
     * "no access".
     *
     * The profile is re-read every time the session refreshes — hourly, and
     * whenever the PC wakes or the network returns. Previously one failed or
     * empty read set the profile to null, and the console sent a perfectly
     * valid administrator to "No console access" and left them there.
     *
     *   - A failed request is retried; if it still fails, the profile already
     *     held for this user is kept.
     *   - An empty result can be a request sent with a token that had just
     *     expired (row-level security then hides the row). The session is
     *     refreshed and the read repeated before "no profile" is believed.
     */
    async function loadProfile(userId: string) {
      let result = await fetchProfile(userId)
      for (const delay of [800, 2500]) {
        if (!result.error || isDeadSession(result.error)) break
        console.warn('[auth] profile load failed, retrying:', result.error.message)
        await wait(delay)
        if (!mounted.current) return
        result = await fetchProfile(userId)
      }

      // At most once a minute: the refresh itself fires another auth event and
      // another load, which for someone who truly has no profile must not loop.
      if (!result.error && !result.data && Date.now() - lastEmptyRefresh.current > 60_000) {
        lastEmptyRefresh.current = Date.now()
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError) result = await fetchProfile(userId)
      }

      // A rejected token is not a network problem: the saved login is dead
      // (expired and unable to renew, or revoked). Retrying can never fix it,
      // and showing "cannot reach the server" kept the browser stuck on it.
      // Try one renewal; if that fails, sign out so the person can sign in.
      if (result.error && isDeadSession(result.error)) {
        const { error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError) result = await fetchProfile(userId)
        if (refreshError || (result.error && isDeadSession(result.error))) {
          console.warn('[auth] saved session is no longer valid — signing out')
          profileRef.current = null
          await supabase.auth.signOut({ scope: 'local' })
          return
        }
      }

      if (!mounted.current) return
      const held = profileRef.current?.id === userId ? profileRef.current : null

      if (result.error) {
        console.error('[auth] profile load failed:', result.error.message)
        // Keep what we had. Only with nothing to fall back on is it an error.
        profileRef.current = held
        setProfile(held)
        setProfileError(!held)
      } else {
        profileRef.current = result.data
        setProfile(result.data)
        setProfileError(false)
      }

      // Mark resolved either way — a failed fetch must not leave the app
      // spinning forever.
      setProfileLoadedFor(userId)
    }
    loadProfileRef.current = loadProfile

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
        profileRef.current = null
        setProfile(null)
        setProfileLoadedFor(null)
        setProfileError(false)
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
      profileError,
      async reloadProfile() {
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) await loadProfileRef.current(data.session.user.id)
      },
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
        profileRef.current = null
        setProfile(null)
        setProfileLoadedFor(null)
        setProfileError(false)
        setSession(null)
        await supabase.auth.signOut()
      },
    }),
    [session, profile, loading, profileLoadedFor, profileError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
