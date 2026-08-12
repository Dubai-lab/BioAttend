# APPENDICES

> Placed after the References.

---

## APPENDIX A — Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| **Staff and enrolment** | | |
| FR1 | Register a staff member with biographic details, department and job title | High |
| FR2 | Record biometric consent, and prevent any capture until it is recorded | High |
| FR3 | Capture and store fingerprint templates for up to four fingers per staff member | High |
| FR4 | Reject a fingerprint capture below a configured quality minimum | High |
| FR5 | Capture and store facial embeddings from five head positions | High |
| FR6 | Verify that a requested head position was achieved before accepting a capture | Medium |
| FR7 | Reject a facial capture that fails anti-spoofing or liveness checks | High |
| FR8 | Add or replace biometrics on an existing staff record without recreating it | High |
| FR9 | Deactivate a staff member, blocking attendance while retaining history | High |
| **Rostering** | | |
| FR10 | Assign shifts to staff for specific dates | High |
| FR11 | Permit at most one shift assignment per staff member per date | High |
| **Attendance** | | |
| FR12 | Identify a staff member from a presented fingerprint | High |
| FR13 | Identify from a presented face when fingerprint identification does not succeed | High |
| FR14 | Refuse to identify when two enrolled individuals score within a configured margin | High |
| FR15 | Allow identity to be asserted by staff number and confirmed by 1:1 facial verification | High |
| FR16 | Record a check-in within the check-in window of the staff member's shift | High |
| FR17 | Record a check-out within the check-out window | High |
| FR18 | Refuse a scan outside both windows, recording the refused attempt | High |
| FR19 | Classify each check-in as on time, late, late beyond grace, or unscheduled | High |
| FR20 | Record every recognition attempt, including refusals, with score and outcome | High |
| FR21 | Accept attendance only from a registered station presenting a valid credential | High |
| **Review and reporting** | | |
| FR22 | Display current attendance, updated without user action | Medium |
| FR23 | Present flagged records for approval, recording who approved without altering captured times | High |
| FR24 | Export attendance records and recognition attempts in a portable format | High |
| **Administration** | | |
| FR25 | Create console users with a role and, for supervisors, a department | High |
| FR26 | Register check-in stations and rotate their credentials | High |
| FR27 | Configure shift windows and matching thresholds | High |
| FR28 | Record administrative actions in an append-only audit log, excluding biometric payloads | Medium |
| FR29 | Synchronise stored templates to a reader and maintain the slot-to-staff mapping | High |

## APPENDIX B — Non-Functional Requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR1 | A fingerprint identification completes within 3 seconds of presentation | Timed at the station |
| NFR2 | A shift change is supported without queuing at the station | Transactions per minute |
| NFR3 | False acceptance is prioritised over false rejection in threshold selection | FAR, FRR from measured data |
| NFR4 | Failure of a local service does not prevent the console operating | Console functions independently |
| NFR5 | Biometric records are accessible only to administrators | Row-level security policies |
| NFR6 | Attendance is not recordable without a station credential | No insert permission on the table |
| NFR7 | No fingerprint image or facial photograph is stored | Templates and embeddings only |
| NFR8 | A normal check-in requires exactly one action from the staff member | Observed |
| NFR9 | The station display is readable from two metres | Type size and contrast |
| NFR10 | Recorded attendance times are not modifiable through the application | No update path for times |
| NFR11 | The database schema is defined in versioned migration files | Migrations under version control |
| NFR12 | Loss of a reader device does not lose biometric data | Templates held in the database |

## APPENDIX C — Database Schema

Fifteen tables in five groups.

| Group | Table | Purpose |
|---|---|---|
| Reference | `departments` | Hospital departments |
| | `job_titles` | Job titles grouped by category |
| | `shifts` | Shift definitions with window configuration |
| | `hospital_settings` | Single-row configuration including thresholds |
| People | `staff` | Staff members; deliberately not linked to authentication |
| | `profiles` | Console users, linked to authentication accounts |
| Biometrics | `fingerprint_templates` | One template per finger per staff member |
| | `face_embeddings` | One 512-d embedding per head position per staff member |
| Devices | `readers` | Fingerprint devices |
| | `reader_slots` | Mapping from device storage slot to staff member |
| | `kiosks` | Check-in stations and their credential hashes |
| Operations | `shift_assignments` | Roster: one shift per staff member per date |
| | `attendance` | One record per staff member per shift date |
| | `attendance_attempts` | Every recognition attempt, including refusals |
| | `audit_log` | Administrative actions |

## APPENDIX D — Access Control Matrix

