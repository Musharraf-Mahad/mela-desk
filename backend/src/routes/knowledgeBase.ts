import { ArticleStatus, Prisma, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/authenticate.js'

export const knowledgeBaseRouter = Router()

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'article'
  )
}

async function generateUniqueArticleSlug(baseTitle: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(baseTitle)
  let slug = baseSlug
  let count = 1
  while (true) {
    const existing = await prisma.article.findUnique({ where: { slug } })
    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug
    }
    count++
    slug = `${baseSlug}-${count}`
  }
}

async function generateUniqueCategorySlug(baseName: string, excludeId?: string): Promise<string> {
  const baseSlug = slugify(baseName)
  let slug = baseSlug
  let count = 1
  while (true) {
    const existing = await prisma.articleCategory.findUnique({ where: { slug } })
    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug
    }
    count++
    slug = `${baseSlug}-${count}`
  }
}

// --------------------------------------------------------------------------
// Zod Schemas
// --------------------------------------------------------------------------

const publicListArticlesSchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

const feedbackSchema = z.object({
  helpful: z.boolean(),
})

const createArticleSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(255),
  summary: z.string().trim().min(10, 'Summary must be at least 10 characters').max(1000),
  content: z.string().trim().min(10, 'Content must be at least 10 characters'),
  categoryId: z.string().trim().min(1, 'Category is required'),
  departmentId: z.string().trim().nullable().optional(),
  status: z.nativeEnum(ArticleStatus).default(ArticleStatus.draft),
})

const updateArticleSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  summary: z.string().trim().min(10).max(1000).optional(),
  content: z.string().trim().min(10).optional(),
  categoryId: z.string().trim().min(1).optional(),
  departmentId: z.string().trim().nullable().optional(),
  status: z.nativeEnum(ArticleStatus).optional(),
})

const manageListArticlesSchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(ArticleStatus).optional(),
  categoryId: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
})

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
})

// --------------------------------------------------------------------------
// 1. PUBLIC ROUTES
// --------------------------------------------------------------------------

/**
 * GET /api/knowledge-base/categories
 * Returns list of article categories with count of published articles
 */
knowledgeBaseRouter.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.articleCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            articles: {
              where: { status: ArticleStatus.published },
            },
          },
        },
      },
    })

    res.status(200).json({
      success: true,
      data: {
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          createdAt: c.createdAt,
          articleCount: c._count.articles,
        })),
      },
    })
  } catch (error) {
    console.error('Failed to list knowledge base categories:', error)
    res.status(500).json({ success: false, message: 'Unable to retrieve categories' })
  }
})

/**
 * GET /api/knowledge-base/articles
 * Public search and listing of published articles
 */
knowledgeBaseRouter.get('/articles', async (req, res) => {
  const parsed = publicListArticlesSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  const { search, category, departmentId, page, pageSize } = parsed.data
  const skip = (page - 1) * pageSize

  const where: Prisma.ArticleWhereInput = {
    status: ArticleStatus.published,
  }

  if (category) {
    where.category = {
      OR: [{ id: category }, { slug: category }],
    }
  }

  if (departmentId) {
    where.departmentId = departmentId
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { summary: { contains: search } },
      { content: { contains: search } },
    ]
  }

  try {
    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          publishedAt: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          feedback: {
            select: {
              helpful: true,
            },
          },
        },
      }),
    ])

    const formattedArticles = articles.map((art) => {
      const helpfulCount = art.feedback.filter((f) => f.helpful).length
      const notHelpfulCount = art.feedback.filter((f) => !f.helpful).length

      return {
        id: art.id,
        title: art.title,
        slug: art.slug,
        summary: art.summary,
        publishedAt: art.publishedAt || art.createdAt,
        createdAt: art.createdAt,
        category: art.category,
        department: art.department,
        helpfulCount,
        notHelpfulCount,
      }
    })

    res.status(200).json({
      success: true,
      data: {
        articles: formattedArticles,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      },
    })
  } catch (error) {
    console.error('Failed to list public knowledge base articles:', error)
    res.status(500).json({ success: false, message: 'Unable to retrieve articles' })
  }
})

// --------------------------------------------------------------------------
// 2. STAFF MANAGEMENT ROUTES (Mounted before /:slug to avoid route shadowing)
// --------------------------------------------------------------------------

