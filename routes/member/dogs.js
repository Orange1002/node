import express from 'express'
import db from '../../config/mysql.js'
import authenticate from '../../middlewares/authenticate.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { successResponse, errorResponse, isDev } from '../../lib/utils.js'

const router = express.Router()

// 設定儲存狗狗圖片的位置
const dogImageDir = path.resolve('public', 'member', 'dogs_images')
if (!fs.existsSync(dogImageDir)) {
  fs.mkdirSync(dogImageDir, { recursive: true })
}

// 設定 multer
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, dogImageDir)
  },
  filename: function (req, file, callback) {
    const ext = path.extname(file.originalname)
    const newFilename = `dog_${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${ext}`
    callback(null, newFilename)
  },
})
const upload = multer({ storage })

// 取得登入會員的所有狗狗資料
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM dogs WHERE member_id = ?', [
      req.member.id,
    ])
    successResponse(res, rows)
  } catch (err) {
    errorResponse(res, err)
  }
})

// 取得單隻狗狗資料
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params
  try {
    const [[dog]] = await db.query('SELECT * FROM dogs WHERE id = ?', [id])
    if (!dog) {
      return res.status(404).json({ message: '找不到該狗狗資料' })
    }
    if (dog.member_id !== req.member.id) {
      return res.status(403).json({ message: '無權限查看此狗狗資料' })
    }

    // 將 dogs_images 從 JSON 字串轉成陣列
    if (dog.dogs_images) {
      dog.dogs_images = JSON.parse(dog.dogs_images)
    } else {
      dog.dogs_images = []
    }

    successResponse(res, dog)
  } catch (err) {
    errorResponse(res, err)
  }
})

// 新增狗狗資料 照片上傳多張
router.post(
  '/add',
  authenticate,
  upload.array('dog_images', 5),
  async (req, res) => {
    try {
      const memberId = req.member.id
      const files = req.files || [] // 多張圖
      const { name, age, breed, description, size_id } = req.body

      // 將檔案路徑組成 JSON 陣列字串存到資料庫
      const images = files.map((file) =>
        path.posix.join('/member/dogs_images', file.filename)
      )

      const [result] = await db.query(
        `INSERT INTO dogs (member_id, name, age, breed, description, size_id, dogs_images, created_at, updated_at) 
   VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          memberId,
          name,
          age,
          breed,
          description,
          size_id,
          JSON.stringify(images),
        ]
      )

      // 將 insertId 回傳
      successResponse(res, { insertId: result.insertId })
    } catch (error) {
      console.error(error)
      errorResponse(res, error)
    }
  }
)

// 修改狗狗資料
router.put(
  '/edit/:id',
  authenticate,
  upload.array('dog_images', 5), // 多張圖片上傳
  async (req, res) => {
    const { id } = req.params
    const { name, age, breed, description, size_id } = req.body
    const files = req.files || []

    try {
      // 先檢查資料是否屬於該會員
      const [[dog]] = await db.query('SELECT * FROM dogs WHERE id = ?', [id])
      if (!dog || dog.member_id !== req.member.id) {
        return res.status(403).json({ message: '無權限修改此狗狗資料' })
      }

      // 解析前端傳來的 existingPhotos 與 photosToDelete
      // 注意這兩個會是 JSON 字串，若沒傳則預設空陣列
      const existingPhotos = req.body.existingPhotos
        ? JSON.parse(req.body.existingPhotos).map((url) => {
            // 確保只保留相對路徑部分（如 /member/dogs_images/xxx.jpg）
            return url.replace(/^https?:\/\/[^/]+/, '')
          })
        : []
      const photosToDelete = req.body.photosToDelete
        ? JSON.parse(req.body.photosToDelete)
        : []

      // 刪除實體檔案
      photosToDelete.forEach((photoPath) => {
        // photoPath 形如 /member/dogs_images/xxx.jpg
        const fullPath = path.join('public', photoPath)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })

      // 新上傳圖片路徑
      const newImages = files.map((file) =>
        path.posix.join('/member/dogs_images', file.filename)
      )

      // 合併剩餘舊照片與新上傳圖片
      const updatedImages = [...existingPhotos, ...newImages]

      // 更新資料庫
      await db.query(
        `UPDATE dogs SET name = ?, age = ?, breed = ?, description = ?, size_id = ?, dogs_images = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          name,
          age,
          breed,
          description,
          size_id,
          JSON.stringify(updatedImages),
          id,
        ]
      )

      // 回傳成功與最新圖片陣列
      successResponse(res, updatedImages)
    } catch (err) {
      console.error(err)
      errorResponse(res, err)
    }
  }
)

// 刪除狗狗資料
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params

  try {
    const [[dog]] = await db.query('SELECT * FROM dogs WHERE id = ?', [id])
    if (!dog || dog.member_id !== req.member.id) {
      return res.status(403).json({ message: '無權限刪除此狗狗資料' })
    }

    await db.query('DELETE FROM dogs WHERE id = ?', [id])
    successResponse(res)
  } catch (err) {
    errorResponse(res, err)
  }
})

export default router
