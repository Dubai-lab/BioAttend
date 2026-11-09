import { Link } from 'react-router-dom'
import { LegalPage, type LegalSection } from '@/components/layout/LegalPage'

/**
 * Privacy policy and biometric data notice.
 *
 * Written to describe what the system does today. When the data model or a
 * service provider changes, this page must change in the same commit.
 */

const EFFECTIVE = '9 November 2026'

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          BioAttend is the staff attendance and shift management system of{' '}
          <strong>Northcrest General Hospital</strong> (“the hospital”, “we”).
          The hospital decides why and how personal data in BioAttend is
          processed, and is the <strong>data controller</strong> for that data
          under Rwanda’s Law No. 058/2021 of 13/10/2021 relating to the
          protection of personal data and privacy.
        </p>
        <p>
          This policy applies to everyone whose data is held in BioAttend:
          staff enrolled for attendance, and the supervisors and HR
          administrators who use the console.
        </p>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'The data we hold',
    body: (
      <>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>What it contains</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Staff record</strong></td>
              <td>Full name, staff number, department, job title, phone number, work email, employment start and end dates, and status (active or deactivated).</td>
            </tr>
            <tr>
              <td><strong>Consent record</strong></td>
              <td>That consent was given, and the date and time it was recorded.</td>
            </tr>
            <tr>
              <td><strong>Biometric data</strong></td>
              <td>Fingerprint templates (up to four fingers) and one facial representation. See <a href="#biometric-data">section 3</a>.</td>
            </tr>
            <tr>
              <td><strong>Roster</strong></td>
              <td>The shifts a staff member is assigned to.</td>
            </tr>
            <tr>
              <td><strong>Attendance</strong></td>
              <td>Check-in and check-out times, the method used (fingerprint, face or staff number), the station used, the shift, and status such as late or approved, with who approved it.</td>
            </tr>
            <tr>
              <td><strong>Check-in attempts</strong></td>
              <td>Scans that could not be recorded as attendance, for example outside a check-in window or when no match was found, with the time, station and reason.</td>
            </tr>
            <tr>
              <td><strong>Console accounts</strong></td>
              <td>For supervisors and HR administrators only: name, email address, role and department. Passwords are held by the authentication service in hashed form and are never visible to the hospital.</td>
            </tr>
            <tr>
              <td><strong>Audit log</strong></td>
              <td>A record of changes made in the console: what changed, who made the change and when. Biometric data is removed from every audit entry.</td>
            </tr>
          </tbody>
        </table>
        <p>
          Staff do not have accounts and never sign in. We do not use
          advertising, analytics or tracking cookies.
        </p>
      </>
    ),
  },
  {
    id: 'biometric-data',
    title: 'Biometric data notice',
    body: (
      <>
        <p>
          Biometric data is sensitive personal data. Because of that, it is
          handled under stricter rules than anything else in the system.
        </p>
        <h3>What is kept, and what is not</h3>
        <ul>
          <li>
            <strong>Fingerprint:</strong> a mathematical template derived from
            the ridge pattern of each enrolled finger. The fingerprint image is
            discarded once the template is made and is never stored.
          </li>
          <li>
            <strong>Face:</strong> a set of 512 numbers derived from photographs
            taken at enrolment. The photographs are not stored, and frames
            captured at check-in are discarded as soon as they have been
            compared.
          </li>
          <li>
            Neither a template nor a facial representation can be used to
            rebuild a fingerprint or a photograph of the person.
          </li>
        </ul>
        <h3>Consent comes first</h3>
        <p>
          Biometric data is collected only after consent. The enrolment screen
          keeps the fingerprint and camera controls locked until three
          statements have been recorded: that the processing has been
          explained, that only templates will be stored, and that the right to
          withdraw has been explained.
        </p>
        <h3>Who can see it</h3>
        <p>
          No one. No screen in BioAttend displays biometric data. Supervisors
          cannot access it at all, a restriction enforced by the database
          rather than by the screen. It is used only by the automated
          comparison that runs when a staff member presents at a check-in
          station.
        </p>
        <h3>Where it is matched</h3>
        <p>
          Fingerprint templates are copied to the memory of the hospital’s
          fingerprint reader, where matching takes place. Face comparison runs
          on a hospital computer. When a phone is used for face enrolment or
          check-in, the captured frame travels over an encrypted connection to
          that computer and is not kept.
        </p>
        <h3>How long it is kept</h3>
        <p>
          Until the staff member leaves the hospital or withdraws consent,
          whichever comes first. Either event leads to the templates and the
          facial representation being deleted, and the fingerprint reader is
          re-synchronised so that its copy is removed too.
        </p>
      </>
    ),
  },
  {
    id: 'why-we-use-it',
    title: 'Why we use it',
    body: (
      <>
        <p>We use personal data in BioAttend only to:</p>
        <ul>
          <li>confirm the identity of staff when they check in and out;</li>
          <li>record attendance against the shift roster;</li>
          <li>allow supervisors to review attendance, lateness and exceptions for their department;</li>
          <li>produce attendance reports for HR and payroll administration;</li>
          <li>keep the system secure and maintain an audit trail of changes.</li>
        </ul>
        <p>
          The legal basis for biometric processing is the staff member’s
          explicit consent. Other attendance data is processed to manage the
          employment relationship and meet the hospital’s staffing and record
          keeping obligations. Biometric data is never used for any purpose
          other than attendance.
        </p>
      </>
    ),
  },
  {
    id: 'automated-decisions',
    title: 'Automated decisions',
    body: (
      <>
        <p>
          BioAttend decides automatically whether a scan matches an enrolled
          person, and whether it falls inside a check-in or check-out window.
          It does not make decisions about pay, discipline or employment.
        </p>
        <ul>
          <li>A late arrival is recorded and flagged for a supervisor to review, never discarded.</li>
          <li>If a face match is too close to call between two people, the station identifies no one and asks for a staff number instead.</li>
          <li>Anyone who cannot be matched can have their attendance recorded by the procedure in place before this system.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          We do not sell personal data or share it for marketing. Inside the
          hospital, access follows role: supervisors see their own department’s
          attendance; HR administrators manage enrolment and settings.
        </p>
        <p>The system relies on these service providers, who process data only on our instructions:</p>
        <ul>
          <li><strong>Supabase</strong> — database and console sign-in.</li>
          <li><strong>Vercel</strong> — hosting of the BioAttend web application.</li>
          <li><strong>Cloudflare</strong> — the encrypted connection used when a phone camera is used for face check-in.</li>
        </ul>
        <p>
          Some of these providers’ servers may be located outside Rwanda. Any
          such transfer is made only with the safeguards required by Law No.
          058/2021. We disclose data to authorities only where the law
          requires it.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <ul>
        <li>All traffic between browsers, stations and the database is encrypted.</li>
        <li>Access rules are enforced by row-level security in the database, so they apply whichever device or application is used.</li>
        <li>Attendance can only be written by a registered check-in station holding its own credential.</li>
        <li>Face check-in includes a liveness check to reject photographs held up to the camera.</li>
        <li>Every change made in the console is logged, and biometric data is excluded from the log.</li>
        <li>Credentials for the system are kept out of the source code.</li>
      </ul>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>
          <strong>Biometric data</strong> is kept until the staff member leaves
          or withdraws consent, as described in <a href="#biometric-data">section 3</a>.
        </p>
        <p>
          <strong>Attendance records, the roster and the audit log</strong> are
          employment records. They are kept separately from biometric data, so
          deleting biometric data does not erase a person’s attendance history,
          and they are retained for as long as the hospital’s legal and
          employment obligations require.
        </p>
        <p>
          When a staff member leaves, their record is deactivated so that they
          can no longer check in.
        </p>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <>
        <p>Under Law No. 058/2021 you have the right to:</p>
        <ul>
          <li>be told how your personal data is processed;</li>
          <li>obtain a copy of the personal data we hold about you;</li>
          <li>have inaccurate data corrected;</li>
          <li>have your data deleted where the law allows, including your biometric data on withdrawal of consent;</li>
          <li>object to processing, or ask for it to be restricted;</li>
          <li>not be subject to a decision based solely on automated processing that significantly affects you;</li>
          <li>withdraw consent to biometric processing at any time.</li>
        </ul>
        <p>
          Withdrawing consent is done by writing to the Human Resources
          Officer. You do not need to give a reason, and it has no consequence
          for your employment.
        </p>
        <p>
          If you are not satisfied with our response, you may complain to the
          National Cyber Security Authority (NCSA), the supervisory authority
          for personal data protection in Rwanda.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <>
        <p>
          For questions about this policy, to exercise your rights, or to
          withdraw consent, contact the <strong>Human Resources Office,
          Northcrest General Hospital</strong>.
        </p>
        <p>
          We may update this policy when the system changes. The effective
          date at the top of this page shows when it was last revised. See also
          the <Link to="/terms">terms of use</Link>.
        </p>
      </>
    ),
  },
]

export function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      effective={EFFECTIVE}
      intro={
        <p>
          How BioAttend collects, uses and protects personal data, including
          the fingerprint and facial data used to record staff attendance.
        </p>
      }
      sections={sections}
    />
  )
}
