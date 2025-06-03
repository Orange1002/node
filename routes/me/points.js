import express from 'express'
import prisma from '../../lib/prisma.js'
import authenticateMember from '../../middlewares/Auth.js'

const router = express.Router()

// ✅ 查詢會員點數總和 + 點數紀錄
router.get('/', authenticateMember, async (req, res) => {
  try {
    const memberId = req.member.id

    // 取得有效點數總和（尚未過期）
    const totalPoints = await prisma.point.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        memberId,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    // 取得所有點數紀錄（含已過期）
    const history = await prisma.point.findMany({
      where: { memberId },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json({
      total: totalPoints._sum.amount || 0,
      history,
    })
  } catch (err) {
    console.error('❌ 取得點數資料失敗', err)
    res.status(500).json({ error: '取得點數資料失敗' })
  }
})

export default router
