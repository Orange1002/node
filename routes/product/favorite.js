import express from 'express'
import prisma from '../../lib/prisma.js'
import authenticate from '../../middlewares/Auth.js'
import { successResponse, errorResponse } from '../../lib/utils.js'

const router = express.Router()

// 收藏或取消收藏
router.post('/', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const { productId } = req.body

  if (!productId) {
    return res.status(400).json({ error: '缺少 productId' })
  }

  try {
    const existing = await prisma.productFavorite.findFirst({
      where: { member_id: memberId, product_id: productId },
    })

    if (existing) {
      // 已存在 → 取消收藏
      await prisma.productFavorite.delete({
        where: { id: existing.id },
      })
      return successResponse(res, { favorite: false })
    } else {
      // 尚未收藏 → 加入收藏
      await prisma.productFavorite.create({
        data: { member_id: memberId, product_id: productId },
      })
      return successResponse(res, {
        favorite: true,
        message: '已加入收藏',
      })
    }
  } catch (error) {
    errorResponse(res, error)
  }
})

// 抓取收藏清單
router.get('/', authenticate, async (req, res) => {
  const memberId = req.member?.id

  try {
    const favorites = await prisma.productFavorite.findMany({
      where: { member_id: memberId },
      orderBy: {
        created_at: 'desc',
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            product_images: {
              where: { is_primary: true },
              select: { image: true },
            },
          },
        },
      },
    })

    const data = favorites.map((fav) => ({
      product_id: fav.product.id,
      product_name: fav.product.name,
      product_price: fav.product.price,
      primary_image: fav.product.product_images?.[0]?.image || null,
    }))

    successResponse(res, data)
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
