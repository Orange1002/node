import express from 'express'
import db from '../config/mysql.js'
import authenticate from '../middlewares/authenticate.js'

const router = express.Router()

// ✅ 取得使用者的所有通知
router.get('/', authenticate, async (req, res) => {
  const userId = req.member.id
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE member_id = ? ORDER BY created_at DESC',
      [userId]
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// ✅ 將所有通知標記為已讀
router.post('/read-all', authenticate, async (req, res) => {
  const userId = req.member.id
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE member_id = ?',
      [userId]
    )
    res.json({ message: '所有通知已標記為已讀' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// ✅ 新增通知並回傳完整資料
router.post('/', authenticate, async (req, res) => {
  const userId = req.member.id
  const { message } = req.body

  if (!message || message.trim() === '') {
    return res.status(400).json({ message: '通知內容不可為空' })
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO notifications (member_id, content, is_read, created_at) VALUES (?, ?, FALSE, NOW())',
      [userId, message]
    )

    // 回傳該筆通知資料（供前端 setNotifications 用）
    res.status(201).json({
      id: result.insertId,
      member_id: userId,
      content: message,
      is_read: false,
      created_at: new Date(), // JS 產生的時間（可考慮查 DB）
    })
  } catch (err) {
    console.error('❌ 建立通知失敗:', err)
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' })
  }
})

// ✅ 將單筆通知標記為已讀
router.post('/read/:id', authenticate, async (req, res) => {
  const userId = req.member.id
  const notificationId = req.params.id

  try {
    const [result] = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND member_id = ?',
      [notificationId, userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '通知不存在或無權限' })
    }

    res.json({ message: '已標記為已讀' })
  } catch (err) {
    console.error('❌ 單筆已讀失敗:', err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
