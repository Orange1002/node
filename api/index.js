import * as fs from 'fs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import createError from 'http-errors'
import express from 'express'
import logger from 'morgan'
import path from 'path'
import session from 'express-session'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import RedisStore from 'connect-redis'
import { createClient } from 'redis'
import sessionFileStore from 'session-file-store'
import { serverConfig } from '../config/server.config.js'
import { pathToFileURL } from 'url'
import 'dotenv/config.js' // 確保 dotenv 被載入以讀取 .env 檔案中的變數

import jwt from 'jsonwebtoken'
import cookie from 'cookie' // 確保已安裝並引入 'cookie' 函式庫

// 建立 Express 應用程式與 HTTP Server
const app = express()
const server = createServer(app)

// 伺服器端暫存聊天室訊息陣列，供 REST API 路由與 Socket.IO 共用
const messages = []

// CORS 白名單設定
const whiteList = (process.env.FRONTEND_URL || 'http://localhost:3000').split(
  ','
)

// Socket.IO 初始化
const io = new SocketIO(server, {
  cors: {
    origin: whiteList,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true, // 允許跨域請求攜帶 cookie
  },
})

// JWT 驗證函式
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    console.error('JWT 驗證失敗:', err.message) // 打印具體的 JWT 錯誤訊息
    return null
  }
}

// Socket.IO 認證中介軟體 (在每個 Socket.IO 連線握手前執行)
io.use((socket, next) => {
  const cookiesHeader = socket.request.headers.cookie

  if (!cookiesHeader) {
    console.warn('Socket.IO 連線請求中缺少 Cookie 標頭')
    return next(new Error('缺少登入憑證 (Cookie 不存在)。請先登入。'))
  }

  const parsedCookies = cookie.parse(cookiesHeader)
  const token = parsedCookies.accessToken

  console.log(
    '從 Socket.IO 握手請求的 Cookie 中解析出的 token:',
    token ? '已取得' : '未取得'
  )

  if (!token) {
    return next(new Error('JWT 驗證失敗：Cookie 中無 accessToken。請先登入。'))
  }

  const member = verifyToken(token)
  if (!member) {
    return next(new Error('JWT 驗證失敗：Token 無效或過期。請重新登入。'))
  } // 驗證成功的會員資料，確認其包含 id 和 name 欄位

  console.log('JWT 驗證成功的會員資料:', member) // 將會員資料附加到 socket 物件，以便後續的連線處理邏輯使用
  socket.member = member
  next() // 繼續建立 Socket.IO 連線
})

// Socket.IO 連線與訊息處理邏輯
// 這個監聽器必須在 io.use 中介軟體之外，才能在每次成功連線時觸發
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`) // 確保 socket.member 存在且包含 name 屬性
  console.log(`Connected member name: ${socket.member?.name || '未知名稱'}`) // 連線時，發送當前所有歷史訊息給新連線的客戶端 // 也可以考慮只發送最近的 N 條訊息

  socket.emit('chat message', {
    id: 'system-welcome', // 系統訊息的 ID
    user: 'System', // 系統用戶
    text: `歡迎 ${socket.member?.name || '新朋友'} 加入聊天室！`, // 使用 ?. 確保安全訪問
    createdAt: new Date().toISOString(), // 系統訊息不需要 userId，或者可以給一個特定的系統 userId
    userId: 'system',
  })
  messages.forEach((msg) => {
    socket.emit('chat message', msg)
  }) // 監聽客戶端發送的 'chat message' 事件

  socket.on('chat message', (msg) => {
    if (
      !msg ||
      !msg.text ||
      typeof msg.text !== 'string' ||
      msg.text.trim() === ''
    ) {
      console.warn(`無效訊息來自 ${socket.id}:`, msg)
      socket.emit('error message', '訊息內容不能為空！') // 發送錯誤訊息給發送者
      return
    }

    const newMsg = {
      id: Date.now(),
      user: socket.member?.name || '匿名用戶', // 使用 member.name 作為發送者名稱
      userId: socket.member?.id || null, // <-- **新增：將發送者的 ID 加入訊息物件**
      text: msg.text.trim(),
      createdAt: new Date().toISOString(),
    }
    messages.push(newMsg) // 將訊息儲存到伺服器端的陣列 // 將新訊息廣播給所有連線的客戶端

    io.emit('chat message', newMsg)
    console.log(`新訊息來自 ${newMsg.user}: ${newMsg.text}`)
  }) // 監聽客戶端斷開連線事件

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`)
  })
})

