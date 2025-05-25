import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'

const router = express.Router()

// ✅ 新增收件人
// ✅ 新增收件人（限制最多 5 個）
router.post('/', authenticate, async (req, res) => {
  const memberId = req.member.id
  const { realname, phone, email, address } = req.body

  try {
    // 1. 先查詢目前該會員的收件人數量
    const [rows] = await db.query(
      'SELECT COUNT(*) AS count FROM recipients WHERE member_id = ?',
      [memberId]
    )

    const currentCount = rows[0].count
    if (currentCount >= 5) {
      return res.status(400).json({
        success: false,
        message: '最多只能新增5位收件人',
      })
    }

    // 2. 若未超過 5 個，則允許新增
    const [result] = await db.query(
      `INSERT INTO recipients (member_id, realname, phone, email, address)
       VALUES (?, ?, ?, ?, ?)`,
      [memberId, realname, phone, email, address]
    )
    res.json({ success: true, id: result.insertId })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '新增收件人失敗' })
  }
})

// ✅ 修改收件人
router.put('/:id', authenticate, async (req, res) => {
  const recipientId = req.params.id
  const memberId = req.member.id
  const { realname, phone, email, address } = req.body

  try {
    const [result] = await db.query(
      `UPDATE recipients
       SET realname = ?, phone = ?, email = ?, address = ?, updated_at = NOW()
       WHERE id = ? AND member_id = ?`,
      [realname, phone, email, address, recipientId, memberId]
    )

    if (result.affectedRows === 0) {
      return res
        .status(403)
        .json({ success: false, message: '沒有權限修改此收件人' })
    }

    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '更新收件人失敗' })
  }
})

// ✅ 刪除收件人
// ✅ 刪除收件人（確認擁有者身份）
router.delete('/:id', authenticate, async (req, res) => {
  const recipientId = req.params.id
  const memberId = req.member.id

  try {
    // 先確認這個 recipient 屬於目前登入的會員
    const [check] = await db.query(
      `SELECT id FROM recipients WHERE id = ? AND member_id = ?`,
      [recipientId, memberId]
    )

    if (check.length === 0) {
      return res
        .status(403)
        .json({ success: false, message: '無權限刪除此收件人' })
    }

    // 通過驗證才刪除
    await db.query(`DELETE FROM recipients WHERE id = ?`, [recipientId])
    res.json({ success: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '刪除收件人失敗' })
  }
})

// ✅ 查詢會員的所有收件人
// 查詢會員的所有收件人 (改用 authenticate 後的 req.member.id，不用參數)
router.get('/all', authenticate, async (req, res) => {
  const memberId = req.member.id // 從驗證 middleware 拿

  try {
    const [rows] = await db.query(
      `SELECT * FROM recipients WHERE member_id = ? ORDER BY updated_at DESC`,
      [memberId]
    )
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '查詢收件人失敗' })
  }
})

// ✅ 查詢單一收件人（可選）
// ✅ 查詢單一收件人（需登入，且只能查自己的）
router.get('/:id', authenticate, async (req, res) => {
  const recipientId = req.params.id
  const memberId = req.member.id

  try {
    const [rows] = await db.query(
      `SELECT * FROM recipients WHERE id = ? AND member_id = ?`,
      [recipientId, memberId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到該收件人' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (error) {
    console.error(error)
    res.status(500).json({ success: false, message: '查詢收件人失敗' })
  }
})

export default router
