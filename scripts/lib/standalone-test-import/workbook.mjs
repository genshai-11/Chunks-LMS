import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import path from 'node:path'
import readExcelFile from 'read-excel-file/node'

export const REQUIRED_SHEETS = [
  'Chunks-resource - CVR_new',
  'Package-test',
  'CCI',
]

const ITEM_HEADERS = [
  'Material',
  'Session No.',
  'Item_id',
  'CCI-id',
  'CVR-id',
  'Term (Tiếng Việt)',
  'Term (Tiếng Anh)',
  'Complete Sentence (Vie)',
  'Complete Sentence (Eng)',
]
const PACKAGE_HEADERS = ['Package_id', 'Name', 'Description', 'Session list', 'CCI list']
const CCI_HEADERS = ['Session', 'CCI_id', 'CCI Name', 'Ampe (A)', 'Description', 'Category']

function text(value) {
  return value == null ? '' : String(value).trim()
}

function numeric(value) {
  if (value === null || value === undefined || text(value) === '') return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}

function ordinal(value, label) {
  const match = text(value).match(/(\d+)/)
  if (!match) throw new Error(`Could not parse ${label}: ${text(value) || '<blank>'}`)
  return Number(match[1])
}

function sheetRows(sheet, requiredHeaders, issues) {
  if (!sheet) return []
  const rows = sheet.data.filter((row) => row.some((value) => text(value) !== ''))
  if (!rows.length) {
    issues.push({ severity: 'error', code: 'EMPTY_SHEET', message: `${sheet.sheet} is empty`, location: sheet.sheet })
    return []
  }
  const headers = rows[0].map(text)
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      issues.push({ severity: 'error', code: 'MISSING_COLUMN', message: `Missing column ${header}`, location: sheet.sheet })
    }
  }
  return rows.slice(1).map((row, rowIndex) => {
    const object = {}
    headers.forEach((header, columnIndex) => {
      if (header) object[header] = row[columnIndex] ?? null
    })
    object.__row = rowIndex + 2
    return object
  })
}

function issue(issues, severity, code, message, location) {
  issues.push({ severity, code, message, location })
}

