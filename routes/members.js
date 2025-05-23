import express from 'express'
const router = express.Router()
// 導入上傳圖片的函式 vercel blob
import { put, del } from '@vercel/blob'
// 服務層的函式
import {
  getMembers,
  getMemberById,
  createMember,
  updateMemberProfileById,
  updateMemberPasswordById,
  updateMemberAvatarById,
  getMemberAvatarById,
} from '../services/member.js'
// 導入回應函式
import { successResponse, errorResponse, isDev } from '../lib/utils.js'
// 中介軟體，用來驗證使用者的身份
import authenticate from '../middlewares/authenticate.js'
// 用來處理FormData的中介軟體，上傳檔案用使用multer
import path from 'path'
import multer from 'multer'

// #region ------ multer ------
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
const upload = multer({ storage: storage })
// `upload.none()`可用來處理沒有檔案上傳時，要獲取FormData的資料
// #endregion ------------

// #region ------ GET ------
// 得到所有會員資料
// 網址: /api/members
router.get('/', async (req, res) => {
  try {
    // 需要加上await等待取得資料
    const members = await getMembers()
    successResponse(res, { members })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 得到單筆資料(透過授權的直接使用JWT token中的id)
// 網址: /api/members/me
router.get('/me', authenticate, async (req, res) => {
  // 取得使用者id，從req.member.id取得(透過JWT解碼)
  const memberId = req.member.id
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('memberId', memberId)

  try {
    // 需要加上await等待取得資料
    const member = await getMemberById(memberId)
    successResponse(res, { member })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 得到單筆資料(注意，網址有動態參數時要寫在GET區段最後面)
// 網址: /api/members/:id
router.get('/:memberId', async (req, res) => {
  // 需要轉換成數字
  const memberId = Number(req.params.memberId)
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('memberId', memberId)

  try {
    // 需要加上await等待取得資料
    const member = await getMemberById(memberId)
    successResponse(res, { member })
  } catch (error) {
    errorResponse(res, error)
  }
})
// #endregion ------------

// #region ------ POST ------
// 新增會員資料(註冊會員使用)
router.post('/', upload.none(), async (req, res) => {
  // 取得請求的資料
  const newMember = req.body
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('req.body', req.body)

  try {
    const member = await createMember(newMember)
    // 如果是開發環境，顯示訊息
    if (isDev) console.log('member', member)

    // 成功建立會員的回應
    successResponse(res, null, 201)
  } catch (error) {
    errorResponse(res, error)
  }
})
// 上傳個人大頭照
// 網址: /api/members/me/avatar
router.post(
  '/me/avatar',
  // 驗證使用者要放在multer的upload.single('avatar')之前
  authenticate,
  // 這裡面要得到req.member.id，所以放後面
  upload.single('avatar'),
  async (req, res) => {
    // req.file 即上傳來的檔案(avatar檔案)，req.body 其它的文字欄位資料
    // console.log(req.file, req.body)

    if (!req.file) {
      errorResponse(res, { message: '沒有上傳檔案' })
    }

    // 從authenticate中介軟體取得的user資料
    const memberId = req.member?.id
    // 從上傳的檔案取得檔名(這會經由multer處理過的檔案名稱，不是上傳的檔名)
    const avatar = req.file?.filename

    try {
      // 需要加上await等待取得資料
      await updateMemberAvatarById(memberId, avatar)
      // 成功更新會員的回應
      successResponse(res)
    } catch (error) {
      errorResponse(res, error)
    }
  }
)

// 用vercel blob上傳圖片
// 網址: /api/members/me/avatar
router.post(
  '/me/cloud-avatar',
  authenticate,
  multer().single('avatar'),
  async (req, res) => {
    //const filename = req.query.filename
    // 或是新檔名由表單傳來的req.body.newFilename決定
    //const newFilename = req.query.filename
    const ext = path.extname(req.file.originalname)
    const newFilename = req.member.id + ext
    const memberId = req.member.id

    try {
      // 先得到之前的avatar檔名
      const currentAvatarUrl = await getMemberAvatarById(memberId)

      // 上傳圖片
      const blob = await put(newFilename, req.file.buffer, {
        access: 'public',
      })
      // 更新會員的avatar
      await updateMemberAvatarById(memberId, blob.url)

      // 如果有上一個目前的圖片，刪除在雲端上的圖片
      if (currentAvatarUrl) await del(currentAvatarUrl)
      // 成功更新會員的回應
      successResponse(res, { blob })
    } catch (error) {
      errorResponse(res, error)
    }
  }
)
// #endregion ------------

// #region ------ PUT ------
// 更新會員資料(透過授權的直接使用JWT token中的id)
router.put('/me/profile', upload.none(), authenticate, async (req, res) => {
  // 取得請求的資料
  const updatedMember = req.body
  // 取得使用者id，從req.member.id取得(透過JWT解碼)
  const memberId = req.member.id
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('memberId', memberId, 'updatedMember', updatedMember)

  try {
    await updateMemberProfileById(memberId, updatedMember)
    // 成功更新會員的回應
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})
// 更新會員密碼(透過授權的直接使用JWT token中的id)
router.put('/me/password', upload.none(), authenticate, async (req, res) => {
  // 取得請求的資料
  // 格式: { currentPassword: '舊密碼', newPassword: '新密碼' }
  const updatedPassword = req.body
  // 取得使用者id，從req.member.id取得(透過JWT解碼)
  const memberId = req.member.id
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
// 更新會員資料(網址有動態參數要寫在PUT區段最後面)
router.put('/:memberId/profile', upload.none(), async (req, res) => {
  // 取得請求的資料
  const updatedUser = req.body
  // 取得使用者id，從req.params.userId取得，並轉換成數字
  const memberId = Number(req.params.memberId)
  // 如果是開發環境，顯示訊息
  if (isDev) console.log('memberId', memberId, 'updatedUser', updatedUser)

  try {
    await updateMemberProfileById(memberId, updatedUser)
    // 成功更新會員的回應
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})
// #endregion ------------

// #region ------ DELETE ------
// #endregion ------------

export default router
