import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { ArticleStatus, UserRole } from '@prisma/client'

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    articleCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    articleFeedback: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  return { prismaMock }
})

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

import app from '../src/app.js'

describe('Knowledge Base API (Phase 4)', () => {
  let server: Server
  let baseUrl: string

  const adminUser = {
    id: 'user-admin-1',
    role: UserRole.admin,
    name: 'Admin User',
    departmentId: null,
  }

  const deptHeadUser = {
    id: 'user-dept-head-1',
    role: UserRole.department_head,
    name: 'Dept Head User',
    departmentId: 'dept-tech-1',
  }

  const headUser = {
    id: 'user-head-1',
    role: UserRole.head,
    name: 'Executive Head',
    departmentId: null,
  }

  const customerUser = {
    id: 'user-cust-1',
    role: UserRole.customer,
    name: 'Customer User',
    departmentId: null,
  }

  const sampleCategory = {
    id: 'cat-1',
    name: 'General Help',
    slug: 'general-help',
    description: 'General support guides',
    createdAt: new Date(),
    _count: { articles: 2 },
  }

  const samplePublishedArticle = {
    id: 'art-pub-1',
    title: 'How to Reset Your Password',
    slug: 'how-to-reset-your-password',
    summary: 'Simple steps to reset your portal password.',
    content: 'Step 1: Go to login. Step 2: Click forgot password.',
    status: ArticleStatus.published,
    authorId: adminUser.id,
    categoryId: sampleCategory.id,
    departmentId: null,
    publishedAt: new Date('2026-11-01T10:00:00Z'),
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T10:00:00Z'),
    author: { name: 'Admin User', role: UserRole.admin },
    category: { id: sampleCategory.id, name: sampleCategory.name, slug: sampleCategory.slug },
    department: null,
    feedback: [{ helpful: true }, { helpful: true }, { helpful: false }],
  }

  const sampleDraftArticle = {
    id: 'art-draft-1',
    title: 'Internal Secret Draft',
    slug: 'internal-secret-draft',
    summary: 'Internal documentation only.',
    content: 'Do not expose publicly.',
    status: ArticleStatus.draft,
    authorId: adminUser.id,
    categoryId: sampleCategory.id,
    departmentId: 'dept-tech-1',
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { name: 'Admin User', role: UserRole.admin },
    category: { id: sampleCategory.id, name: sampleCategory.name, slug: sampleCategory.slug },
    department: { id: 'dept-tech-1', name: 'Technical Support' },
    feedback: [],
  }

  beforeEach(async () => {
    vi.resetAllMocks()

    server = app.listen(0)
    await once(server, 'listening')
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterEach(async () => {
    if (server) {
      server.close()
      await once(server, 'close')
    }
  })

  function mockSession(user: any) {
    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60000),
      user: {
        id: user.id,
        role: user.role,
      },
    })
    prismaMock.user.findUnique.mockResolvedValue(user)
  }

  describe('1. Public Categories & Articles', () => {
    it('GET /api/knowledge-base/categories returns published counts', async () => {
      prismaMock.articleCategory.findMany.mockResolvedValue([sampleCategory])

      const res = await fetch(`${baseUrl}/api/knowledge-base/categories`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.categories.length).toBe(1)
      expect(data.data.categories[0].name).toBe('General Help')
      expect(data.data.categories[0].articleCount).toBe(2)
    })

    it('GET /api/knowledge-base/articles returns published articles with pagination', async () => {
      prismaMock.article.count.mockResolvedValue(1)
      prismaMock.article.findMany.mockResolvedValue([samplePublishedArticle])

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles?page=1&pageSize=10`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.articles.length).toBe(1)
      expect(data.data.articles[0].slug).toBe('how-to-reset-your-password')
      expect(data.data.articles[0].helpfulCount).toBe(2)
      expect(data.data.articles[0].notHelpfulCount).toBe(1)
      expect(data.data.pagination.total).toBe(1)
    })

    it('GET /api/knowledge-base/articles/:slug returns published article details', async () => {
      prismaMock.article.findUnique.mockResolvedValue(samplePublishedArticle)

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles/how-to-reset-your-password`)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.article.title).toBe('How to Reset Your Password')
      expect(data.data.article.content).toContain('Step 1: Go to login')
      expect(data.data.article.helpfulCount).toBe(2)
    })

    it('GET /api/knowledge-base/articles/:slug returns 404 for draft or archived articles', async () => {
      // Draft article lookup
      prismaMock.article.findUnique.mockResolvedValue(sampleDraftArticle)

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles/internal-secret-draft`)
      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.message).toBe('Article not found')
    })

    it('POST /api/knowledge-base/articles/:id/feedback records feedback for published article', async () => {
      prismaMock.article.findUnique.mockResolvedValue({ id: 'art-pub-1', status: ArticleStatus.published })
      prismaMock.articleFeedback.create.mockResolvedValue({ id: 'fb-1', articleId: 'art-pub-1', helpful: true })

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles/art-pub-1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful: true }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(prismaMock.articleFeedback.create).toHaveBeenCalledWith({
        data: { articleId: 'art-pub-1', helpful: true },
      })
    })

    it('POST /api/knowledge-base/articles/:id/feedback rejects feedback on draft articles', async () => {
      prismaMock.article.findUnique.mockResolvedValue({ id: 'art-draft-1', status: ArticleStatus.draft })

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles/art-draft-1/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful: true }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('2. Staff Article Management & Permissions', () => {
    it('allows Admin to create an article across departments and records audit log', async () => {
      mockSession(adminUser)
      prismaMock.articleCategory.findUnique.mockResolvedValue(sampleCategory)
      prismaMock.article.findUnique.mockResolvedValue(null) // for unique slug check
      prismaMock.article.create.mockResolvedValue({
        ...samplePublishedArticle,
        id: 'new-art-1',
        title: 'New Guide',
        slug: 'new-guide',
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' })

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'mela_desk_session=valid-token',
        },
        body: JSON.stringify({
          title: 'New Guide',
          summary: 'A comprehensive new guide summary.',
          content: 'Here is the detailed content for the new guide.',
          categoryId: sampleCategory.id,
          status: 'published',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'article.created',
          }),
        }),
      )
    })

    it('enforces Department Head scoping and prevents cross-department assignment', async () => {
      mockSession(deptHeadUser)
      prismaMock.articleCategory.findUnique.mockResolvedValue(sampleCategory)

      // Dept Head tries to create article for other department (dept-billing)
      const res = await fetch(`${baseUrl}/api/knowledge-base/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'mela_desk_session=valid-token',
        },
        body: JSON.stringify({
          title: 'Billing Troubleshooting Guide',
          summary: 'Summary for billing department.',
          content: 'Billing content.',
          categoryId: sampleCategory.id,
          departmentId: 'dept-billing-2',
        }),
      })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.message).toContain('departments other than your own')
    })

    it('strictly enforces Head role as read-only (rejects creation with 403)', async () => {
      mockSession(headUser)

      const res = await fetch(`${baseUrl}/api/knowledge-base/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'mela_desk_session=valid-token',
        },
        body: JSON.stringify({
          title: 'Executive Guide',
          summary: 'Summary of guide.',
          content: 'Content of guide.',
          categoryId: sampleCategory.id,
        }),
      })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.message).toContain('read-only')
    })

    it('allows Head to view manage list across all departments', async () => {
      mockSession(headUser)
      prismaMock.article.count.mockResolvedValue(1)
      prismaMock.article.findMany.mockResolvedValue([sampleDraftArticle])

      const res = await fetch(`${baseUrl}/api/knowledge-base/manage/articles`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.articles.length).toBe(1)
    })

    it('denies customers from accessing staff manage endpoints', async () => {
      mockSession(customerUser)

      const res = await fetch(`${baseUrl}/api/knowledge-base/manage/articles`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })

      expect(res.status).toBe(403)
    })

    it('allows Admin to safely archive or permanently delete an article', async () => {
      mockSession(adminUser)
      prismaMock.article.findUnique.mockResolvedValue(samplePublishedArticle)
      prismaMock.article.update.mockResolvedValue({
        ...samplePublishedArticle,
        status: ArticleStatus.archived,
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'log-archived' })

      // Soft archive
      const resArchive = await fetch(`${baseUrl}/api/knowledge-base/articles/art-pub-1`, {
        method: 'DELETE',
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })

      expect(resArchive.status).toBe(200)
      expect(prismaMock.article.update).toHaveBeenCalledWith({
        where: { id: 'art-pub-1' },
        data: { status: ArticleStatus.archived },
      })

      // Permanent delete
      prismaMock.article.delete.mockResolvedValue(samplePublishedArticle)
      const resDelete = await fetch(`${baseUrl}/api/knowledge-base/articles/art-pub-1?permanent=true`, {
        method: 'DELETE',
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })

      expect(resDelete.status).toBe(200)
      expect(prismaMock.article.delete).toHaveBeenCalledWith({
        where: { id: 'art-pub-1' },
      })
    })

    it('restricts category creation to Admin role', async () => {
      // Admin -> Allowed
      mockSession(adminUser)
      prismaMock.articleCategory.findUnique.mockResolvedValue(null)
      prismaMock.articleCategory.create.mockResolvedValue({
        id: 'cat-new-1',
        name: 'Account Setup',
        slug: 'account-setup',
        description: null,
      })

      const resAdmin = await fetch(`${baseUrl}/api/knowledge-base/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'mela_desk_session=valid-token',
        },
        body: JSON.stringify({ name: 'Account Setup' }),
      })
      expect(resAdmin.status).toBe(201)

      // Dept Head -> Forbidden (Admin only)
      mockSession(deptHeadUser)
      const resDeptHead = await fetch(`${baseUrl}/api/knowledge-base/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'mela_desk_session=valid-token',
        },
        body: JSON.stringify({ name: 'Security Category' }),
      })
      expect(resDeptHead.status).toBe(403)
    })
  })
})
