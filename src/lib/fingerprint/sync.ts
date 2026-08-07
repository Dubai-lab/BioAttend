import { supabase } from '@/lib/supabase'
import { bridge } from '@/lib/fingerprint/bridge'

/**
 * Reader synchronisation.
 *
 * Fingerprint templates can only be matched by the module's own firmware, so
 * 1:N identification requires the templates to physically live in the reader's
 * flash. Supabase is the system of record; flash is a cache rebuilt from it.
 *
 * That is what makes a dead reader a non-event: plug in a replacement, sync,
 * and it knows every staff member again. Nothing is lost with the hardware.
 *
 * `reader_slots` maps a flash slot number back to a staff member — the module
 * returns a slot from HighSpeedSearch and knows nothing about people.
 */

export interface SyncProgress {
  phase: 'loading' | 'wiping' | 'writing' | 'mapping' | 'done'
  written?: number
  total?: number
}

export interface SyncResult {
  templates: number
  staff: number
  capacity: number
}

export async function syncReader(
  readerId: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  onProgress?.({ phase: 'loading' })

  // Only active staff. A suspended or departed employee must not be able to
  // clock in, and the cheapest way to guarantee that is to leave them out of
  // the reader entirely.
  const { data: templates, error } = await supabase
    .from('fingerprint_templates')
    .select('id, staff_id, template, staff!inner(status)')
    .eq('staff.status', 'active')
    .order('created_at')

  if (error) throw new Error(`Could not load templates: ${error.message}`)
  if (!templates || templates.length === 0) {
    throw new Error('No fingerprint templates to sync. Enrol staff first.')
  }

  const capacity = 1000
  if (templates.length > capacity) {
    throw new Error(
      `${templates.length} templates exceed the reader's ${capacity}-slot capacity. ` +
        'Split staff across readers by department.',
    )
  }

  // Slot numbers are assigned here, deterministically by load order, so the
  // mapping we store is exactly the one written to the device.
  const payload = templates.map((row, index) => ({
    slot: index,
    template: row.template as string,
    templateId: row.id as string,
    staffId: row.staff_id as string,
  }))

  onProgress?.({ phase: 'wiping' })
  onProgress?.({ phase: 'writing', written: 0, total: payload.length })

  // The bridge wipes flash and writes every template in one call — a partial
  // write would leave the slot map lying about what is on the device.
  await bridge.sync(payload.map(({ slot, template }) => ({ slot, template })))

  onProgress?.({ phase: 'mapping', written: payload.length, total: payload.length })

  // Replace the whole map rather than diffing it. The device was just wiped,
  // so any surviving row would point at a slot that no longer holds it.
  const { error: clearError } = await supabase
    .from('reader_slots')
    .delete()
    .eq('reader_id', readerId)

  if (clearError) throw new Error(`Could not clear the slot map: ${clearError.message}`)

  const { error: mapError } = await supabase.from('reader_slots').insert(
    payload.map((item) => ({
      reader_id: readerId,
      slot_id: item.slot,
      template_id: item.templateId,
      staff_id: item.staffId,
    })),
  )

  if (mapError) {
    throw new Error(
      `Templates were written to the reader, but the slot map failed to save: ` +
        `${mapError.message}. Run the sync again — identification will not work until it succeeds.`,
    )
  }

  await supabase
    .from('readers')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', readerId)

  onProgress?.({ phase: 'done', written: payload.length, total: payload.length })

  return {
    templates: payload.length,
    staff: new Set(payload.map((item) => item.staffId)).size,
    capacity,
  }
}

/** Turn a flash slot returned by the reader back into a staff member. */
export async function staffForSlot(readerId: string, slot: number) {
  const { data, error } = await supabase
    .from('reader_slots')
    .select('staff_id')
    .eq('reader_id', readerId)
    .eq('slot_id', slot)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.staff_id ?? null
}
