import express from 'express'
import db from '../../config/mysql.js'

const router = express.Router()

router.get('/:id', async (req, res) => {
  const memberId = req.params.id

  try {
    const [rows] = await db.execute(
      `SELECT id, city, zip, address
       FROM member
       WHERE id = ?`,
      [memberId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到該會員' })
    }

    res.json(rows[0])
  } catch (error) {
    console.error('查詢會員資料時發生錯誤:', error)
    res.status(500).json({ error: '伺服器錯誤' })
  }
})

export default router
