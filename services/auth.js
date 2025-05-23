import prisma from '../lib/prisma.js'
import { z } from 'zod'
import bcrypt from 'bcrypt'
// import { del } from '@vercel/blob'
// import * as crypto from 'crypto'
import { safeParseBindSchema } from '../lib/utils.js'

// #region 建立驗證格式用函式
// 建立會員資料的驗證用的schema物件
const authSchema = {}
// 登入的驗証用的schema
authSchema.loginData = z.object({
  email: z.string().email(),
  password: z.string().min(5).max(30),
})

// 產生otp的驗證用的schema

// 重設密碼的驗證用的schema
authSchema.resetPasswordData = z.object({
  email: z.string().email(), // email格式
  newPassword: z.string().min(5).max(30), // 5-12個字元，必要
})

// 綁定驗證用的schema的檢查函式
const authSchemaValidator = safeParseBindSchema(authSchema)
// #endregion
// 本地端伺服器登入用
export const login = async (loginData) => {
  // 檢查從前端來的資料是否符合格式，注意要傳入與檢查schema同名的物件值，例如{ loginData: loginData }，前者為物件的key，會比對schema物件中的檢查格式，後者為要檢查物件的值
  authSchemaValidator({ loginData })

  // 查詢資料庫這帳號的使用者資料(如果username有設定為unique，可以用`findUnique`)
  // 這裡不會有profile
  const member = await prisma.member.findFirst({
    where: { email: loginData.email },
  })

  // null代表不存在
  if (!member) {
    throw new Error('使用者不存在')
  }

  // 比較密碼正確性: compareHash(輸入的密碼純字串, 資料庫中的密碼hash)
  // isValid=true 代表正確
  console.log('輸入密碼:', loginData.password)
  console.log('資料庫密碼 hash:', member.password)
  const isValid = await bcrypt.compare(loginData.password, member.password)
  console.log('比對結果:', isValid)

  // isValid=false 代表密碼錯誤
  if (!isValid) {
    throw new Error('密碼錯誤')
  }

  // 不回傳密碼，刪除密碼屬性
  delete member.password

  // 如果user的屬性中有null值，轉換為空字串
  if (member) {
    for (const key in member) {
      if (member[key] === null) {
        member[key] = ''
      }
    }
  }

  // 存取令牌(access token)只需要id和username就足夠，其它資料可以再向資料庫查詢
  return member
}

export const hasUnexpiredOtpByEmail = async (email) => {
  const existOtp = await prisma.otp.findFirst({
    where: { email },
  })

  // 如果有未過期的otp
  if (existOtp && existOtp?.expiredAt >= new Date()) {
    return true
  }

  return false
}

// 產生一筆otp
export const createOtp = async (email, token, hash, expiredAt) => {
  // 先用email查詢是否有記錄
  const existOtp = await prisma.otp.findFirst({ where: { email } })

  // 如果有過期的otp，刪除它
  if (existOtp && existOtp?.expiredAt < new Date()) {
    await prisma.otp.delete({ where: { id: existOtp.id } })
  }

  // 如果有未過期的otp，拋出錯誤不能再新增
  if (existOtp && existOtp?.expiredAt >= new Date()) {
    throw new Error('有尚未過期的otp')
  }

  // 產生一筆otp
  return await prisma.otp.create({
    data: { email, token, hash, expiredAt },
  })
}

// 驗證otp
export const verifyOtp = async (email, token) => {
  const otp = await prisma.otp.findFirst({
    where: { AND: [{ email }, { token }, { expiredAt: { gte: new Date() } }] },
  })

  return !!otp
}

// 重設密碼
export const resetPassword = async (email, newPassword) => {
  // 驗證格式，需要傳入一個物件，物件的key要與schema的名稱要相同
  authSchemaValidator({ resetPasswordData: { email, newPassword } })

  const user = await prisma.user.findFirst({ where: { email } })

  if (!user) {
    throw new Error('使用者不存在')
  }

  // 產生新的hash密碼
  const hash = await bcrypt.hash(newPassword, 10)

  // 更新 user 的密碼
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  })

  // 刪除所有這個email的otp
  await prisma.otp.deleteMany({ where: { email } })
}
