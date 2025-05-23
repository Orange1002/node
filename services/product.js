import prisma from '../lib/prisma.js'
import { z } from 'zod'

import { validatedParamId, safeParseBindSchema } from '../lib/utils.js'

// #region 建立驗證格式用函式
// 建立商品資料的驗證用的schema物件
const productSchema = {}
// 條件的驗証用的schema
productSchema.conditions = z.object({
  nameLike: z.string().optional(),
  brandIds: z.array(z.number()).optional(),
  categoryIds: z.array(z.number()).optional(),
  priceGte: z.number().optional(),
  priceLte: z.number().optional(),
})
// 排序的驗証用的schema
productSchema.sortBy = z.object({
  sort: z.enum(['id', 'name', 'price']),
  order: z.enum(['asc', 'desc']),
})

// 綁定驗證用的schema的檢查函式
const productSchemaValidator = safeParseBindSchema(productSchema)
// #endregion

const generateWhere = (conditions) => {
  // 檢查從前端來的資料是否符合格式，注意要傳入與檢查schema同名的物件值，例如{ conditions: conditions }，前者為物件的key，會比對schema物件中的檢查格式，後者為要檢查物件的值
  productSchemaValidator({ conditions })

  const where = {}
  // 如果有傳入nameLike參數，就加入where物件
  if (conditions.nameLike) {
    where.name = { contains: conditions.nameLike }
  }

  // 如果有傳入brandIds參數(陣列中有資料)，就加入where物件(brandsId in [1, 2, 3])
  if (conditions.brandIds.length) {
    where.brandId = { in: conditions.brandIds }
  }

  // 如果有傳入categoryIds參數(陣列中有資料)，就加入where物件(categoryId in [1, 2, 3])
  if (conditions.categoryIds.length) {
    where.categoryId = { in: conditions.categoryIds }
  }

  if (conditions.priceGte) {
    where.price = { gte: conditions.priceGte }
  }

  // 如果已經有where.price物件，就加入where.price.lte物件
  if (conditions.priceLte) {
    where.price = where.price
      ? { ...where.price, lte: conditions.priceLte }
      : { lte: conditions.priceLte }
  }

  return where
}

// 取得商品總筆數
export const getProductsCount = async (conditions = {}) => {
  const where = generateWhere(conditions)

  // 回傳總筆數
  return await prisma.product.count({ where })
}

// 取得所有商品資料
export const getProducts = async (
  page = 1,
  perPage = 10,
  conditions = {},
  sortBy
) => {
  // 驗證參數是否為正整數
  validatedParamId(page)
  validatedParamId(perPage)

  const where = generateWhere(conditions)

  console.log(where)

  // 檢查從前端來的資料是否符合格式，注意要傳入與檢查schema同名的物件值，例如{ sortBy: sortBy }，前者為物件的key，會比對schema物件中的檢查格式，後者為要檢查物件的值
  productSchemaValidator({ sortBy })

  const orderBy = {
    [sortBy.sort]: sortBy.order,
  }

  // 包含關聯資料
  return await prisma.product.findMany({
    where,
    orderBy,
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      category: true,
      brand: true,
    },
  })
}

// 取得單筆商品資料
export const getProductById = async (productId) => {
  // 驗證參數是否為正整數
  validatedParamId(productId)

  const product = await prisma.product.findUnique({
    where: {
      id: productId,
    },
    include: {
      category: true,
      brand: true,
    },
  })

  if (!product) {
    throw new Error('資料不存在')
  }

  return product
}

// 取得所有品牌資料
export const getBrands = async () => {
  return await prisma.brand.findMany()
}

// 取得所有分類資料
export const getCatetories = async () => {
  return await prisma.category.findMany()
}
