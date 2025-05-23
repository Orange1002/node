import express from 'express'
import { createSitterBooking } from '../controllers/sitterBookingController.js'
import { getUserDogs } from '../controllers/getUserDogs.js'
import db from '../config/mysql.js'
import authenticate from '../middlewares/authenticate.js'

const router = express.Router()

// ✅ 取得會員的狗狗列表
router.get('/dogs', authenticate, getUserDogs)

// ✅ 新增狗狗
router.post('/dogs', authenticate, async (req, res) => {
  const memberId = req.member?.id
  const { name } = req.body

  if (!memberId) {
    return res
      .status(401)
      .json({ status: 'error', message: '未登入或授權失敗' })
  }

  if (!name || name.trim() === '') {
    return res
      .status(400)
      .json({ status: 'error', message: '狗狗名字不能空白' })
  }

  try {
    const [result] = await db.query(
      'INSERT INTO dogs (member_id, name) VALUES (?, ?)',
      [memberId, name.trim()]
    )
    res.json({ status: 'success', dogId: result.insertId })
  } catch (err) {
    console.error('新增狗狗失敗:', err)
    res.status(500).json({ status: 'error', message: '新增狗狗失敗' })
  }
})

// ✅ 預約保母服務
router.post('/:sitterId/bookings', authenticate, createSitterBooking)

export default router
