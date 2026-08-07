# Email templates

Branded replacements for Supabase's default authentication emails.

## Installing them

Supabase Dashboard → **Authentication → Emails**. Pick the template, paste the
file contents into the message body, and save.

| File | Template to replace | Suggested subject |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Confirm your BioAttend account` |
| `reset-password.html` | Reset password | `Reset your BioAttend password` |

Set the sender name to **Northcrest General** under Project Settings → Auth, so
the inbox line reads as the hospital rather than as Supabase.

## Why they are written this way

Email HTML is not web HTML, and three constraints shape every decision in these
files:

**Inline styles only.** Gmail strips `<style>` blocks entirely. Every rule is
written on the element it applies to, which is verbose but is the only thing
that renders reliably.

**Tables for layout.** Outlook renders through Microsoft Word's engine, which
does not support flexbox or grid. Nested tables are the only layout that works
across clients.

**They must read correctly with images blocked.** Most clients block images
until the reader clicks "show images", so a design that depends on a logo
loading will arrive looking broken. The shield is therefore drawn as a coloured
table cell containing a heavy plus character (`&#10010;`) rather than as an
image. It approximates the mark, and it always appears.

**No inline SVG.** Gmail removes SVG entirely. The favicon cannot be reused
here even though it is the same shape.

## Variables

Supabase substitutes these before sending:

| Variable | Meaning |
|---|---|
| `{{ .ConfirmationURL }}` | The link to click |
| `{{ .Token }}` | Six-digit code, if you prefer codes to links |
| `{{ .Email }}` | The recipient's address |
| `{{ .SiteURL }}` | Your configured site URL |

## Before these work

**Authentication → URL Configuration** must list your deployed site, or the
links will point at localhost:

```
Site URL:       https://bio-attend-one.vercel.app
Redirect URLs:  https://bio-attend-one.vercel.app/**
                http://localhost:5173/**
```

## A limitation worth knowing

Supabase's built-in email service is rate-limited and intended for development.
It is adequate for testing and for a demonstration, but a hospital sending
password resets to dozens of staff would need a proper SMTP provider configured
under Project Settings → Auth → SMTP Settings.

Worth stating in the write-up rather than discovering during a defence.
