import express from 'express'
import db from '../../config/mysql.js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
import crypto from 'crypto'

// 自訂工具
import { successResponse, errorResponse, isDev } from '../../lib/utils.js'
import { sendOtpMail } from '../../lib/mail.js'
import {
  getMemberByField,
  createMember,
  updateMemberDataByField,
} from '../../services/member.js'

dotenv.config()
const accessTokenSecret = process.env.JWT_SECRET

const router = express.Router()

// 產生並發送 accessToken 的共用函式
function generateAccessToken(res, member) {
  const token = jwt.sign(
    {
      id: member.id,
      name: member.username || member.name,
      avatar: member.image_url || member.avatar || '',
    },
    accessTokenSecret,
    { expiresIn: '3h' }
  )

  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: false, // 上線時請改為 true
    sameSite: 'Lax',
    maxAge: 2 * 60 * 60 * 1000, // 2小時
  })

  return res.json({
    status: 'success',
    message: '登入成功',
    data: {
      id: member.id,
      name: member.username || member.name,
      email: member.email,
      image_url: member.image_url || member.avatar || '',
      vip_levels_id: member.vip_levels_id || null,
    },
  })
}

// 傳統登入
router.post('/', async (req, res) => {
  const { email, password } = req.body

  try {
    const [rows] = await db.query(
      `SELECT id, username, email, password, image_url, vip_levels_id FROM member WHERE email = ?`,
      [email]
    )

    if (rows.length === 0) {
      return errorResponse(res, { message: '帳號或密碼錯誤' }, 401)
    }

    const member = rows[0]

    const match = await bcrypt.compare(password, member.password)
    if (!match) {
      return errorResponse(res, { message: '帳號或密碼錯誤' }, 401)
    }

    return generateAccessToken(res, member)
  } catch (err) {
    console.error(err)
    return errorResponse(res, { message: '伺服器錯誤' }, 500)
  }
})

// Google 登入
router.post('/google-login', async (req, res) => {
  if (isDev) console.log('Google login body:', req.body)

  const { providerId, displayName, email, uid, photoURL } = req.body

  if (!providerId || !uid) {
    return errorResponse(res, { message: '缺少 Google 登入資料' }, 400)
  }

  const google_uid = uid

  try {
    // 1. 用 email 查會員
    const [emailRows] = await db.query('SELECT * FROM member WHERE email = ?', [
      email,
    ])
    const emailMember = emailRows.length ? emailRows[0] : null

    // 2. 用 googleUid 查會員
    const [googleRows] = await db.query(
      'SELECT * FROM member WHERE google_uid = ?',
      [google_uid]
    )
    const googleUidMember = googleRows.length ? googleRows[0] : null

    let member = null

    // 有 email，但無 googleUid → 綁定 googleUid
    if (!googleUidMember && emailMember) {
      await db.query('UPDATE member SET google_uid = ? WHERE email = ?', [
        google_uid,
        email,
      ])
      const [updatedRows] = await db.query(
        'SELECT * FROM member WHERE email = ?',
        [email]
      )
      member = updatedRows[0]
    }

    // 兩者都有 → 使用 googleUidMember
    else if (googleUidMember && emailMember) {
      member = googleUidMember
    }

    // 兩者都沒有 → 新增會員
    else if (!googleUidMember && !emailMember) {
      const randomPassword = crypto.randomBytes(10).toString('hex')
      const username = String(google_uid)

      const [insertResult] = await db.query(
        'INSERT INTO member (username, password, email, google_uid, image_url) VALUES ( ?, ?, ?, ?, ?)',
        [username, randomPassword, email, google_uid, photoURL]
      )

      // 新增後讀取會員資料
      const [newMemberRows] = await db.query(
        'SELECT * FROM member WHERE id = ?',
        [insertResult.insertId]
      )
      member = newMemberRows[0]
    }

    if (!member) {
      return errorResponse(res, { message: '登入失敗，請聯絡管理員' }, 500)
    }

    if (isDev) console.log('登入會員資料:', member)

    // 產生 JWT token 並回應 (你原本的 generateAccessToken 函式)
    return generateAccessToken(res, member)
  } catch (err) {
    console.error(err)
    return errorResponse(res, { message: '伺服器錯誤' }, 500)
  }
})

export default router
