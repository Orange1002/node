import express from 'express'
import authenticateMember from '../../middlewares/Auth.js'
import prisma from '../../lib/prisma.js'

const router = express.Router()

router.get('/', authenticateMember, async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.member.id },
      select: { id: true, email: true, username: true },
    })
    res.json(member)
  } catch (err) {
    res.status(500).json({ error: '查詢會員資訊失敗' })
  }
})

export default router
