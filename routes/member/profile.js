import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'
import multer from 'multer'
import path from 'path'
// 導入回應函式
import { successResponse, errorResponse, isDev } from '../../lib/utils.js'

//  multer的設定值
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    // 存放目錄
    callback(null, 'public/avatar/')
  },
  filename: function (req, file, callback) {
    // 經授權後，檔名用req.user帶有會員的id
    const newFilename = req.member.id
    // 或是新檔名由表單傳來的req.body.newFilename決定
    //const newFilename = req.query.filename
    callback(null, newFilename + path.extname(file.originalname))
  },
})
const router = express.Router()

const upload = multer({ storage: storage })
router.get('/', authenticate, async (req, res) => {
  try {
    // 從middleware放的 member 物件取得 id
    const memberId = req.member.id

    const [rows] = await db.query(
      `SELECT id, username, email, image_url, vip_levels_id, birth_date, gender, phone FROM member WHERE id = ?`,
      [memberId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: '找不到會員資料' })
    }

    const member = rows[0]

    res.json({
      id: member.id,
      username: member.username,
      email: member.email,
      image_url: member.image_url,
      vip_levels_id: member.vip_levels_id,
      birth_date: member.birth_date,
      gender: member.gender,
      phone: member.phone,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// 更新會員資料並支援上傳頭像
router.put('/edit', upload.single('avatar'), authenticate, async (req, res) => {
  const memberId = req.member.id
  const updatedMember = req.body
  const file = req.file

  if (isDev) {
    console.log('memberId:', memberId)
    console.log('updatedMember:', updatedMember)
    console.log('上傳的檔案:', file)
  }

  try {
    // 如果有上傳頭像檔案，更新 image_url 欄位
    if (file) {
      updatedMember.image_url = `/avatar/${file.filename}`
    }

    // 確保有所有欄位，避免 undefined
    let {
      username = '',
      email = '',
      birth_date,
      gender = '',
      phone = '',
      image_url = null,
    } = updatedMember

    if (birth_date === '') {
      birth_date = null
    }

    // 更新會員資料
    await db.query(
      `UPDATE member SET username = ?, email = ?, birth_date = ?, gender = ?, phone = ?, image_url = ? WHERE id = ?`,
      [username, email, birth_date, gender, phone, image_url, memberId]
    )

    successResponse(res, { image_url })
  } catch (error) {
    console.error(error)
    errorResponse(res, error)
  }
})

export default router
