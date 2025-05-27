import express from 'express'
const router = express.Router()
import * as crypto from 'crypto'
// 用來產生JWT token的函式
import jsonwebtoken from 'jsonwebtoken'
// 用來處理FormData的中介軟體
import multer from 'multer'
// `upload.none()`可用來處理沒有檔案上傳時，要獲取FormData的資料
const upload = multer()
// 中介軟體，存取隱私會員資料用
import authenticate from '../middlewares/authenticate.js'

import { generateToken } from '../lib/otp.js'

// 導入服務層的函式
import {
  login,
  createOtp,
  verifyOtp,
  hasUnexpiredOtpByEmail,
  resetPassword,
} from '../services/auth.js'
import {
  getMemberById,
  getMemberFavorites,
  getMemberByField,
  createMember,
  updateMemberDataByField,
} from '../services/member.js'
// 寄送email函式
import { sendOtpMail } from '../lib/mail.js'
// 導入回應函式
import { successResponse, errorResponse, isDev } from '../lib/utils.js'
// line-login模組
import line_login from '../lib/line-login.js'
// 設定環境變數
import { serverConfig } from '../config/server.config.js'

// 取得安全的私鑰字串
const accessTokenSecret = serverConfig.jwt.secret
// otp 用
const otpExpire = serverConfig.otp.expire
// line 登入使用
const channel_id = isDev
  ? serverConfig.lineLogin.development.channelId
  : serverConfig.lineLogin.production.channelId

const channel_secret = isDev
  ? serverConfig.lineLogin.development.channelSecret
  : serverConfig.lineLogin.production.channelSecret

const callback_url = isDev
  ? serverConfig.lineLogin.development.callbackUrl
  : serverConfig.lineLogin.production.callbackUrl

const LineLogin = new line_login({
  channel_id,
  channel_secret,
  // 注意: LINE_LOGIN_CALLBACK_URL 是前端(react/next)路由
  // 必需要與 LINE Developer 的 "Callback URL" 設定一致
  // 目前與LINE登入頁設定為一致(登入頁路由=回調頁路由)
  callback_url,
  scope: 'openid profile',
  prompt: 'consent',
  bot_prompt: 'normal',
})

// 登入主機共用，產生JWT存取令牌(access token)
// 需要準備登入完成放在最後一行，例如: `await generateAccessToken(res, member)`
const generateAccessToken = async (res, member) => {
  // 產生存取令牌(access token)，其中包含會員資料
  const accessToken = jsonwebtoken.sign(member, accessTokenSecret, {
    expiresIn: '3d', // 有效期限3天
  })

  // 使用httpOnly cookie來讓瀏覽器端儲存access token
  // 如果是正式環境，sameSite: 'none' 要設定secure: true，表示只有https連線才會傳送cookie
  const option = isDev
    ? { httpOnly: true }
    : {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        domain: serverConfig.domain,
      }

  // 設定cookie
  res.cookie('accessToken', accessToken, option)

  // 取得會員id
  const memberId = member.id
  // 取得會員所有資料，包含profile
  const allMemberData = await getMemberById(memberId)
  // 取得會員收藏清單
  const favorites = await getMemberFavorites(memberId)

  // 傳送access token回應(例如react可以儲存在state中使用)
  successResponse(res, { member: allMemberData, favorites })
}

const logoutClearCookie = (res) => {
  // 如果是正式環境，sameSite: 'none' 要設定secure: true，表示只有https連線才會傳送cookie，也需要domain
  const option = isDev
    ? { httpOnly: true }
    : {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        domain: serverConfig.domain,
      }

  // 清除cookie，登入用的accessToken
  res.clearCookie('accessToken', option)
  // 清除cookie，一般的SESSION_ID
  res.clearCookie('SESSION_ID', option)
}

