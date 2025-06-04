import express from 'express'
import prisma from '../../lib/prisma.js'
import authenticate from '../../middlewares/Auth.js'
import { successResponse, errorResponse } from '../../lib/utils.js'

const router = express.Router()

// 新增或更新商品評論
router.post('/', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const { productId, rating, comment } = req.body

  if (!productId || !rating || !comment) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }

  try {
    // 確認會員是否購買過該商品（訂單狀態為已完成）
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          memberId: memberId,
          orderStatusId: 2, // 「已完成」
        },
      },
    })

    if (!hasPurchased) {
      return res.status(403).json({ error: '您尚未購買過此商品，無法評論' })
    }

    const existing = await prisma.productReview.findFirst({
      where: {
        memberId: memberId,
        productId,
      },
    })

    if (existing) {
      // 更新評論
      await prisma.productReview.update({
        where: { id: existing.id },
        data: { rating, comment },
      })
      return successResponse(res, { message: '評論已更新' })
    } else {
      // 新增評論
      await prisma.productReview.create({
        data: {
          productId,
          memberId: memberId,
          rating,
          comment,
        },
      })
      return successResponse(res, { message: '評論成功送出！' })
    }
  } catch (error) {
    errorResponse(res, error)
  }
})

// ✅ 修改評論（需本人）
router.put('/:id', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const reviewId = Number(req.params.id)
  const { rating, comment } = req.body

  if (!rating || !comment) {
    return res.status(400).json({ error: '缺少必要欄位' })
  }

  try {
    const existing = await prisma.productReview.findUnique({
      where: { id: reviewId },
    })

    if (!existing || existing.memberId !== memberId) {
      return res.status(403).json({ error: '您無權修改這筆評論' })
    }

    await prisma.productReview.update({
      where: { id: reviewId },
      data: { rating, comment },
    })

    return successResponse(res, { message: '評論已更新' })
  } catch (error) {
    errorResponse(res, error)
  }
})

// ✅ 確認是否已留言過（供前端判斷）
router.get('/:productId/check', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const productId = Number(req.params.productId)

  try {
    const [review, hasPurchased] = await Promise.all([
      prisma.productReview.findFirst({
        where: {
          productId,
          memberId: memberId,
        },
      }),
      prisma.orderItem.findFirst({
        where: {
          productId,
          order: {
            is: {
              memberId: memberId,
              orderStatusId: 2, // 訂單狀態為已完成
            },
          },
        },
      }),
    ])

    return successResponse(res, {
      hasCommented: !!review,
      hasPurchased: !!hasPurchased,
      review,
    })
  } catch (error) {
    errorResponse(res, error)
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const reviewId = Number(req.params.id)

  try {
    const existing = await prisma.productReview.findUnique({
      where: { id: reviewId },
    })

    if (!existing) {
      return res.status(404).json({ error: '找不到該評論' })
    }

    if (existing.memberId !== memberId) {
      return res.status(403).json({ error: '您無權刪除這筆評論' })
    }

    await prisma.productReview.delete({
      where: { id: reviewId },
    })

    return successResponse(res, { message: '評論已刪除' })
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