| Table | Administrator | Supervisor | Station (anonymous) |
|---|---|---|---|
| `staff` | Read/write all | Read own department | None |
| `fingerprint_templates` | Read/write | **None** | None |
| `face_embeddings` | Read/write | **None** | None |
| `attendance` | Read all, approve | Read own department, approve | **No insert** — function only |
| `attendance_attempts` | Read all | Read own department | None |
| `kiosks` | Read/write | None | None |
| `audit_log` | Read all | Read own entries | None |
| `hospital_settings` | Read/write | Read | None |

## APPENDIX E — Functional Test Cases

| ID | Req. | Test case | Expected | Result |
|---|---|---|---|---|
| TC1 | FR1 | Create staff with valid details | Record created, number assigned | Pass |
| TC2 | FR2 | Attempt capture before consent recorded | Capture controls disabled | Pass |
| TC3 | FR4 | Present a poor-quality fingerprint | Capture rejected, not stored | Pass |
| TC4 | FR6 | Request a head position and hold head straight | Capture refused with guidance | Pass |
| TC5 | FR7 | Present a printed photograph | Rejected as not live | Pass |
| TC6 | FR7 | Present a photograph on a phone screen | Rejected as not live | Pass |
| TC7 | FR9 | Deactivate staff, then present their finger | Attendance refused | Pass |
| TC8 | FR11 | Assign two shifts to one person on one date | Second replaces first | Pass |
| TC9 | FR12 | Present enrolled finger within check-in window | Check-in recorded, on time | Pass |
| TC10 | FR13 | Present unenrolled finger, then a face | Falls through to face path | Pass |
| TC11 | FR14 | Present the face of one of two similar individuals | Refused as ambiguous | Pass |
| TC12 | FR15 | Enter staff number and present face | Verified and recorded | Pass |
| TC13 | FR16 | Present finger before the window opens | Refused, opening time shown | Pass |
| TC14 | FR17 | Present finger at 06:10 for a shift begun 22:00 the previous evening | Check-out recorded against the correct shift date | **Fail**, then Pass after fix |
| TC15 | FR18 | Present finger between windows | Refused, attempt logged | Pass |
| TC16 | FR19 | Check in after the grace period | Recorded, flagged for approval | Pass |
| TC17 | FR19 | Check in with no roster entry | Recorded, flagged unscheduled | Pass |
| TC18 | FR20 | Inspect attempt log after a refusal | Refusal present with score and reason | Pass |
| TC19 | FR21 | Call attendance function with invalid credential | Rejected | Pass |
| TC20 | FR21 | Call attendance function with no credential | Rejected | Pass |
| TC21 | FR23 | Approve a flagged record | Approval recorded; times unchanged | Pass |
| TC22 | FR24 | Export attendance and attempts | Files produced with expected columns | Pass |
| TC23 | FR25 | Create a supervisor for one department | Account created; role assigned | Pass |
| TC24 | NFR5 | Supervisor attempts to read biometric records | No rows returned | Pass |
| TC25 | NFR5 | Supervisor requests another department's staff | No rows returned | **Fail**, then Pass after fix |
| TC26 | NFR6 | Attempt direct insert into attendance table | Permission denied | Pass |
| TC27 | FR29 | Synchronise reader, identify newly enrolled staff | Identified successfully | Pass |
| TC28 | NFR12 | Clear device library and re-synchronise | All active staff restored | Pass |
| TC29 | NFR4 | Stop the fingerprint service, attempt face check-in | Station continues on face alone | **Fail**, then Pass after fix |

**Summary: 26 of 29 passed on first execution.** The three failures - TC14,
TC25 and TC29 - were defects in the system rather than in the test definitions.
All three were corrected and re-executed successfully; the failures, their
causes and their resolutions are reported in Section 5.6.1 rather than being
removed from the record.

## APPENDIX F — Recovered Device Interface

The vendor supplied a 32-bit Windows library with no header or specification.
The interface below was recovered by systematic probing (Chapter 5, §5.2.3) and
is published here because it appears in no vendor documentation.

**Rule:** every Windows export takes the Android signature plus a leading
device-context pointer.

```
Android :  Function(nAddr, ...)
Windows :  Function(void* context, nAddr, ...)
```

| Call | Signature | Verified result |
|---|---|---|
| Open | `ZAZOpenDeviceEx(int* ppCtx, type=2, com=1, baud=57600, pkt=2, dev=0)` | 0 = success; ppCtx receives context |
| Enumerate | `ZAZGetUDiskNum(char* letters)` | Returns count; writes ASCII drive letters |
| Capture | `ZAZGetImage(ctx, 0xFFFFFFFF)` | `0x02` = no finger |
| Count | `ZAZTemplateNum(ctx, 0xFFFFFFFF, int* n)` | 0, n = template count |
| Info | `ZAZReadInfoPage(ctx, 0xFFFFFFFF, buf)` | 0; product string |
| Search | `ZAZHighSpeedSearch(ctx, addr, buf, start, count, int* pageId, int* score)` | **Two** out-pointers, not one array |

