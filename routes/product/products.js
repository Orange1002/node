import express from 'express'
import tryAuth from '../../middlewares/tryAuth.js'
import favoriteRouter from './favorite.js'
import path from 'path'
import fs from 'fs/promises'
import multer from 'multer'
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
import { upload } from '../../middlewares/multer.js'
import prisma from '../../lib/prisma.js'

// 商品列表 (支援分頁、篩選、排序)
// /api/products
router.get('/', tryAuth, async (req, res) => {
  const memberId = req.member?.id || null

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
    const products = await getProducts(
      page,
      perPage,
      conditions,
      sortBy,
      memberId
    )
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

// 取得所有子分類
router.get('/subcategories', async (req, res) => {
  try {
    const subcategories = await prisma.productSubcategory.findMany()
    successResponse(res, { subcategories })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 取得所有變體類別
router.get('/variant-types', async (req, res) => {
  try {
    const variantTypes = await prisma.productVariantType.findMany()
    successResponse(res, { variantTypes })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 取得所有變體選項
router.get('/variant-options', async (req, res) => {
  try {
    const variantOptions = await prisma.productVariantOption.findMany()
    successResponse(res, { variantOptions })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 商品詳情 /api/products/:productId
router.get('/:productId', tryAuth, async (req, res) => {
  const productId = Number(req.params.productId)
  const memberId = req.member?.id || null

  try {
    const product = await getProductById(productId, memberId)
    successResponse(res, { product })
  } catch (error) {
    errorResponse(res, error)
  }
})

router.use('/favorite', favoriteRouter)

// 新增商品
router.post(
  '/',
  (req, res, next) => {
    upload.array('images', 6)(req, res, function (err) {
      if (err instanceof multer.MulterError || err) {
        return res.status(400).json({ error: err.message || '上傳圖片錯誤' })
      }
      next()
    })
  },
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        brand_id,
        category_id,
        subcategory_id,
        variants,
      } = req.body

      if (!name || !price || !brand_id || !category_id) {
        return res.status(400).json({ error: '缺少必要欄位' })
      }

      const imageFiles = req.files
      if (!imageFiles.length) {
        return res.status(400).json({ error: '缺少圖片' })
      }

      const newProduct = await prisma.product.create({
        data: {
          name,
          description,
          price: Number(price),
          brand_id: Number(brand_id),
          category_id: Number(category_id),
          subcategory_id: Number(subcategory_id) || null,
          valid: true,
        },
      })

      const sn = `PRD${String(newProduct.id).padStart(4, '0')}`
      await prisma.product.update({
        where: { id: newProduct.id },
        data: { sn },
      })

      const imageData = await Promise.all(
        imageFiles.map(async (file, index) => {
          const ext = path.extname(file.originalname)
          const newFilename = `product${newProduct.id}-${index + 1}${ext}`
          const newPath = path.join(file.destination, newFilename)

          await fs.rename(file.path, newPath)

          return {
            image: `/uploads/${newFilename}`,
            is_primary: index === 0,
          }
        })
      )

      await prisma.productImage.createMany({
        data: imageData.map((img) => ({
          ...img,
          productId: newProduct.id,
        })),
      })

      let variantList = []
      try {
        variantList = JSON.parse(variants)
        if (!Array.isArray(variantList)) throw new Error()
      } catch {
        return res
          .status(400)
          .json({ error: 'variants 格式錯誤，需為 JSON 陣列字串' })
      }

      for (let i = 0; i < variantList.length; i++) {
        const v = variantList[i]
        const combination = await prisma.productVariantCombination.create({
          data: {
            productId: newProduct.id,
            sku: `${sn}-${i + 1}`, // 自動產生 SKU，如 PRD0001-1、PRD0001-2
            price: Number(v.price) || 0,
            stock: Number(v.stock),
          },
        })

        await prisma.productVariantCombinationOption.createMany({
          data: Object.values(v.optionIds).map((optionId) => ({
            combinationId: combination.id,
            optionId,
          })),
        })
      }

      return res.status(201).json({ productId: newProduct.id })
    } catch (error) {
      console.error('新增商品失敗', error)
      return res.status(500).json({ error: '新增商品失敗' })
    }
  }
)
export default router
