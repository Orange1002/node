import prisma from '../lib/prisma.js'
import { z } from 'zod'
import { validatedParamId, safeParseBindSchema } from '../lib/utils.js'

// 驗證格式 schema
const productSchema = {}
productSchema.conditions = z.object({
  nameLike: z.string().optional(),
  brandIds: z.array(z.number()).optional(),
  categoryIds: z.array(z.number()).optional(),
  priceGte: z.number().optional(),
  priceLte: z.number().optional(),
})
productSchema.sortBy = z.object({
  sort: z.enum(['id', 'name', 'price']),
  order: z.enum(['asc', 'desc']),
})
const productSchemaValidator = safeParseBindSchema(productSchema)

// 建立 where 條件
const generateWhere = (conditions) => {
  productSchemaValidator({ conditions })
  const where = { valid: true }

  if (conditions.nameLike) {
    where.name = { contains: conditions.nameLike }
  }
  if (conditions.brandIds?.length) {
    where.brand_id = { in: conditions.brandIds }
  }
  if (conditions.categoryIds?.length) {
    where.category_id = { in: conditions.categoryIds }
  }
  if (conditions.subcategoryIds?.length) {
    where.subcategory_id = { in: conditions.subcategoryIds }
  }
  if (conditions.priceGte) {
    where.price = { gte: conditions.priceGte }
  }
  if (conditions.priceLte) {
    where.price = where.price
      ? { ...where.price, lte: conditions.priceLte }
      : { lte: conditions.priceLte }
  }

  return where
}

// ✅ 商品總數
export const getProductsCount = async (conditions = {}) => {
  const where = generateWhere(conditions)
  return await prisma.product.count({ where })
}

// ✅ 商品列表
export const getProducts = async (
  page = 1,
  perPage = 12,
  conditions = {},
  sortBy = { sort: 'id', order: 'desc' }
) => {
  validatedParamId(page)
  validatedParamId(perPage)
  productSchemaValidator({ sortBy })

  const where = generateWhere(conditions)

  // 【第 1 部分】先查詢產品清單
  const products = await prisma.product.findMany({
    where,
    orderBy: { [sortBy.sort]: sortBy.order },
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      brand: true,
      productCategory: true,
      product_images: {
        where: { is_primary: true },
        select: { image: true },
      },
    },
  })

  // 【第 2 部分】查詢每個商品的平均評分與總筆數
  const ratingResults = await prisma.productReview.groupBy({
    by: ['productId'],
    _avg: { rating: true },
    _count: { rating: true },
  })

  // 【第 3 部分】把評分對應到產品
  const ratingMap = new Map()
  ratingResults.forEach((r) => {
    ratingMap.set(r.productId, {
      avg: Number(r._avg.rating?.toFixed(1)) || 0,
      count: r._count.rating || 0,
    })
  })

  // 【第 4 部分】把結果加進 products 陣列
  products.forEach((p) => {
    const rating = ratingMap.get(p.id) || { avg: 0, count: 0 }
    p.rating = rating
  })

  return products
}

export const getProductById = async (productId) => {
  validatedParamId(productId)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      productCategory: true,
      product_images: {
        orderBy: { is_primary: 'desc' },
        select: { image: true, is_primary: true },
      },
      product_specifications: {
        orderBy: { sort_order: 'asc' },
        select: { title: true, value: true },
      },
      product_variants: true,
      product_tag_map: {
        include: {
          productTag: true,
        },
      },
    },
  })

  if (!product) throw new Error('商品不存在')

  // 轉換 tag 結構
  product.tags = product.product_tag_map.map((m) => m.productTag.name)
  delete product.product_tag_map

  // ✅ 查詢平均評分
  const ratingResult = await prisma.productReview.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  })

  product.rating = {
    avg: Number(ratingResult._avg.rating?.toFixed(1)) || 0,
    count: ratingResult._count.rating || 0,
  }

  // ✅ 查詢收藏次數（favorites）
  const favoriteCount = await prisma.productFavorite.count({
    where: { product_id: productId },
  })

  product.favoriteCount = favoriteCount

  return product
}

// ✅ 品牌
export const getBrands = async () => {
  return await prisma.brand.findMany()
}

// ✅ 分類
export const getCategories = async () => {
  return await prisma.productCategory.findMany()
}
