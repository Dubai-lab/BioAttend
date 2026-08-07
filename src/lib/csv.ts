/**
 * CSV export.
 *
 * Written by hand rather than pulled from a library: the whole job is quoting
 * correctly and triggering a download, and a dependency for that is not worth
 * the bundle.
 */

type Cell = string | number | boolean | null | undefined

/**
 * Quote a value for CSV.
 *
 * Values are prefixed with a quote-safe guard when they could be read as a
 * formula. Excel executes `=`, `+`, `-` and `@` prefixes on open, which turns
 * an exported staff name into a code-execution vector — a real issue for any
 * file a hospital administrator might open.
 */
function escape(value: Cell): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) lines.push(row.map(escape).join(','))
  // CRLF and a BOM so Excel opens UTF-8 correctly on Windows.
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