/**
 * GET /api/knowledge-base/manage/articles
 * Staff article management list with full status details and department filtering
 */
knowledgeBaseRouter.get('/manage/articles', authenticate, async (req, res) => {
  const userRole = req.user!.role
  if (userRole === UserRole.customer) {
    res.status(403).json({ success: false, message: 'Access denied' })
    return
  }

  const parsed = manageListArticlesSchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  const { search, status, categoryId, departmentId, page, pageSize } = parsed.data
  const skip = (page - 1) * pageSize

  // Determine user's department for scoped roles
  let userDeptId: string | null = null
  if (userRole === UserRole.department_head || userRole === UserRole.agent) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { departmentId: true },
    })
    userDeptId = user?.departmentId || null
  }

  const where: Prisma.ArticleWhereInput = {}

  if (status) {
    where.status = status
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  // Department scoping:
  // Admin & Head can see all or filter by departmentId
  if (userRole === UserRole.admin || userRole === UserRole.head) {
    if (departmentId !== undefined) {
      where.departmentId = departmentId === '' || departmentId === 'null' ? null : departmentId
    }
  } else {
    // Department Head and Agent see articles in their department OR global articles
    if (userDeptId) {
      where.OR = [{ departmentId: userDeptId }, { departmentId: null }]
    } else {
      where.departmentId = null
    }
  }

  if (search) {
    const searchFilter = [
      { title: { contains: search } },
      { summary: { contains: search } },
      { slug: { contains: search } },
    ]
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchFilter }]
      delete where.OR
    } else {
      where.OR = searchFilter
    }
  }

  try {
    const [total, articles] = await Promise.all([
      prisma.article.count({ where }),
      prisma.article.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          feedback: {
            select: {
              helpful: true,
            },
          },
        },
      }),
    ])

    const formattedArticles = articles.map((art) => ({
      ...art,
      helpfulCount: art.feedback.filter((f) => f.helpful).length,
      notHelpfulCount: art.feedback.filter((f) => !f.helpful).length,
    }))

    res.status(200).json({
      success: true,
      data: {
        articles: formattedArticles,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      },
    })
  } catch (error) {
    console.error('Failed to manage knowledge base articles:', error)
    res.status(500).json({ success: false, message: 'Unable to retrieve articles' })
  }
})

/**
 * POST /api/knowledge-base/articles
 * Create a new knowledge base article
 */
knowledgeBaseRouter.post('/articles', authenticate, async (req, res) => {
  const userRole = req.user!.role

  // Head is strictly read-only; Customers cannot create articles
  if (userRole === UserRole.head || userRole === UserRole.customer) {
    res.status(403).json({ success: false, message: 'Head role has read-only operational oversight.' })
    return
  }

  const parsed = createArticleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid article data',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  const { title, summary, content, categoryId, status } = parsed.data
  let departmentId = parsed.data.departmentId || null

  // Verify category exists
  const categoryExists = await prisma.articleCategory.findUnique({
    where: { id: categoryId },
  })
  if (!categoryExists) {
    res.status(400).json({ success: false, message: 'Specified category does not exist' })
    return
  }

  // Department scoping:
  // Non-admins must only create articles in their assigned department
  if (userRole !== UserRole.admin) {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { departmentId: true },
    })
    const userDeptId = user?.departmentId || null

    if (departmentId && departmentId !== userDeptId) {
      res.status(403).json({
        success: false,
        message: 'Cannot create articles for departments other than your own.',
      })
      return
    }
    departmentId = userDeptId
  }

  try {
    const slug = await generateUniqueArticleSlug(title)
    const publishedAt = status === ArticleStatus.published ? new Date() : null

    const article = await prisma.article.create({
      data: {
        title,
        slug,
        summary,
        content,
        status,
        authorId: req.user!.id,
        categoryId,
        departmentId,
        publishedAt,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        department: {
          select: { id: true, name: true },
        },
        author: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'article.created',
        details: JSON.stringify({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          status: article.status,
          departmentId: article.departmentId,
        }),
      },
    })

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      data: { article },
    })
  } catch (error) {
    console.error('Failed to create article:', error)
    res.status(500).json({ success: false, message: 'Unable to create article' })
  }
})

