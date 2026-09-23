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
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
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

  it('supports full CCI Profile and Category CRUD operations', async () => {
    let insertedRows: any[] = []
    let updatedPayload: any = null
    let deletedTable = ''

    const mockFrom = vi.fn((table: string) => ({
      insert: vi.fn((rows: any[]) => {
        insertedRows = rows
        return {
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: 'created-id', ...rows[0] },
                error: null,
              }),
            ),
          })),
        }
      }),
      update: vi.fn((payload: any) => {
        updatedPayload = payload
        return {
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { id: 'updated-id', ...payload },
                  error: null,
                }),
              ),
            })),
          })),
        }
      }),
      delete: vi.fn(() => {
        deletedTable = table
        return {
          eq: vi.fn(() => Promise.resolve({ error: null })),
        }
      }),
      upsert: vi.fn((rows: any[]) => ({
        select: vi.fn(() => ({
          order: vi.fn(() =>
            Promise.resolve({
              data: rows.map((r, i) => ({ id: `cat-${i}`, ...r })),
              error: null,
            }),
          ),
        })),
      })),
    }))

    vi.spyOn(supabaseLib, 'getSupabase').mockReturnValue({
      from: mockFrom,
    } as any)

    const {
      createCciProfile,
      updateCciProfile,
      deleteCciProfile,
      createCciCategory,
      updateCciCategory,
      deleteCciCategory,
      batchSaveCciCategories,
    } = await import('./test-packages')

    // Create profile
    const profileRes = await createCciProfile({
      organizationId: 'org-1',
      name: 'Ecommerce 7-Session Ample',
      versionLabel: 'v1',
    })
    expect(profileRes.ok).toBe(true)
    expect(insertedRows[0]?.name).toBe('Ecommerce 7-Session Ample')

    // Update profile
    const updateRes = await updateCciProfile('prof-1', { name: 'Renamed Profile' })
    expect(updateRes.ok).toBe(true)
    expect(updatedPayload?.name).toBe('Renamed Profile')

    // Delete profile
    const deleteRes = await deleteCciProfile('prof-1')
    expect(deleteRes.ok).toBe(true)
    expect(deletedTable).toBe('cci_profiles')

    // Create category (Ample)
    const catRes = await createCciCategory({
      profileId: 'prof-1',
      categoryOrder: 1,
      label: 'Session 1 Ample',
      value: 6.0,
    })
    expect(catRes.ok).toBe(true)
    expect(insertedRows[0]?.value).toBe(6.0)

    // Update category
    const updateCatRes = await updateCciCategory('cat-1', { label: 'Updated Ample', value: 8.0 })
    expect(updateCatRes.ok).toBe(true)
    expect(updatedPayload?.value).toBe(8.0)

    // Delete category
    const deleteCatRes = await deleteCciCategory('cat-1')
    expect(deleteCatRes.ok).toBe(true)
    expect(deletedTable).toBe('cci_categories')

    // Batch save categories
    const batchRes = await batchSaveCciCategories('prof-1', [
      { categoryOrder: 1, label: 'S1', value: 6.0 },
      { categoryOrder: 2, label: 'S2', value: 6.0 },
      { categoryOrder: 3, label: 'S3', value: 4.0 },
    ])
    expect(batchRes.ok).toBe(true)
    if (batchRes.ok) {
      expect(batchRes.data).toHaveLength(3)
    }
  })
})


