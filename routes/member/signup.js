import express from 'express'
import bcrypt from 'bcrypt'
import db from '../../config/mysql.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ message: '請填寫完整註冊資料' })
  }

  try {
    const [rows] = await db.query('SELECT * FROM MEMBER WHERE email = ?', [
      email,
    ])
    if (rows.length > 0) {
      return res.status(409).json({ message: '此 Email 已被註冊' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await db.query(
      'INSERT INTO member (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )

    res.status(201).json({ message: '註冊成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