/**
 * PATCH /api/knowledge-base/articles/:id
 * Edit an existing knowledge base article
 */
knowledgeBaseRouter.patch('/articles/:id', authenticate, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const userRole = req.user!.role

  if (userRole === UserRole.head || userRole === UserRole.customer) {
    res.status(403).json({ success: false, message: 'Head role has read-only operational oversight.' })
    return
  }

  const parsed = updateArticleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid update data',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const existing = await prisma.article.findUnique({
      where: { id },
      include: { author: true },
    })

    if (!existing) {
      res.status(404).json({ success: false, message: 'Article not found' })
      return
    }

    // Role-based permission checks:
    // Admin can edit anything.
    // Department Head can edit articles within their department.
    // Agent can edit articles within their department or articles they authored.
    if (userRole !== UserRole.admin) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { departmentId: true },
      })
      const userDeptId = user?.departmentId || null

      const isSameDept = existing.departmentId && existing.departmentId === userDeptId
      const isAuthor = existing.authorId === req.user!.id

      if (!isSameDept && !isAuthor) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to edit articles outside your department.',
        })
        return
      }

      // If updating departmentId, cannot reassign outside own department
      if (parsed.data.departmentId !== undefined && parsed.data.departmentId !== userDeptId) {
        res.status(403).json({
          success: false,
          message: 'Cannot reassign articles to another department.',
        })
        return
      }
    }

    // If category is changing, verify new category exists
    if (parsed.data.categoryId) {
      const catExists = await prisma.articleCategory.findUnique({
        where: { id: parsed.data.categoryId },
      })
      if (!catExists) {
        res.status(400).json({ success: false, message: 'Specified category does not exist' })
        return
      }
    }

    // Handle slug update if title changed
    let slug = existing.slug
    if (parsed.data.title && parsed.data.title !== existing.title) {
      slug = await generateUniqueArticleSlug(parsed.data.title, existing.id)
    }

    // Handle publishedAt
    let publishedAt = existing.publishedAt
    if (parsed.data.status === ArticleStatus.published && !existing.publishedAt) {
      publishedAt = new Date()
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title, slug } : {}),
        ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
        ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
        ...(parsed.data.categoryId !== undefined ? { categoryId: parsed.data.categoryId } : {}),
        ...(parsed.data.departmentId !== undefined ? { departmentId: parsed.data.departmentId } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status, publishedAt } : {}),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        department: {
          select: { id: true, name: true },
        },
        author: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'article.updated',
        details: JSON.stringify({
          articleId: updated.id,
          title: updated.title,
          status: updated.status,
          updatedFields: Object.keys(parsed.data),
        }),
      },
    })

    res.status(200).json({
      success: true,
      message: 'Article updated successfully',
      data: { article: updated },
    })
  } catch (error) {
    console.error('Failed to update article:', error)
    res.status(500).json({ success: false, message: 'Unable to update article' })
  }
})

/**
 * DELETE /api/knowledge-base/articles/:id
 * Delete or archive an article safely
 */
knowledgeBaseRouter.delete('/articles/:id', authenticate, async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
  const userRole = req.user!.role
  const permanent = req.query.permanent === 'true'

  if (userRole === UserRole.head || userRole === UserRole.customer || userRole === UserRole.agent) {
    res.status(403).json({ success: false, message: 'Permission denied to delete articles' })
    return
  }

  try {
    const existing = await prisma.article.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ success: false, message: 'Article not found' })
      return
    }

    if (userRole === UserRole.department_head) {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { departmentId: true },
      })
      if (!existing.departmentId || existing.departmentId !== user?.departmentId) {
        res.status(403).json({
          success: false,
          message: 'You can only delete articles belonging to your department',
        })
        return
      }
    }

    if (permanent && userRole === UserRole.admin) {
      await prisma.article.delete({ where: { id } })
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'article.deleted',
          details: JSON.stringify({ articleId: id, title: existing.title, permanent: true }),
        },
      })
      res.status(200).json({ success: true, message: 'Article permanently deleted' })
    } else {
      await prisma.article.update({
        where: { id },
        data: { status: ArticleStatus.archived },
      })
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'article.archived',
          details: JSON.stringify({ articleId: id, title: existing.title }),
        },
      })
      res.status(200).json({ success: true, message: 'Article safely archived' })
    }
  } catch (error) {
    console.error('Failed to delete/archive article:', error)
    res.status(500).json({ success: false, message: 'Unable to delete article' })
  }
})

