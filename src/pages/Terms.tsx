import { Link } from 'react-router-dom'
import { LegalPage, type LegalSection } from '@/components/layout/LegalPage'

const EFFECTIVE = '9 November 2026'

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <p>
        These terms govern the use of BioAttend, the staff attendance and shift
        management system operated by Northcrest General Hospital. They apply
        to staff who check in at a station, and to supervisors and HR
        administrators who use the console. How personal data is handled is
        set out separately in the <Link to="/privacy">privacy policy</Link>.
      </p>
    ),
  },
  {
    id: 'authorised-use',
    title: 'Authorised use',
    body: (
      <>
        <p>
          BioAttend is for the hospital’s own staff attendance and rostering
          only. Console access is given to supervisors and HR administrators
          by the hospital, and may be withdrawn at any time.
        </p>
        <p>Every user agrees not to:</p>
        <ul>
          <li>check in or out on behalf of another person, or help someone else to do so;</li>
          <li>try to deceive a station, for example with a photograph, a recording or a copy of a fingerprint;</li>
          <li>share console credentials, or sign in using someone else’s account;</li>
          <li>try to access data outside their role, or get around the system’s access controls;</li>
          <li>copy, export or disclose attendance data for any purpose other than the hospital’s work.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'staff',
    title: 'Staff using check-in stations',
    body: (
      <ul>
        <li>Enrolment is voluntary and takes place only after you have given consent.</li>
        <li>Check in at the start of each rostered shift and check out at its end, within the times the station allows.</li>
        <li>If the station cannot identify you, use your staff number when it asks, or tell your supervisor.</li>
        <li>If you think your attendance record is wrong, raise it with your supervisor or the HR Office.</li>
      </ul>
    ),
  },
  {
    id: 'console-users',
    title: 'Supervisors and administrators',
    body: (
      <>
        <ul>
          <li>Keep your password private and sign out of shared computers.</li>
          <li>Review and approve attendance fairly and on the basis of what actually happened.</li>
          <li>Use attendance and staff information only for the hospital’s staffing and HR work.</li>
          <li>Administrators must record consent before any biometric capture, and act promptly on requests to withdraw it.</li>
        </ul>
        <p>Changes made in the console are recorded in the audit log under the name of the user who made them.</p>
      </>
    ),
  },
  {
    id: 'records',
    title: 'Attendance records',
    body: (
      <p>
        Attendance recorded by BioAttend forms part of the hospital’s
        employment records. The system flags late arrivals and exceptions for a
        supervisor to review; it does not itself make decisions about pay or
        discipline. Where a record is disputed, the hospital’s usual HR
        procedures apply.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability',
    body: (
      <p>
        We aim to keep BioAttend available whenever it is needed, but stations,
        readers or network connections may occasionally be unavailable. When
        that happens, attendance is recorded by the procedure in place before
        this system, and no one is penalised for a system fault.
      </p>
    ),
  },
  {
    id: 'misuse',
    title: 'Misuse',
    body: (
      <p>
        Breaching these terms, including attempted proxy check-in or
        unauthorised access to data, may lead to console access being removed
        and to action under the hospital’s disciplinary policy and the law.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes and contact',
    body: (
      <p>
        We may update these terms when the system or the hospital’s policies
        change. The effective date above shows the latest version. Questions
        should be directed to the Human Resources Office, Northcrest General
        Hospital.
      </p>
    ),
  },
]

export function Terms() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      effective={EFFECTIVE}
      intro={
        <p>
          The rules for using BioAttend, for staff at check-in stations and for
          supervisors and administrators in the console.
        </p>
      }
      sections={sections}
    />
  )
}
