import express from 'express'
import db from '../../config/mysql.js'
import { sendOtpMail } from '../../lib/mail.js'
import crypto from 'crypto'

const router = express.Router()

router.post('/', async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: '請輸入 Email' })

  const [rows] = await db.query('SELECT id FROM member WHERE email = ?', [
    email,
  ])
  if (rows.length === 0)
    return res.status(404).json({ message: '查無此 Email' })

  const memberId = rows[0].id

  // 建立 6 碼 OTP 驗證碼
  const otpToken = Math.floor(100000 + Math.random() * 900000).toString()

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 有效期 5 分鐘
  const secret = crypto.randomUUID() // 用來識別此次驗證請求

  // 將 OTP、過期時間、secret 儲存到資料庫中
  await db.query(
    'UPDATE member SET reset_token = ?, reset_token_expiry = ?, reset_token_secret = ? WHERE id = ?',
    [otpToken, expiresAt, secret, memberId]
  )

  await sendOtpMail(email, otpToken, secret)

  // 一定要把 secret 回傳給前端
  return res.json({ message: '驗證碼已寄出，請於5分鐘內進行驗證', secret })
})

export default router
