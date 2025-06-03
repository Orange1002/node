import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = './uploads'

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir)
}

// 限制允許的圖片格式
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('僅允許上傳圖片格式：jpg、png、webp'))
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const tempName = 'temp-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext
    cb(null, tempName)
  },
})

export const upload = multer({ storage, fileFilter })