**Undocumented return code.** The search functions return `0x47` when no match
exists, alongside the documented `0x09`. This code appears in no published
documentation for the protocol family and was established by observation.

## APPENDIX G — Biometric Consent Form

*Reproduced as presented to participants before enrolment. Enrolment could not
proceed in the system until all three consent statements were recorded.*

---

**BIOMETRIC ENROLMENT — INFORMED CONSENT**

Northcrest General Hospital · Staff Attendance System

**What is being collected.** Two kinds of biometric data:

1. **Fingerprint.** A mathematical template derived from the ridge pattern of up
   to four fingers. The fingerprint image itself is not stored, and the template
   cannot be used to reconstruct your fingerprint.
2. **Facial representation.** A set of 512 numbers derived from five photographs
   of your face. The photographs are not stored, and the numbers cannot be used
   to reconstruct your face.

**Why it is being collected.** To identify you when you record your arrival at
and departure from a shift, and for no other purpose.

**Who can see it.** No one. Biometric records are not readable by supervisors,
by administrators, or through any screen in the system. They are used only by
the automated comparison that runs when you present at a check-in station.

**How long it is kept.** Until you leave employment or withdraw consent,
whichever is sooner. On either event the template and the representation are
deleted.

**Your rights.** You may decline to enrol. You may withdraw consent at any time
by writing to the Human Resources Officer, without giving a reason and without
consequence to your employment. If you withdraw, your biometric data is deleted
and your attendance is recorded by the procedure in place before this system.

**Please initial each statement:**

| | Statement | Initial |
|---|---|---|
| 1 | I have read and understood the above, and have had the opportunity to ask questions. | |
| 2 | I consent to the collection and storage of my fingerprint template for attendance purposes. | |
| 3 | I consent to the collection and storage of my facial representation for attendance purposes. | |

Name: ......................................  Staff number: ....................

Signature: ................................  Date: ..............................

Enrolling officer: ........................  Date: ..............................

---

## APPENDIX H — Observation Form

*Completed by the researcher during each enrolment and each trial session, to
record the characteristics not captured by the system log.*

---

**STRUCTURED OBSERVATION RECORD**

Participant code: P.......   Session: 1 / 2   Date: ..............

**Enrolment**

| Item | Record |
|---|---|
| Time enrolment began | |
| Time enrolment completed | |
| Total duration | |
| Fingers attempted before an acceptable template | |
| Fingerprint captures rejected for quality | |
| Facial captures rejected for liveness or angle | |
| Enrolment completed? | Yes / No — if No, state which modality failed |

**Presentation trials**

| Trial | Modality | Attempts to success | Outcome | Notes |
|---|---|---|---|---|
| 1 | Fingerprint / Face | | Accepted / Refused / Ambiguous | |
| 2 | Fingerprint / Face | | Accepted / Refused / Ambiguous | |
| … | | | | |

**Points of difficulty** — tick each observed, and note the trial number:

| | Observation | Trial(s) |
|---|---|---|
| | Participant unsure where to place the finger | |
| | Participant unsure where to look | |
| | Participant moved before capture completed | |
| | Participant required verbal instruction | |
| | Participant repeated a presentation without being asked to | |
| | Participant expressed uncertainty about the outcome shown | |

**Free notes:**

................................................................................

................................................................................

---

## APPENDIX I — Questionnaire

*Administered to each participant after they had used the system. Items adapted
from Davis (1989); responses on a five-point Likert scale where 1 = strongly
disagree and 5 = strongly agree.*

---

**STAFF ATTENDANCE SYSTEM — USER QUESTIONNAIRE**

Participant code: P.......   Date: ..............

**Section A — Perceived Usefulness**

| | Statement | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| PU1 | Using this system would make recording my attendance quicker. | | | | | |
| PU2 | Using this system would make my attendance record more accurate. | | | | | |
| PU3 | This system would make it harder for someone to record attendance in my name. | | | | | |
| PU4 | I would find this system useful in my work. | | | | | |
| PU5 | Being able to check my own attendance record at the station is valuable to me. | | | | | |

**Section B — Perceived Ease of Use**

| | Statement | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| PE1 | Learning to use this system was easy for me. | | | | | |
| PE2 | It was clear what I was being asked to do at each step. | | | | | |
| PE3 | Checking in by fingerprint required no effort. | | | | | |
| PE4 | Checking in by face required no effort. | | | | | |
| PE5 | I found it easy to understand the result the station showed me. | | | | | |

**Section C — Open response**

1. What, if anything, did you find difficult or unclear?

................................................................................

2. Would you have any concern about your fingerprint or facial data being held
   for this purpose? If so, what?

................................................................................

3. Anything else you would change?

................................................................................

Thank you for taking part.
