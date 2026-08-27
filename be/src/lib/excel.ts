import * as XLSX from 'xlsx'

export function rowsToXlsxBuffer(
  sheetName: string,
  rows: Record<string, unknown>[],
  headers?: string[],
): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows, headers ? { header: headers } : undefined)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function xlsxBufferToRows(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]
}

export function sendXlsxDownload(
  res: { setHeader: (k: string, v: string) => void; send: (body: Buffer) => void },
  filename: string,
  buffer: Buffer,
) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}

export function cellString(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function cellNumber(row: Record<string, unknown>, key: string): number | null {
  const raw = cellString(row, key)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
