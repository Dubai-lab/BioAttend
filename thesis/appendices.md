# APPENDICES

> Placed after the References. Most universities exclude appendices from the
> page limit — confirm with your supervisor, since this document relies on
> that to keep the body within length.

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

## APPENDIX C — Use Cases

| ID | Use case | Primary actor |
|---|---|---|
| UC1 | Enrol staff member | Administrator |
| UC2 | Capture fingerprint | Administrator |
| UC3 | Capture face | Administrator |
| UC4 | Synchronise reader | Administrator |
| UC5 | Assign shift | Supervisor / Administrator |
| UC6 | Check in by fingerprint | Staff member |
| UC7 | Check in by face | Staff member |
| UC8 | Verify by staff number and face | Staff member |
| UC9 | Check out | Staff member |
| UC10 | View live attendance | Supervisor / Administrator |
| UC11 | Approve exception | Supervisor / Administrator |
| UC12 | Export records | Supervisor / Administrator |
| UC13 | Manage console users | Administrator |
| UC14 | Register check-in station | Administrator |
| UC15 | Configure thresholds and windows | Administrator |

### C.1 Use case specification — UC6: Check in by fingerprint

| Field | Description |
|---|---|
| Actor | Staff member |
| Precondition | Staff enrolled and active; templates synchronised; station registered; services running |
| Trigger | Staff member places a finger on the sensor |
| Main flow | 1. Station captures the image. 2. Service extracts features and searches the device library. 3. Device returns a storage slot and match score. 4. Station resolves the slot to a staff member. 5. Station submits the event with its credential. 6. Server verifies the credential. 7. Server resolves the shift for the current moment. 8. Server evaluates the time against the check-in window. 9. Server records the check-in with its classification. 10. Station displays the outcome and clears. |
| Alternative — no match | Proceed to UC7 (face) |
| Alternative — outside window | Refused; attempt recorded; station states when the window opens |
| Alternative — no roster entry | Recorded and flagged as unscheduled |
| Alternative — inactive staff | Refused; attempt recorded |
| Postcondition | An attendance record exists, or a refused attempt is logged |

## APPENDIX D — Database Schema

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

### D.1 Design notes

**Attendance as a single row per shift date.** Check-in and check-out are
columns on one row with a uniqueness constraint on (staff member, shift date).
"Already checked in today" is therefore a property of the schema rather than a
query result.

**Attempts separated from records.** `attendance_attempts` records every scan
including refusals. It provides evidence when a staff member disputes that the
system failed them, and constitutes the dataset from which the accuracy figures
in Chapter Five are computed — refused attempts appear nowhere else and are
precisely what a false rejection rate is calculated from.

**Slot mapping as a rebuildable cache.** The device stores a limited number of
templates internally and returns a slot number on a match. Because the database
holds the authoritative templates, a failed device is replaced by
synchronising a new one; no biometric data is lost with the hardware.

## APPENDIX E — Access Control Matrix

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

Two aspects merit note. Supervisors have no access to biometric records at all:
they require attendance data, which does not require access to templates or
embeddings. The check-in station cannot read biometric records either — it
holds only the public API key, and facial matching is performed by a
server-side function that receives a freshly computed embedding and returns a
decision, so a compromised station discloses nothing.

## APPENDIX F — Functional Test Cases

| ID | Req. | Test case | Expected | Result |
|---|---|---|---|---|
| TC1 | FR1 | Create staff with valid details | Record created, number assigned | |
| TC2 | FR2 | Attempt capture before consent recorded | Capture controls disabled | |
| TC3 | FR4 | Present a poor-quality fingerprint | Capture rejected, not stored | |
| TC4 | FR6 | Request a head position and hold head straight | Capture refused with guidance | |
| TC5 | FR7 | Present a printed photograph | Rejected as not live | |
| TC6 | FR7 | Present a photograph on a phone screen | Rejected as not live | |
| TC7 | FR9 | Deactivate staff, then present their finger | Attendance refused | |
| TC8 | FR11 | Assign two shifts to one person on one date | Second replaces first | |
| TC9 | FR12 | Present enrolled finger within check-in window | Check-in recorded, on time | |
| TC10 | FR13 | Present unenrolled finger, then a face | Falls through to face path | |
| TC11 | FR14 | Present the face of one of two similar individuals | Refused as ambiguous | |
| TC12 | FR15 | Enter staff number and present face | Verified and recorded | |
| TC13 | FR16 | Present finger before the window opens | Refused, opening time shown | |
| TC14 | FR17 | Present finger during check-out window | Check-out recorded | |
| TC15 | FR18 | Present finger between windows | Refused, attempt logged | |
| TC16 | FR19 | Check in after the grace period | Recorded, flagged for approval | |
| TC17 | FR19 | Check in with no roster entry | Recorded, flagged unscheduled | |
| TC18 | FR20 | Inspect attempt log after a refusal | Refusal present with score and reason | |
| TC19 | FR21 | Call attendance function with invalid credential | Rejected | |
| TC20 | FR21 | Call attendance function with no credential | Rejected | |
| TC21 | FR23 | Approve a flagged record | Approval recorded; times unchanged | |
| TC22 | FR24 | Export attendance and attempts | Files produced with expected columns | |
| TC23 | FR25 | Create a supervisor for one department | Account created; role assigned | |
| TC24 | NFR5 | Supervisor attempts to read biometric records | No rows returned | |
| TC25 | NFR5 | Supervisor requests another department's staff | No rows returned | |
| TC26 | NFR6 | Attempt direct insert into attendance table | Permission denied | |
| TC27 | FR29 | Synchronise reader, identify newly enrolled staff | Identified successfully | |
| TC28 | NFR12 | Clear device library and re-synchronise | All active staff restored | |
| TC29 | NFR4 | Stop the fingerprint service, attempt face check-in | Station continues on face alone | |

> **[TO COMPLETE]** — Execute each case and record the result.

## APPENDIX G — Recovered Device Interface

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

## APPENDIX H — Consent Form

> **[TO COMPLETE]** — Reproduce the blank biometric consent form used during
> enrolment.

## APPENDIX I — Observation Form

> **[TO COMPLETE]** — Reproduce the structured observation form used to record
> enrolment duration, attempts per success, and points of difficulty.

## APPENDIX J — Questionnaire

> **[TO COMPLETE]** — Reproduce the TAM-based questionnaire measuring perceived
> usefulness and perceived ease of use.
