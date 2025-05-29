import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { successResponse, errorResponse, isDev } from '../../lib/utils.js'
import { updateMemberPasswordById } from '../../services/member.js'

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

// 取得會員資料
router.get('/', authenticate, async (req, res) => {
  try {
    const memberId = req.member.id
    const [rows] = await db.query(
      `SELECT id, username, email, image_url, vip_levels_id, birth_date, gender, phone FROM member WHERE id = ?`,
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
      let { username = '', birth_date, gender = '', phone = '' } = updatedMember

      if (birth_date === '') {
        birth_date = null
      }

      let image_url = null // 預設不更新圖片

      if (file) {
        // 有上傳新頭貼
        image_url = path.posix.join('/member/member_images', file.filename)
      } else if (removeAvatar) {
        // 前端要求移除頭貼，改為預設圖片路徑
        image_url = '/member/member_images/user-img.svg'
      }

      if (image_url !== null) {
        // 更新包含圖片路徑及更新時間
        await db.query(
          `UPDATE member 
           SET username = ?, birth_date = ?, gender = ?, phone = ?, 
               image_url = ?, image_updated_at = NOW()
           WHERE id = ?`,
          [username, birth_date, gender, phone, image_url, memberId]
        )

        return successResponse(res, { image_url })
      } else {
        // 沒有更新圖片
        await db.query(
          `UPDATE member 
           SET username = ?, birth_date = ?, gender = ?, phone = ?
           WHERE id = ?`,
          [username, birth_date, gender, phone, memberId]
        )

        return successResponse(res, {}) // 沒更新圖片就不回傳 image_url
      }
    } catch (error) {
      console.error(error)
      errorResponse(res, error)
    }
  })
})

// 更新會員密碼
router.put('/:memberId/password', upload.none(), async (req, res) => {
  // 取得請求的資料
  // 格式: { currentPassword: '舊密碼', newPassword: '新密碼' }
  const updatedPassword = req.body
  // 取得使用者id，從req.params.memberId取得，並轉換成數字
  const memberId = Number(req.params.memberId)
  // 如果是開發環境，顯示訊息
  if (isDev)
    console.log('memberId', memberId, 'updatedPassword', updatedPassword)

  try {
    await updateMemberPasswordById(memberId, updatedPassword)
    // 成功更新會員的回應
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

export default router
