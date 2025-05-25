import express from 'express'
import prisma from '../../lib/prisma.js'
import authenticate from '../../middlewares/member-upload.js'
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

export default router
