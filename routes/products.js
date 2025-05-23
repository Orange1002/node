import express from 'express'
const router = express.Router()

// 導入服務層的函式
import {
  getProducts,
  getProductById,
  getProductsCount,
  getBrands,
  getCatetories,
} from '../services/product.js'
// 導入回應函式
import { successResponse, errorResponse } from '../lib/utils.js'

// 得到所有商品資料
// 網址: /api/products
router.get('/', async (req, res) => {
  // type=count，就不需要取得資料
  // type=data，就需要取得資料
  const type = req.query.type || 'all'

  const page = Number(req.query.page) || 1
  const perPage = Number(req.query.perpage) || 10

  const nameLike = req.query.name_like || ''
  const brandIds = req.query.brand_ids
    ? req.query.brand_ids.split(',').map((id) => Number(id))
    : []
  const categoryIds = req.query.category_ids
    ? req.query.category_ids.split(',').map((id) => Number(id))
    : []

  const priceGte = Number(req.query.price_gte) || 0
  const priceLte = Number(req.query.price_lte) || 100000

  const conditions = { nameLike, brandIds, categoryIds, priceGte, priceLte }

  // 排序條件欄位，預設為id遞增，可選擇id,name與price
  const sort = req.query.sort || 'id'
  // 預設為遞增，可選擇asc與desc (注意: 這裡的asc與desc是字串)
  const order = req.query.order || 'asc'
  const sortBy = { sort, order }

  console.log(conditions)

  try {
    // 需要加上await等待取得資料
    const products = await getProducts(page, perPage, conditions, sortBy)
    const productCount = await getProductsCount(conditions)

    // type=all or 空字串，就回傳全部資料
    let data = {
      total: productCount,
      pageCount: Math.ceil(productCount / perPage),
      page,
      perPage,
      products,
    }

    // type=count，就回傳總筆數
    if (type === 'count') {
      data = {
        total: productCount,
        pageCount: Math.ceil(productCount / perPage),
        page,
        perPage,
      }
    }

    // type=data，就回傳products資料
    if (type === 'data') {
      data = { products }
    }

    successResponse(res, data)
  } catch (error) {
    errorResponse(res, error)
  }
})

router.get('/brands', async (req, res) => {
  try {
    const brands = await getBrands()
    successResponse(res, { brands })
  } catch (error) {
    errorResponse(res, error)
  }
})

router.get('/categories', async (req, res) => {
  try {
    const categories = await getCatetories()
    successResponse(res, { categories })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 得到單筆資料(注意，網址有動態參數時要寫在GET區段最後面)
// 網址: /api/products/:productId
router.get('/:productId', async (req, res) => {
  // 需要轉換成數字
  const productId = Number(req.params.productId)

  try {
    // 需要加上await等待取得資料
    const product = await getProductById(productId)
    successResponse(res, { product })
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
