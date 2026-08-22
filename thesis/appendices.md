# APPENDICES

> Placed after the References.

---

## APPENDIX A — Recovered Device Programming Interface

The fingerprint module was supplied with a 32-bit Windows library but no header,
specification or documentation. The interface below was recovered by systematic
probing (Section 5.2.2) and is reproduced here because it appears in no vendor
or published source.

**The rule.** Every Windows export takes the signature published for the
manufacturer's other-platform binding, plus a leading device-context pointer
obtained from the open call:

```text
Other platform :  Function(nAddr, ...)
Windows        :  Function(void* context, nAddr, ...)
```

**Verified calls.** Each was confirmed against live hardware.

| Call | Signature | Verified result |
|---|---|---|
| Open | `ZAZOpenDeviceEx(int* ppCtx, type=2, com=1, baud=57600, pkt=2, dev=0)` | `0` = success; `ppCtx` receives the context |
| Enumerate | `ZAZGetUDiskNum(char* letters)` | Returns the count and writes ASCII drive letters |
| Capture | `ZAZGetImage(ctx, 0xFFFFFFFF)` | `0x02` = no finger present |
| Count | `ZAZTemplateNum(ctx, 0xFFFFFFFF, int* n)` | `0`; `n` receives the stored template count |
| Info | `ZAZReadInfoPage(ctx, 0xFFFFFFFF, buf)` | `0`; `buf` receives the product string |
| Search | `ZAZHighSpeedSearch(ctx, addr, buf, start, count, int* pageId, int* score)` | **Two** output pointers, not the single array the other binding declared |

**Undocumented return code.** The search functions return `0x47` when the
library holds no match, alongside the documented `0x09`. This code appears in no
published documentation for the protocol family and was established by
observation. Both must be treated as "not found"; a system that does not will
surface an ordinary non-match to the user as a device fault.

**Diagnostic method.** The signatures were established by classifying access
violations rather than by guesswork. **A fault while *writing* indicates a
missing output pointer** — the function was given a value where it expected a
buffer to write into. **A fault while *reading* indicates an argument that is
dereferenced** — a pointer was expected where a number was passed. Applying that
rule across five probes resolved the whole interface.

---

## APPENDIX B — Attendance Recording Function (extract)

`record_attendance()` is the only path by which an attendance record can be
created; no browser-facing role holds insert permission on the table
(Section 4.4.2). The extract below is the shift-resolution block, where the two
rules the system rests on are enforced.

```sql
-- Find the shift this scan belongs to.
--
-- Yesterday is searched as well as today, because a night shift that began
-- at 23:00 yesterday is still running at 06:00 today. Tomorrow is searched
-- because a shift's check-in window can open before midnight.
for v_assignment in
  select sa.*, sh.starts_at, sh.ends_at, sh.crosses_midnight,
         sh.checkin_opens_before_min,  sh.checkin_grace_after_min,
         sh.checkout_opens_before_min, sh.checkout_closes_after_min
    from public.shift_assignments sa
    join public.shifts sh on sh.id = sa.shift_id
   where sa.staff_id = p_staff_id
     and sa.shift_date between v_local_date - 1 and v_local_date + 1
   order by sa.shift_date
loop
  v_shift_start := (v_assignment.shift_date + v_assignment.starts_at)
                     at time zone v_tz;
  v_shift_end   := (v_assignment.shift_date + v_assignment.ends_at
                     + (case when v_assignment.crosses_midnight
                             then interval '1 day' else interval '0' end)
                   ) at time zone v_tz;

  v_checkin_open   := v_shift_start - make_interval(mins => v_assignment.checkin_opens_before_min);
  v_checkin_close  := v_shift_start + make_interval(mins => v_assignment.checkin_grace_after_min);
  v_checkout_open  := v_shift_end   - make_interval(mins => v_assignment.checkout_opens_before_min);
  v_checkout_close := v_shift_end   + make_interval(mins => v_assignment.checkout_closes_after_min);

  -- The scan falls inside this shift's span: this is the one.
  --
  -- The explicit flag matters. A bare `exit when` would leave v_assignment
  -- holding the LAST row when nothing matched, and an off-shift scan would
  -- then be attributed to a shift the staff member is not working.
  if v_now between v_checkin_open and v_checkout_close then
    v_matched := true;
    exit;
  end if;
end loop;
```

**Three things this extract shows.**

**The shift date is not the calendar date.** Every record is filed under
`shift_date`, the date the shift began, taken from the roster assignment rather
than from the moment of the scan. Without this, a night shift running 23:00 to
07:00 splits across two days and no report over it is correct.

**The search spans three days, not one.** A scan at 06:00 belongs to a shift
that began the previous evening; a scan at 22:45 may belong to one starting at
23:00. Searching only the current date would refuse both.

**Windows are computed, not assumed.** The four boundaries are derived from each
shift's own configuration, so the system's state at any moment is a property of
the roster rather than of the order in which people happen to present. A scan
falling between the windows is refused and logged, not silently treated as the
next expected event.

Every path through the function — including every refusal — writes a row to
`attendance_attempts`. Refused attempts appear nowhere else, and the false
rejection rate reported in Section 5.6.1 cannot be computed without them.