export function buildManifest({ sheets, filename, sha256 }) {
  const issues = []
  // Workbook tab names may contain accidental surrounding spaces (the canonical
  // file currently stores `CCI `). Match on trimmed names while retaining the
  // canonical sheet contract in the manifest.
  const byName = new Map(sheets.map((sheet) => {
    const normalizedName = text(sheet.sheet)
    return [normalizedName, { ...sheet, sheet: normalizedName }]
  }))
  for (const name of REQUIRED_SHEETS) {
    if (!byName.has(name)) issue(issues, 'error', 'MISSING_SHEET', `Missing required sheet ${name}`, name)
  }

  const itemRows = sheetRows(byName.get(REQUIRED_SHEETS[0]), ITEM_HEADERS, issues)
  const packageRows = sheetRows(byName.get(REQUIRED_SHEETS[1]), PACKAGE_HEADERS, issues)
  const cciRows = sheetRows(byName.get(REQUIRED_SHEETS[2]), CCI_HEADERS, issues)

  const packages = new Set(packageRows.map((row) => text(row.Package_id)).filter(Boolean))
  if (packages.size !== 1) issue(issues, 'error', 'PACKAGE_COUNT', `Expected one package id, found ${packages.size}`, 'Package-test')
  if (packageRows.length !== 8) issue(issues, 'error', 'PACKAGE_SESSION_COUNT', `Expected 8 package sessions, found ${packageRows.length}`, 'Package-test')
  if (cciRows.length !== 8) issue(issues, 'error', 'CCI_COUNT', `Expected 8 CCI definitions, found ${cciRows.length}`, 'CCI')
  if (itemRows.length !== 80) issue(issues, 'error', 'ITEM_COUNT', `Expected 80 items, found ${itemRows.length}`, REQUIRED_SHEETS[0])

  const cciBySession = new Map()
  const cciIds = new Set()
  for (const row of cciRows) {
    let sessionOrder
    try { sessionOrder = ordinal(row.Session, 'CCI Session') } catch (error) {
      issue(issues, 'error', 'INVALID_SESSION', error.message, `CCI!${row.__row}`)
      continue
    }
    const sourceCciId = text(row.CCI_id)
    const ampe = numeric(row['Ampe (A)'])
    if (!sourceCciId || !/^cci-\d{3}$/.test(sourceCciId)) issue(issues, 'error', 'INVALID_CCI_ID', `Invalid CCI id ${sourceCciId || '<blank>'}`, `CCI!${row.__row}`)
    if (cciIds.has(sourceCciId)) issue(issues, 'error', 'DUPLICATE_CCI_ID', `Duplicate CCI id ${sourceCciId}`, `CCI!${row.__row}`)
    if (!text(row['CCI Name'])) issue(issues, 'error', 'MISSING_CCI_NAME', 'CCI Name is required', `CCI!${row.__row}`)
    if (ampe == null || ampe < 0) issue(issues, 'error', 'INVALID_AMPE', `Invalid Ampe ${text(row['Ampe (A)'])}`, `CCI!${row.__row}`)
    cciIds.add(sourceCciId)
    cciBySession.set(sessionOrder, {
      sessionOrder,
      sourceCciId,
      name: text(row['CCI Name']),
      ampe,
      description: text(row.Description),
      category: ['null', ''].includes(text(row.Category).toLowerCase()) ? null : text(row.Category),
    })
  }

  const packageBySession = new Map()
  for (const row of packageRows) {
    let sessionOrder
    try { sessionOrder = ordinal(row['Session list'], 'Package Session list') } catch (error) {
      issue(issues, 'error', 'INVALID_SESSION', error.message, `Package-test!${row.__row}`)
      continue
    }
    if (packageBySession.has(sessionOrder)) issue(issues, 'error', 'DUPLICATE_PACKAGE_SESSION', `Duplicate package session ${sessionOrder}`, `Package-test!${row.__row}`)
    packageBySession.set(sessionOrder, {
      sessionOrder,
      name: text(row.Name) || `Test ${String(sessionOrder).padStart(2, '0')}`,
      description: text(row.Description),
    })
  }

  const groupedItems = new Map()
  const itemKeys = new Set()
  for (const row of itemRows) {
    let sessionOrder, itemOrder
    try {
      sessionOrder = ordinal(row['Session No.'], 'Item Session No.')
      itemOrder = ordinal(row.Item_id, 'Item id')
    } catch (error) {
      issue(issues, 'error', 'INVALID_ITEM_ORDER', error.message, `${REQUIRED_SHEETS[0]}!${row.__row}`)
      continue
    }
    const key = `${sessionOrder}:${itemOrder}`
    if (itemKeys.has(key)) issue(issues, 'error', 'DUPLICATE_ITEM', `Duplicate item ${key}`, `${REQUIRED_SHEETS[0]}!${row.__row}`)
    itemKeys.add(key)
    const required = [
      ['CCI-id', row['CCI-id']], ['Term (Tiếng Việt)', row['Term (Tiếng Việt)']],
      ['Term (Tiếng Anh)', row['Term (Tiếng Anh)']], ['Complete Sentence (Vie)', row['Complete Sentence (Vie)']],
      ['Complete Sentence (Eng)', row['Complete Sentence (Eng)']],
    ]
    for (const [field, value] of required) if (!text(value)) issue(issues, 'error', 'MISSING_VALUE', `${field} is required`, `${REQUIRED_SHEETS[0]}!${row.__row}`)
    const sourceCvrId = numeric(row['CVR-id'])
    if (sourceCvrId == null || sourceCvrId < 0) issue(issues, 'error', 'INVALID_CVR', `Invalid CVR-id ${text(row['CVR-id'])}`, `${REQUIRED_SHEETS[0]}!${row.__row}`)
    const item = {
      itemOrder,
      sourceItemId: text(row.Item_id),
      sourceMaterial: text(row.Material),
      sourceCciId: text(row['CCI-id']),
      sourceCvrId,
      termVi: text(row['Term (Tiếng Việt)']),
      termEn: text(row['Term (Tiếng Anh)']),
      promptVi: text(row['Complete Sentence (Vie)']),
      promptEn: text(row['Complete Sentence (Eng)']),
    }
    if (!groupedItems.has(sessionOrder)) groupedItems.set(sessionOrder, [])
    groupedItems.get(sessionOrder).push(item)
  }

  const sessions = []
  for (let sessionOrder = 1; sessionOrder <= 8; sessionOrder += 1) {
    const packageSession = packageBySession.get(sessionOrder)
    const cci = cciBySession.get(sessionOrder)
    const items = (groupedItems.get(sessionOrder) ?? []).sort((a, b) => a.itemOrder - b.itemOrder)
    if (!packageSession) issue(issues, 'error', 'MISSING_PACKAGE_SESSION', `Missing package session ${sessionOrder}`, 'Package-test')
    if (!cci) issue(issues, 'error', 'MISSING_CCI_SESSION', `Missing CCI session ${sessionOrder}`, 'CCI')
    if (items.length !== 10) issue(issues, 'error', 'SESSION_ITEM_COUNT', `Session ${sessionOrder} expected 10 items, found ${items.length}`, REQUIRED_SHEETS[0])
    const cvrs = [...new Set(items.map((item) => item.sourceCvrId).filter((value) => value != null))]
    if (cvrs.length !== 1) issue(issues, 'error', 'SESSION_CVR_COUNT', `Session ${sessionOrder} expected one CVR value, found ${cvrs.join(', ') || 'none'}`, REQUIRED_SHEETS[0])
    const targetCvrOhm = cvrs[0] ?? null
    if (cci) {
      for (const item of items) {
        if (item.sourceCciId !== cci.sourceCciId) {
          issue(issues, 'warning', 'ITEM_SESSION_CCI_MISMATCH', `Item ${item.itemOrder} references ${item.sourceCciId}; session uses ${cci.sourceCciId}`, `Session ${sessionOrder} / Item ${item.itemOrder}`)
        }
      }
    }
    const intro = cci ? `Session ${sessionOrder}. CVR ${targetCvrOhm}. CCI ${cci.ampe}. ${cci.name}.` : ''
    sessions.push({
      sessionOrder,
      name: packageSession?.name ?? `Test ${String(sessionOrder).padStart(2, '0')}`,
      description: packageSession?.description ?? '',
      sourceCciId: cci?.sourceCciId ?? '',
      targetCvrOhm,
      introTextVi: intro,
      introTextEn: intro,
      items,
    })
  }

  const firstPackage = packageRows[0] ?? {}
  return {
    source: { filename, sha256, sheets: REQUIRED_SHEETS },
    package: {
      sourcePackageId: text(firstPackage.Package_id) || 'Pre-test',
      title: text(firstPackage.Package_id) || 'Pre-test',
      description: text(firstPackage.Description) || 'Test đầu khóa ERE',
      versionLabel: 'draft-v1',
    },
    cciDefinitions: [...cciBySession.values()].sort((a, b) => a.sessionOrder - b.sessionOrder),
    sessions,
    issues,
  }
}

export async function readCanonicalWorkbook(filePath) {
  const buffer = await fs.readFile(filePath)
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex')
  const sheets = await readExcelFile(buffer)
  return buildManifest({ sheets, filename: path.basename(filePath), sha256 })
}

export function hasErrors(manifest) {
  return manifest.issues.some((candidate) => candidate.severity === 'error')
}
