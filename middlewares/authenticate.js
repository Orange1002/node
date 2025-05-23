import jsonwebtoken from 'jsonwebtoken'

import dotenv from 'dotenv'

dotenv.config() // 載入 .env 環境變數
const accessTokenSecret = process.env.JWT_SECRET

// import { serverConfig } from '../config/server.config.js'

// // 獲得加密用字串
// const accessTokenSecret = process.env.JWT_SECRET

// 中介軟體middleware，用於檢查授權(authenticate)
export default function authenticate(req, res, next) {
  // 從header中取得存取令牌(Bearer Token)
  // const token = req.headers['authorization']

  // 從cookie中取得存取令牌
  const token = req.cookies.accessToken

  // 如果沒有存取令牌，回傳錯誤訊息
  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: '授權失敗，沒有存取令牌',
    })
  }

  // verify的callback會帶有decoded payload(解密後的有效資料)，就是user的資料
  jsonwebtoken.verify(token, accessTokenSecret, (err, member) => {
    if (err) {
      return res.status(403).json({
        status: 'error',
        message: '不合法的存取令牌',
      })
    }

    // 將user資料加到req中
    req.member = member
    next()
  })
}
