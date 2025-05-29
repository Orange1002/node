import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import db from '../../config/mysql.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ message: '請填寫完整註冊資料' })
  }

  try {
    const [rows] = await db.query('SELECT * FROM member WHERE email = ?', [
      email,
    ])
    if (rows.length > 0) {
      return res.status(409).json({ message: '此 Email 已被註冊' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [insertResult] = await db.query(
      'INSERT INTO member (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )

    // ✅ JWT 簽發（id 與 email 可自行調整）
    const token = jwt.sign(
      { id: insertResult.insertId, email },
      process.env.JWT_SECRET, // 請確保 .env 有設好
      { expiresIn: '2hr' }
    )

    // ✅ 設定 cookie（讓前端登入狀態能維持）
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 只有 production 時才設 https
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    })

    // ✅ 回傳資料給前端（讓 useAuth.login 用）
    res.status(201).json({
      status: 'success',
      message: '註冊成功',
      data: {
        id: insertResult.insertId,
        name: username,
        email,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router
