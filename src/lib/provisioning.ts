import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ConsoleRole } from '@/types/database'

/**
 * Creating console users from inside the admin console.
 *
 * Creating an auth account normally needs the service role key, which must
 * never reach a browser. The way round it is a SECOND Supabase client that
 * does not persist its session: `signUp` creates the account, and because
 * this client stores nothing, the administrator's own session is untouched.
 * Without `persistSession: false` the admin would be silently signed in as
 * the person they just created.
 *
 * The role and department are then attached by `assign_console_role`, a
 * SECURITY DEFINER function that checks the caller is an admin. So the
 * account creation is public-ish, but the authority is not: a user with no
 * profile row can sign in and reach nothing but "No console access".
 *
 * HARDENING FOR A REAL DEPLOYMENT: move this to a Supabase Edge Function
 * holding the service role key, and switch off public sign-ups in
 * Authentication → Providers. That closes the gap where anyone with the anon
 * key could create a login (though still not grant it any access).
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Isolated client — never writes to storage, so it cannot hijack the session. */
const provisioningClient = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export interface CreateConsoleUserInput {
  email: string
  password: string
  fullName: string
  role: ConsoleRole
  departmentId: string | null
}

export type CreateConsoleUserResult =
  | { ok: true; created: boolean }
  | { ok: false; message: string }

export async function createConsoleUser(
  input: CreateConsoleUserInput,
): Promise<CreateConsoleUserResult> {
  const email = input.email.trim().toLowerCase()

  if (input.password.length < 8) {
    return { ok: false, message: 'Password must be at least 8 characters.' }
  }
  if (input.role === 'supervisor' && !input.departmentId) {
    return { ok: false, message: 'A supervisor must be assigned to a department.' }
  }

  // 1. Create the login. An existing account is not an error — the admin may
  //    be re-assigning someone who already has one.
  let created = false
  const { error: signUpError } = await provisioningClient.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: input.fullName.trim() } },
  })

  if (signUpError) {
    const message = signUpError.message.toLowerCase()
    const alreadyExists =
      message.includes('already registered') ||
      message.includes('already been registered') ||
      message.includes('user already exists')

    if (!alreadyExists) {
      if (message.includes('signups not allowed') || message.includes('disabled')) {
        return {
          ok: false,
          message:
            'Sign-ups are disabled for this project. Enable them in Supabase → ' +
            'Authentication → Providers → Email, or create the account there manually.',
        }
      }
      return { ok: false, message: signUpError.message }
    }
  } else {
    created = true
  }

  // 2. Attach the role. This is the part that actually grants access, and it
  //    is guarded server-side by is_admin().
  const { data, error } = await supabase.rpc('assign_console_role', {
    p_email: email,
    p_full_name: input.fullName.trim(),
    p_role: input.role,
    p_department_id: input.role === 'supervisor' ? input.departmentId : null,
  })

  if (error) return { ok: false, message: error.message }

  const result = data as { ok: boolean; reason?: string }
  if (!result?.ok) {
    return {
      ok: false,
      message:
        {
          not_admin: 'Administrators only.',
          department_required: 'A supervisor must be assigned to a department.',
          no_such_user:
            'The account was created but is awaiting email confirmation. Turn off ' +
            '"Confirm email" in Supabase → Authentication → Providers, then assign ' +
            'the role again.',
        }[result?.reason ?? ''] ?? 'Could not assign the role.',
    }
  }

  return { ok: true, created }
}

/** Send a password reset link, for when a supervisor forgets theirs. */
export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await provisioningClient.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/sign-in` },
  )
  return error ? error.message : null
}