// Express 中介軟體設定
app.use((req, res, next) => {
  // 如果不是 7-11 callback，就跑 CORS middleware
  if (req.path !== '/api/shopcart/store-callback') {
    cors({
      origin: function (origin, callback) {
        if (!origin || whiteList.includes(origin)) {
          callback(null, true)
        } else {
          console.error(`CORS blocked: ${origin}`)
          callback(new Error('Not allowed by CORS'))
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true,
    })(req, res, next)
  } else {
    next()
  }
})

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(process.cwd(), 'public')))

// Session Store 設定
let sessionStore = null
if (serverConfig.sessionStoreType === 'redis') {
  const redisClient = createClient({ url: process.env.REDIS_URL })
  redisClient.connect().catch(console.error)
  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'express-vercel:',
  })
} else {
  const FileStore = sessionFileStore(session)
  sessionStore = new FileStore({ logFn: () => {} })
}

const isDev = process.env.NODE_ENV === 'development'

const options = isDev
  ? { maxAge: 30 * 86400000 }
  : {
      domain: serverConfig.domain,
      maxAge: 30 * 86400000,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    }

if (!isDev) app.set('trust proxy', 1)

app.use(
  session({
    store: sessionStore,
    name: 'SESSION_ID',
    secret: process.env.SESSION_SECRET || 'default-secret-string',
    proxy: !isDev,
    cookie: options,
    resave: false,
    saveUninitialized: false,
  })
)

// middleware 把 messages 注入 req 方便 router 使用
app.use((req, res, next) => {
  req.messages = messages
  next()
})

// 根路由簡單回應
app.get('/', (req, res) => res.send('Express server is running.'))

// 自動讀取 routes 資料夾並掛載路由
const apiPath = '/api'
const routePath = path.join(process.cwd(), 'routes')
// 使用 await fs.promises.readdir 確保非同步操作完成
const topLevelFilenames = await fs.promises.readdir(routePath)

for (const filename of topLevelFilenames) {
  const fullPath = path.join(routePath, filename)
  const stats = fs.statSync(fullPath)

  if (stats.isFile()) {
    // 使用 await import 確保模組載入完成
    const item = await import(pathToFileURL(fullPath))
    const slug = filename.split('.')[0]
    app.use(`${apiPath}/${slug === 'index' ? '' : slug}`, item.default)
    console.log(`掛載路由: ${apiPath}/${slug === 'index' ? '' : slug}`)
  } else if (stats.isDirectory()) {
    const subFilenames = await fs.promises.readdir(fullPath)
    for (const subFilename of subFilenames) {
      const subFullPath = path.join(fullPath, subFilename)
      const subStats = fs.statSync(subFullPath)
      if (subStats.isFile()) {
        const item = await import(pathToFileURL(subFullPath))
        const subSlug = subFilename.split('.')[0]
        app.use(
          `${apiPath}/${filename}/${subSlug === 'index' ? '' : subSlug}`,
          item.default
        )
        console.log(
          `掛載路由: ${apiPath}/${filename}/${
            subSlug === 'index' ? '' : subSlug
          }`
        )
      }
    }
  }
}

// 404 錯誤處理
app.use((req, res, next) => {
  next(createError(404, `API 路徑 ${req.originalUrl} 不存在`))
})

// 錯誤處理中介軟體
app.use((err, req, res, next) => {
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}
  res.status(err.status || 500)
  res.json({
    status: 'error',
    message: err.message,
    stack: req.app.get('env') === 'development' ? err.stack : undefined,
  })
})

const port = process.env.PORT || 3000
server.listen(port, () => console.log(`Server ready on port ${port}.`))

export default app
