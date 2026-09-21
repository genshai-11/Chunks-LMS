import { describe, expect, it, vi } from 'vitest'
import { deleteTestPackage, updateTestPackageMetadata } from './test-packages'
import * as supabaseLib from './supabase'

describe('test-packages CRUD helpers', () => {
  it('deleteTestPackage cascade-deletes versions and package', async () => {
    const deleteQueries: string[] = []

    const mockFrom = vi.fn((table: string) => {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [{ id: 'ver-1' }], error: null })),
        })),
        delete: vi.fn(() => {
          deleteQueries.push(table)
          return {
            in: vi.fn(() => Promise.resolve({ error: null })),
            eq: vi.fn(() => Promise.resolve({ error: null })),
          }
        }),
      }
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      from: mockFrom,
    } as any)

    await deleteTestPackage('pkg-123')

    expect(deleteQueries).toContain('narration_variants')
    expect(deleteQueries).toContain('test_items')
    expect(deleteQueries).toContain('section_measurement_snapshots')
    expect(deleteQueries).toContain('test_sections')
    expect(deleteQueries).toContain('test_package_versions')
    expect(deleteQueries).toContain('test_packages')
  })

  it('updateTestPackageMetadata updates title and description', async () => {
    let updatedPayload: any = null

    const mockFrom = vi.fn((_table: string) => {
      return {
        update: vi.fn((payload: any) => {
          updatedPayload = payload
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          }
        }),
      }
    })

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      from: mockFrom,
    } as any)

    await updateTestPackageMetadata('pkg-123', {
      title: 'New Title',
      slug: 'new-title',
      description: 'New Description',
    })

    expect(updatedPayload).not.toBeNull()
    expect(updatedPayload.title).toBe('New Title')
    expect(updatedPayload.slug).toBe('new-title')
    expect(updatedPayload.description).toBe('New Description')
  })
})
