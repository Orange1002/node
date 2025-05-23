import express from 'express'
const router = express.Router()
import { isDev } from '../lib/utils.js'

// 設定回傳路由
import { serverConfig } from '../config/server.config.js'
const callbackUrl = isDev
  ? serverConfig.ship711.development.callbackUrl
  : serverConfig.ship711.production.callbackUrl

// 註: 本路由與資料庫無關，單純轉向使用

// POST
router.post('/711', function (req, res) {
  res.redirect(callbackUrl + '?' + new URLSearchParams(req.body).toString())
})

export default router
