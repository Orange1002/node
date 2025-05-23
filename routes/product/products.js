import express from 'express'
const router = express.Router()

// 導入服務層的函式
import {
  getProducts,
  getProductById,
  getProductsCount,
  getBrands,
  getCategories,
} from '../../services/product.js'

// 導入回應函式
import { successResponse, errorResponse } from '../../lib/utils.js'

// 商品列表 (支援分頁、篩選、排序)
// /api/products
router.get('/', async (req, res) => {
  const type = req.query.type || 'all'
  const page = Number(req.query.page) || 1
  const perPage = Number(req.query.perpage) || 10

  const nameLike = req.query.name_like || ''
  const brandIds = req.query.brand_ids
    ? req.query.brand_ids.split(',').map(Number)
    : []
  const categoryIds = req.query.category_ids
    ? req.query.category_ids.split(',').map(Number)
    : []

  const subcategoryIds = req.query.subcategory_ids
    ? req.query.subcategory_ids.split(',').map(Number)
    : []

  const priceGte = Number(req.query.price_gte) || undefined
  const priceLte = Number(req.query.price_lte) || undefined

  const conditions = {
    nameLike,
    brandIds,
    categoryIds,
    subcategoryIds,
    priceGte,
    priceLte,
  }

  const sort = req.query.sort || 'id'
  const order = req.query.order || 'asc'
  const sortBy = { sort, order }

  try {
    const products = await getProducts(page, perPage, conditions, sortBy)
    const productCount = await getProductsCount(conditions)

    let data = {
      total: productCount,
      pageCount: Math.ceil(productCount / perPage),
      page,
      perPage,
      products,
    }

    if (type === 'count') {
      data = {
        total: productCount,
        pageCount: Math.ceil(productCount / perPage),
        page,
        perPage,
      }
    }

    if (type === 'data') {
      data = { products }
    }

    successResponse(res, data)
  } catch (error) {
    errorResponse(res, error)
  }
})

// 取得所有品牌
router.get('/brands', async (req, res) => {
  try {
    const brands = await getBrands()
    successResponse(res, { brands })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 取得所有分類
router.get('/categories', async (req, res) => {
  try {
    const categories = await getCategories() // ✅ 修正這裡名稱
    successResponse(res, { categories })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 商品詳情 /api/products/:productId
router.get('/:productId', async (req, res) => {
  const productId = Number(req.params.productId)

  try {
    const product = await getProductById(productId)
    successResponse(res, { product })
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
