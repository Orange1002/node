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
  sort: z.enum([
    'id',
    'name',
    'price',
    'created_at',
    'updated_at',
    'review_count',
    'avg_rating',
    'favorite_count',
  ]),
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
  sortBy = { sort: 'id', order: 'desc' },
  memberId = null
) => {
  validatedParamId(page)
  validatedParamId(perPage)
  productSchemaValidator({ sortBy })

  const where = generateWhere(conditions)

  // 【第 1 部分】先查詢產品清單
  let products = []

  const prismaSortableFields = [
    'id',
    'name',
    'price',
    'created_at',
    'updated_at',
  ]

  if (prismaSortableFields.includes(sortBy.sort)) {
    products = await prisma.product.findMany({
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
  } else {
    products = await prisma.product.findMany({
      where,
      include: {
        brand: true,
        productCategory: true,
        product_images: {
          where: { is_primary: true },
          select: { image: true },
        },
      },
    })
  }

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

  if (memberId) {
    const memberFavorites = await prisma.productFavorite.findMany({
      where: { member_id: memberId },
      select: { product_id: true },
    })
    const favoriteIds = memberFavorites.map((f) => f.product_id)

    products.forEach((p) => {
      p.isFavorite = favoriteIds.includes(p.id)
    })
  } else {
    products.forEach((p) => {
      p.isFavorite = false
    })
  }

  products.forEach((p) => {
    const rating = ratingMap.get(p.id) || { avg: 0, count: 0 }
    p.rating = rating
  })

  const favoriteCounts = await prisma.productFavorite.groupBy({
    by: ['product_id'],
    _count: { product_id: true },
  })

  const favoriteMap = new Map()
  favoriteCounts.forEach((f) => {
    favoriteMap.set(f.product_id, f._count.product_id || 0)
  })

  products.forEach((p) => {
    p.favoriteCount = favoriteMap.get(p.id) || 0
  })

  if (!prismaSortableFields.includes(sortBy.sort)) {
    if (sortBy.sort === 'review_count') {
      products.sort((a, b) =>
        sortBy.order === 'asc'
          ? a.rating.count - b.rating.count
          : b.rating.count - a.rating.count
      )
    } else if (sortBy.sort === 'avg_rating') {
      products.sort((a, b) =>
        sortBy.order === 'asc'
          ? a.rating.avg - b.rating.avg
          : b.rating.avg - a.rating.avg
      )
    } else if (sortBy.sort === 'favorite_count') {
      products.sort((a, b) =>
        sortBy.order === 'asc'
          ? a.favoriteCount - b.favoriteCount
          : b.favoriteCount - a.favoriteCount
      )
    }

    // JS 排序後做 slice 分頁
    products = products.slice((page - 1) * perPage, page * perPage)
  }

  return products
}

export const getProductById = async (productId, memberId = null) => {
  validatedParamId(productId)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      brand: true,
      productCategory: true,
      subcategory: true,
      product_images: {
        orderBy: { is_primary: 'desc' },
        select: { image: true, is_primary: true },
      },
      product_specifications: {
        orderBy: { sort_order: 'asc' },
        select: { title: true, value: true },
      },
      product_tag_map: {
        include: {
          productTag: true,
        },
      },
    },
  })

  if (!product) throw new Error('商品不存在')

  // ✅ 確認是否已被該會員收藏
  if (memberId) {
    const favorite = await prisma.productFavorite.findFirst({
      where: {
        member_id: memberId,
        product_id: productId,
      },
    })
    product.isFavorite = !!favorite
  } else {
    product.isFavorite = false
  }

  // ✅ 整理 tags
  product.tags = product.product_tag_map.map((m) => m.productTag.name)
  delete product.product_tag_map

  // ✅ 查詢評價
  const ratingResult = await prisma.productReview.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: { rating: true },
  })
  product.rating = {
    avg: Number(ratingResult._avg.rating?.toFixed(1)) || 0,
    count: ratingResult._count.rating || 0,
  }

  const reviews = await prisma.productReview.findMany({
    where: { productId },
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      rating: true,
      comment: true,
      created_at: true,
      memberId: true,
      member: {
        select: {
          username: true,
        },
      },
    },
  })
  product.reviews = reviews

  // ✅ 查詢收藏次數
  const favoriteCount = await prisma.productFavorite.count({
    where: { product_id: productId },
  })
  product.favoriteCount = favoriteCount

  // ✅ 查詢所有變體組合與選項
  const variantCombinations = await prisma.productVariantCombination.findMany({
    where: { productId },
    include: {
      options: {
        include: {
          option: {
            include: {
              type: true,
            },
          },
        },
      },
    },
  })

  // ✅ 整理變體類型與選項
  const variantMap = new Map()
  variantCombinations.forEach((comb) => {
    comb.options.forEach(({ option }) => {
      const typeId = option.type.id
      if (!variantMap.has(typeId)) {
        variantMap.set(typeId, {
          id: typeId,
          name: option.type.name,
          options: new Map(),
        })
      }
      variantMap.get(typeId).options.set(option.id, option.name)
    })
  })

  product.variantTypes = Array.from(variantMap.values()).map((v) => ({
    id: v.id,
    name: v.name,
    options: Array.from(v.options).map(([id, name]) => ({ id, name })),
  }))

  product.variantCombinations = variantCombinations.map((comb) => ({
    id: comb.id,
    sku: comb.sku,
    price: comb.price,
    stock: comb.stock,
    optionIds: comb.options.map((o) => o.optionId),
  }))

  const now = new Date()

  // 查找對應 category 的優惠券
  const categoryCoupons = await prisma.coupon.findMany({
    where: {
      enabled: true,
      startAt: { lte: now },
      endAt: { gte: now },
      categoryCouponMap: {
        some: {
          categoryId: product.category_id,
        },
      },
    },
    select: {
      id: true,
      title: true,
      discountType: true,
      discountValue: true,
      minPurchase: true,
    },
  })

  // 查找對應 subcategory 的優惠券
  const subcategoryCoupons = await prisma.coupon.findMany({
    where: {
      enabled: true,
      startAt: { lte: now },
      endAt: { gte: now },
      subcategoryCouponMap: {
        some: {
          subcategoryId: product.subcategory_id,
        },
      },
    },
    select: {
      id: true,
      title: true,
      discountType: true,
      discountValue: true,
      minPurchase: true,
    },
  })

  // 合併兩者，去除重複 coupon id
  const allCouponsMap = new Map()
  categoryCoupons.concat(subcategoryCoupons).forEach((coupon) => {
    allCouponsMap.set(coupon.id, coupon)
  })
  product.coupons = Array.from(allCouponsMap.values())

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