// 檢查登入狀態用(GET)
router.get('/check', authenticate, async (req, res) => {
  // 取得使用者id，從req.member.id取得(透過JWT解碼)
  const memberId = req.member.id

  try {
    // 取得會員所有資料，包含profile
    const member = await getMemberById(memberId)
    // 取得會員收藏清單
    const favorites = await getMemberFavorites(memberId)
    successResponse(res, { member, favorites })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 本地端伺服器登入用
router.post('/login', upload.none(), async (req, res) => {
  // 如果是開發環境，顯示訊息
  if (isDev) console.log(req.body)

  try {
    // 需要加上await等待取得資料
    // member是會員資料，不包含profile
    const member = await login(req.body)

    // 產生存取令牌(access token)，其中包含會員資料，會回應到前端
    await generateAccessToken(res, member)
  } catch (error) {
    errorResponse(res, error)
  }
})

router.post('/google-login', async function (req, res) {
  // 如果是開發環境，顯示訊息
  if (isDev) console.log(req.body)

  const { providerId, displayName, email, uid, photoURL } = req.body

  // 檢查從react來的資料
  if (!providerId || !uid) {
    return errorResponse(res, { message: '缺少google登入資料' })
  }

  const googleUid = uid

  try {
    // 查詢資料庫是否有同email的會員資料
    // const emailMember = await getMemberByEmail(email)
    const emailMember = await getMemberByField({ email })

    // 查詢資料庫是否有同googleUid的資料
    // const googleUidMember = await getMemberByGoogleUid(googleUid)
    const googleUidMember = await getMemberByField({ googleUid })

    // 最後要加到JWT的會員資料
    let member = null

    // 特殊流程: google登入時查詢到已經有同樣gmail的資料，這時要先進行更新(連結)後再登入
    // 有emailMember，但沒有googleUidMember  ==> 進行更新googleUid ==> 登入
    if (!googleUidMember && emailMember) {
      // member = await updateMemberGoogleUidByEmail(email, googleUid)
      member = await updateMemberDataByField({ email }, { googleUid })
    }

    // 兩者都有存在(代表是有已存在的會員) -> 登入
    if (googleUidMember && emailMember) {
      member = googleUidMember
    }

    // 兩者都不存在 -> 建立一個新會員資料(無帳號與密碼) -> 登入
    if (!googleUidMember && !emailMember) {
      const newMember = {
        // 用googleUid當帳號(因為帳號是必要的，這裡不會用到)
        username: String(googleUid),
        name: displayName,
        // 用亂數產生密碼(因為密碼是必要的，這裡不會用到)，長度20
        password: crypto.randomBytes(10).toString('hex'),
        email: email,
        googleUid,
        avatar: photoURL,
      }

      // 新增會員資料
      member = await createMember(newMember)
    }

    if (isDev) console.log('member', member)

    // 產生存取令牌(access token)，其中包含會員資料，會回應到前端
    await generateAccessToken(res, member)
  } catch (error) {
    errorResponse(res, error)
  }
})

// 本地端伺服器登出用
router.post('/logout', authenticate, async (req, res) => {
  // 清除cookie
  logoutClearCookie(res)

  // 回應，不回傳資料
  successResponse(res)
})

// #region ------------ 以下為Line Login路由 ------------
// 此api路由為產生登入網址，傳回前端後，要自己導向line網站進行登入
router.get('/line-login', LineLogin.authJson())

// line登出機制
// TODO: 可能無法清除cookie，因為是get方式，可能會被瀏覽器忽略要改成post方式
router.get('/line-logout', async function (req, res) {
  if (!req.query.line_uid) {
    return res.json({ status: 'error', message: '缺少必要資料' })
  }

  // const member = await getMemberByLineUid(req.query.line_uid)
  const member = await getMemberByField({ lineUid: req.query.line_uid })

  // 清除cookie
  logoutClearCookie(res)

  // https://developers.line.biz/en/docs/line-login/managing-users/#logout
  // 登出時進行撤銷(revoke) access token
  const result = await LineLogin.revoke_access_token(member.lineAccessToken)

  if (isDev) console.log('line-logout result:', result)

  // 回應，不回傳資料
  return res.json({ status: 'success', data: null })
})

// 此api路由為line登入後，從前端(react/next)callback的對應路由頁面，即真正登入處理路由
router.get(
  '/line-callback',
  LineLogin.callback(
    // 登入成功的回調函式 Success callback
    async (req, res, next, token_response) => {
      if (isDev) console.log(token_response)

      // 以下流程:
      // 1. 先查詢資料庫是否有同line_uid的資料
      // 2-1. 有存在 -> 執行登入工作
      // 2-2. 不存在 -> 建立一個新會員資料(無帳號與密碼)，只有line來的資料 -> 執行登入工作

      const lineUid = token_response.id_token.sub

      try {
        // 1. 先查詢資料庫是否有同line_uid的資料
        // const lineUidMember = await getMemberByLineUid(lineUid)
        const lineUidMember = await getMemberByField({ lineUid })

        let member = null
        // 2-1. 有存在 -> 更新line的access token ==> 執行登入工作
        if (lineUidMember) {
          // 更新line的access token
          // member = await updateMemberLineAccessTokenByLineUid(
          //   lineUid,
          //   token_response.access_token
          // )
          member = await updateMemberDataByField(
            { lineUid },
            { lineAccessToken: token_response.access_token }
          )
        } else {
          // 2-2. 不存在 -> 建立一個新會員資料，只有line來的資料 -> 執行登入工作
          const newMember = {
            // 用LineUid當帳號(因為帳號是必要的，這裡不會用到)
            username: String(lineUid),
            // 用亂數產生密碼(因為密碼是必要的，這裡不會用到)，長度20
            password: crypto.randomBytes(10).toString('hex'),
            // 因為line登入要得到email，必須額外申請，所以這裡只作展示用，以亂數產生，參考:
            // https://developers.line.biz/en/docs/line-login/integrate-line-login/#applying-for-email-permission
            email: crypto.randomBytes(6).toString('hex') + '@line-demo.com',
            name: token_response.id_token.name,
            lineUid: token_response.id_token.sub,
            lineAccessToken: token_response.access_token,
            avatar: token_response.id_token.picture,
          }

          // 新增會員資料
          member = await createMember(newMember)
        }

        if (isDev) console.log('member', member)

        // 產生存取令牌(access token)，其中包含會員資料，會回應到前端
        await generateAccessToken(res, member)
      } catch (error) {
        errorResponse(res, error)
      }
    },
    // 登入失敗的回調函式 Failure callback
    (req, res, next, error) => {
      if (isDev) console.log(error)
      errorResponse(res, error)
    }
  )
)
// #endregion ------------ 以上為Line Login路由 ------------

// #region ------------ 以下為OTP路由 ------------
// 產生一筆otp
router.post('/otp', upload.none(), async (req, res) => {
  const { email } = req.body

  if (!email) {
    return errorResponse(res, { message: '缺少必要資料' })
  }

  try {
    // 檢查此email是否存在
    const member = await getMemberByField({ email })

    if (!member) {
      return errorResponse(res, { message: '使用者不存在' })
    }

    // 檢查是否有未過期的otp
    const hasUnexpiredOtp = await hasUnexpiredOtpByEmail(email)

    if (hasUnexpiredOtp) {
      return errorResponse(res, { message: '有尚未過期的otp，請稍後再試。' })
    }

    // 產生一筆新的totp
    const newOtp = generateToken(email)
    // 30 秒後會重新改變
    const second =
      newOtp.totp.period - (Math.floor(Date.now() / 1000) % newOtp.totp.period)

    // 預設 5 分鐘過期(5 * 60 * 1000)
    const exp = Date.now() + otpExpire
    // otp token
    const token = newOtp.token

    // 產生一個隨機hash
    const hash = crypto.randomBytes(10).toString('hex')
    // 過期時間(日期物件)
    const expiredAt = new Date(exp)
    // 資料庫建立一筆otp
    const otp = await createOtp(email, token, hash, expiredAt)

    if (isDev) console.log('db:otp:', otp)

    // 將otp資料存入session
    req.session.otp = {
      email: email, // 會員email
      hash: hash, // 產生的特定hash，用於返回網站時驗証用
      token: token, // 產生的 token
      uri: newOtp.uri, // 產生的 uri
      changeAt: Date.now() + second * 1000, // 30 秒後會重新改變
      exp: exp, // 過期時間，毫秒值
    }

    // 寄送otp信件(注意這個操作會耗時)
    await sendOtpMail(email, token, hash)

    if (isDev) console.log('final: req.session.otp:', req.session.otp)

    // 傳送otp回應，回應hash資料
    successResponse(res, { hashToken: hash })
  } catch (error) {
    errorResponse(res, error)
  }
})

// 重設密碼用(透過email)
router.post('/reset-password', async (req, res) => {
  const { email, token, password } = req.body

  if (!token || !email || !password) {
    return res.json({ status: 'error', message: '缺少必要資料' })
  }

  try {
    const isValid = await verifyOtp(email, token)

    if (!isValid) {
      return errorResponse(res, { message: '驗証碼錯誤' })
    }

    // 重設密碼(注意這裡面除了會執行更新密碼外，在更新後也會刪除otp資料)
    await resetPassword(email, password)

    // 清除session資料
    req.session.destroy()

    // 清除cookie
    logoutClearCookie(res)

    // 成功
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

// 重設密碼用(透過hash，不用email)
router.post('/reset-password-hash', async (req, res) => {
  const { secret, token, password } = req.body

  isDev && console.log('req.body:', req.body)
  isDev && console.log('req.session.otp:', req.session.otp)

  if (!token || !secret || !password) {
    return errorResponse(res, { message: '缺少必要資料' })
  }

  if (req.session?.otp?.hash !== secret) {
    return errorResponse(res, { message: '驗証安全字串錯誤' })
  }

  // 從session中取得email
  const email = req.session.otp.email

  try {
    const isValid = await verifyOtp(email, token)

    if (!isValid) {
      return errorResponse(res, { message: '驗証碼錯誤' })
    }

    // 重設密碼(注意這裡面除了會執行更新密碼外，在更新後也會刪除otp資料)
    await resetPassword(email, password)

    // 清除session資料
    req.session.destroy()

    // 清除cookie
    logoutClearCookie(res)

    // 成功
    successResponse(res)
  } catch (error) {
    errorResponse(res, error)
  }
})

// 重設密碼用(透過hash，不用email)
router.post('/check-secret', async (req, res) => {
  const { secret } = req.body

  isDev && console.log('req.body:', req.body)
  isDev && console.log('req.session.otp:', req.session.otp)

  if (!secret) {
    return errorResponse(res, { message: '缺少必要資料' })
  }

  if (req.session?.otp?.hash !== secret) {
    return errorResponse(res, { message: '驗証安全字串錯誤' })
  }

  // 成功
  successResponse(res)
})
// #endregion ------------ 以上為OTP路由 ------------

export default router