/**
 * POST /api/knowledge-base/categories
 * Create an article category (Admin only)
 */
knowledgeBaseRouter.post(
  '/categories',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const parsed = createCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid category data',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    const { name, description } = parsed.data

    try {
      const existingName = await prisma.articleCategory.findUnique({ where: { name } })
      if (existingName) {
        res.status(400).json({ success: false, message: 'A category with this name already exists' })
        return
      }

      const slug = await generateUniqueCategorySlug(name)
      const category = await prisma.articleCategory.create({
        data: {
          name,
          slug,
          description: description || null,
        },
      })

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: { category },
      })
    } catch (error) {
      console.error('Failed to create category:', error)
      res.status(500).json({ success: false, message: 'Unable to create category' })
    }
  },
)

/**
 * PATCH /api/knowledge-base/categories/:id
 * Update an article category (Admin only)
 */
knowledgeBaseRouter.patch(
  '/categories/:id',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

    const parsed = updateCategorySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid update data',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const existing = await prisma.articleCategory.findUnique({ where: { id } })
      if (!existing) {
        res.status(404).json({ success: false, message: 'Category not found' })
        return
      }

      let slug = existing.slug
      if (parsed.data.name && parsed.data.name !== existing.name) {
        const nameCollision = await prisma.articleCategory.findUnique({
          where: { name: parsed.data.name },
        })
        if (nameCollision && nameCollision.id !== id) {
          res.status(400).json({ success: false, message: 'Category name already taken' })
          return
        }
        slug = await generateUniqueCategorySlug(parsed.data.name, id)
      }

      const updated = await prisma.articleCategory.update({
        where: { id },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name, slug } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        },
      })

      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: { category: updated },
      })
    } catch (error) {
      console.error('Failed to update category:', error)
      res.status(500).json({ success: false, message: 'Unable to update category' })
    }
  },
)

// --------------------------------------------------------------------------
// 3. PUBLIC ARTICLE DETAILS & FEEDBACK
// --------------------------------------------------------------------------

/**
 * GET /api/knowledge-base/articles/:slug
 * Public view of a single published article by slug
 */
knowledgeBaseRouter.get('/articles/:slug', async (req, res) => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug

  try {
    const article = await prisma.article.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        author: {
          select: {
            name: true,
          },
        },
        feedback: {
          select: {
            helpful: true,
          },
        },
      },
    })

    // Strict security requirement: Drafts and archived articles must NEVER be exposed publicly
    if (!article || article.status !== ArticleStatus.published) {
      res.status(404).json({ success: false, message: 'Article not found' })
      return
    }

    const helpfulCount = article.feedback.filter((f) => f.helpful).length
    const notHelpfulCount = article.feedback.filter((f) => !f.helpful).length

    res.status(200).json({
      success: true,
      data: {
        article: {
          id: article.id,
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          content: article.content,
          status: article.status,
          publishedAt: article.publishedAt || article.createdAt,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
          authorName: article.author.name,
          category: article.category,
          department: article.department,
          helpfulCount,
          notHelpfulCount,
        },
      },
    })
  } catch (error) {
    console.error('Failed to get public knowledge base article:', error)
    res.status(500).json({ success: false, message: 'Unable to retrieve article' })
  }
})

/**
 * POST /api/knowledge-base/articles/:id/feedback
 * Submit public helpful/not-helpful feedback for a published article
 */
knowledgeBaseRouter.post('/articles/:id/feedback', async (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id

  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid feedback data. "helpful" boolean is required.',
    })
    return
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!article || article.status !== ArticleStatus.published) {
      res.status(404).json({ success: false, message: 'Article not found or not published' })
      return
    }

    await prisma.articleFeedback.create({
      data: {
        articleId: article.id,
        helpful: parsed.data.helpful,
      },
    })

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback!',
    })
  } catch (error) {
    console.error('Failed to submit article feedback:', error)
    res.status(500).json({ success: false, message: 'Unable to record feedback' })
  }
})
