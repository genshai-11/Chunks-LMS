import crypto from 'node:crypto'

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function manifestSha256(manifest) {
  return crypto.createHash('sha256').update(stableJson(manifest)).digest('hex')
}

export function summary(manifest) {
  return {
    sourceSha256: manifest.source.sha256,
    manifestSha256: manifestSha256(manifest),
    packages: 1,
    sessions: manifest.sessions.length,
    items: manifest.sessions.reduce((count, session) => count + session.items.length, 0),
    errors: manifest.issues.filter((issue) => issue.severity === 'error').length,
    warnings: manifest.issues.filter((issue) => issue.severity === 'warning').length,
    measurements: manifest.sessions.map((session) => {
      const cci = manifest.cciDefinitions.find((candidate) => candidate.sourceCciId === session.sourceCciId)
      return {
        session: session.sessionOrder,
        cvr: session.targetCvrOhm,
        cciId: session.sourceCciId,
        cciName: cci?.name ?? null,
        ampe: cci?.ampe ?? null,
        cpd: cci && session.targetCvrOhm != null ? session.targetCvrOhm * cci.ampe : null,
      }
    }),
  }
}

export function previewSql(manifest) {
  const json = JSON.stringify(manifest).replaceAll('$manifest$', '$manifest_escape$')
  return `-- GENERATED REVIEW ARTIFACT — preview only, never a second seed/apply path.\n` +
    `-- Source SHA-256: ${manifest.source.sha256}\n` +
    `select public.preview_test_catalog_replacement(\n` +
    `  '${manifest.source.sha256}',\n` +
    `  $manifest$${json}$manifest$::jsonb\n` +
    `);\n`
}
