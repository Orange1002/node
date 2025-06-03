import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images') // 放到 public/uploads
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, uuidv4() + ext) // 用 UUID 命名避免衝突
  },
})

const upload = multer({ storage })

export default upload
