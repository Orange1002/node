import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { successResponse, errorResponse, isDev } from '../../lib/utils.js'
import { updateMemberPasswordById } from '../../services/member.js'
import { body, validationResult } from 'express-validator'
import bcrypt from 'bcrypt'

const router = express.Router()

// 絕對路徑設定
const memberImageDir = path.resolve('public', 'member', 'member_images')

// 確認資料夾存在，沒有就建立
if (!fs.existsSync(memberImageDir)) {
  fs.mkdirSync(memberImageDir, { recursive: true })
  if (isDev) console.log('已建立目錄:', memberImageDir)
}

// 設定 multer 儲存路徑與檔名
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, memberImageDir)
  },
  filename: function (req, file, callback) {
    const ext = path.extname(file.originalname)
    const newFilename = req.member.id + ext
    callback(null, newFilename)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('只允許上傳圖片檔案'), false)
    } else {
      cb(null, true)
    }
  },
  limits: {
    fileSize: 3 * 1024 * 1024, // 3MB
  },
})

const validatePasswordUpdate = [
  body('currentPassword')
    .notEmpty()
    .withMessage('請輸入目前密碼')
    .isLength({ min: 6 })
    .withMessage('目前密碼長度至少需為 6 字元'),

  body('newPassword')
    .notEmpty()
    .withMessage('請輸入新密碼')
    .isLength({ min: 6 })
    .withMessage('新密碼長度至少需為 6 字元')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('新密碼不能與舊密碼相同')
      }
      return true
    }),
]

// 密碼修改驗證
router.put(
  '/:memberId/password',
  upload.none(),
  validatePasswordUpdate,
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg })
    }

    const { currentPassword, newPassword } = req.body
    const memberId = Number(req.params.memberId)

    if (isDev) {
      console.log(
        'memberId',
        memberId,
        'currentPassword',
        currentPassword,
        'newPassword',
        newPassword
      )
    }

    try {
      // 取得目前會員密碼
      const [rows] = await db.query(
        'SELECT password FROM member WHERE id = ?',
        [memberId]
      )

      if (rows.length === 0) {
        return res.status(404).json({ message: '找不到會員' })
      }

      const hashedPassword = rows[0].password

      // 比對目前密碼是否正確
      const isMatch = await bcrypt.compare(currentPassword, hashedPassword)
      if (!isMatch) {
        return res.status(400).json({ message: '目前密碼錯誤' })
      }

      // 將新密碼加密
      const newHashedPassword = await bcrypt.hash(newPassword, 10)

      // 更新密碼
      await db.query(
        'UPDATE member SET password = ?, updated_at = NOW() WHERE id = ?',
        [newHashedPassword, memberId]
      )

      successResponse(res)
    } catch (error) {
      console.error(error)
      errorResponse(res, error)
    }
  }
)

// 取得會員資料
router.get('/', authenticate, async (req, res) => {
  try {
    const memberId = req.member.id
    const [rows] = await db.query(
      `SELECT id, username, email, image_url, vip_levels_id, birth_date, gender, phone, city, zip, address, realname FROM member WHERE id = ?`,
      [memberId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: '找不到會員資料' })
    }

    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// 編輯會員資料（含頭像）
router.put('/edit', authenticate, (req, res) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res
          .status(400)
          .json({ message: '檔案大小超過 3MB，請選擇較小的檔案' })
      }
      return res.status(400).json({ message: err.message || '上傳錯誤' })
    }

    const memberId = req.member.id
    const updatedMember = req.body
    const file = req.file
    const removeAvatar = updatedMember.remove_avatar === 'true'

    if (isDev) {
      console.log('memberId:', memberId)
      console.log('updatedMember:', updatedMember)
      console.log('上傳的檔案:', file)
      console.log('是否移除頭像:', removeAvatar)
    }

    try {
      let {
        username = '',
        birth_date,
        gender = '',
        city = '',
        zip = '',
        phone = '',
        address = '',
        realname = '',
      } = updatedMember
      if (birth_date === '') {
        birth_date = null
      }

      let image_url = null

      if (file) {
        // 有上傳新頭貼
        image_url = path.posix.join('/member/member_images', file.filename)
      } else if (removeAvatar) {
        // 前端要求移除頭貼
        image_url = '/member/member_images/user-img.svg'
      }

      if (image_url !== null) {
        // 更新包含圖片欄位
        await db.query(
          `UPDATE member 
           SET username = ?, birth_date = ?, gender = ?, phone = ?, city = ?, zip = ?, address = ?, realname = ?,
               image_url = ?, image_updated_at = NOW()
           WHERE id = ?`,
          [
            username,
            birth_date,
            gender,
            phone,
            city,
            zip,
            address,
            realname,
            image_url,
            memberId,
          ]
        )
        return successResponse(res, { image_url })
      } else {
        // 沒有變更頭像
        await db.query(
          `UPDATE member 
           SET username = ?, birth_date = ?, gender = ?, phone = ?, city = ?, zip = ?, address = ?, realname = ?
           WHERE id = ?`,
          [
            username,
            birth_date,
            gender,
            phone,
            city,
            zip,
            address,
            realname,
            memberId,
          ]
        )
        return successResponse(res, {})
      }
    } catch (error) {
      console.error(error)
      errorResponse(res, error)
    }
  })
})

// 更新會員密碼
router.put(
  '/:memberId/password',
  upload.none(),
  validatePasswordUpdate,
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg })
    }

    const updatedPassword = req.body
    const memberId = Number(req.params.memberId)

    if (isDev)
      console.log('memberId', memberId, 'updatedPassword', updatedPassword)

    try {
      await updateMemberPasswordById(memberId, updatedPassword)
      successResponse(res)
    } catch (error) {
      errorResponse(res, error)
    }
  }
)

export default router
