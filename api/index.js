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
const whiteList = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')

// Socket.IO 初始化
const io = new SocketIO(server, {
  cors: {
    origin: whiteList,
    methods: ['GET', 'POST'],
    credentials: true, // 允許跨域請求攜帶 cookie
  },
})

// JWT 驗證函式
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    console.error('JWT 驗證失敗:', err.message); // 打印具體的 JWT 錯誤訊息
    return null
  }
}

// Socket.IO 認證中介軟體 (使用方法二：直接讀取 httpOnly cookie)
io.use((socket, next) => {
  const cookiesHeader = socket.request.headers.cookie;

  if (!cookiesHeader) {
    console.warn('Socket.IO 連線請求中缺少 Cookie 標頭');
    return next(new Error('缺少登入憑證 (Cookie 不存在)。請先登入。'));
  }

  const parsedCookies = cookie.parse(cookiesHeader);
  const token = parsedCookies.accessToken;

  console.log('從 Socket.IO 握手請求的 Cookie 中解析出的 token:', token ? '已取得' : '未取得');

  if (!token) {
    return next(new Error('JWT 驗證失敗：Cookie 中無 accessToken。請先登入。'));
  }

  const member = verifyToken(token);
  if (!member) {
    return next(new Error('JWT 驗證失敗：Token 無效或過期。請重新登入。'));
  }

  console.log('驗證成功的會員資料:', member);
  socket.member = member; // 將會員資料附加到 socket 物件
  next();
});

// Socket.IO 連線與訊息處理邏輯
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  console.log(`Connected member: ${socket.member.account}`); // 顯示驗證成功的會員帳號

  // 連線時，發送當前所有歷史訊息給新連線的客戶端
  // 也可以考慮只發送最近的 N 條訊息
  socket.emit('chat message', {
    id: 'system-welcome', // 系統訊息的 ID
    user: 'System', // 系統用戶
    text: `歡迎 ${socket.member.account} 加入聊天室！`,
    createdAt: new Date().toISOString(),
  });
  messages.forEach(msg => {
      socket.emit('chat message', msg);
  });

  // 監聽客戶端發送的 'chat message' 事件
  socket.on('chat message', (msg) => {
    if (!msg || !msg.text || typeof msg.text !== 'string' || msg.text.trim() === '') {
      console.warn(`無效訊息來自 ${socket.id}:`, msg);
      socket.emit('error message', '訊息內容不能為空！');
      return;
    }

    const newMsg = {
      id: Date.now(), // 給予一個獨特的 ID
      user: socket.member.account, // 使用驗證後的會員帳號作為用戶名
      text: msg.text.trim(),
      createdAt: new Date().toISOString(),
    };

    messages.push(newMsg); // 將訊息儲存到伺服器端的陣列

    // 將新訊息廣播給所有連線的客戶端
    io.emit('chat message', newMsg);
    console.log(`新訊息來自 ${newMsg.user}: ${newMsg.text}`);
  });

  // 監聽客戶端斷開連線事件
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Express 中介軟體設定
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true)
      if (whiteList.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        console.error(`CORS: Origin ${origin} is not allowed`);
        callback(new Error('Not allowed by CORS'))
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  })
)

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
  sessionStore = new RedisStore({ client: redisClient, prefix: 'express-vercel:' })
} else {
  const FileStore = sessionFileStore(session)
  sessionStore = new FileStore({ logFn: () => { } })
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
const topLevelFilenames = await fs.promises.readdir(routePath)

for (const filename of topLevelFilenames) {
  const fullPath = path.join(routePath, filename)
  const stats = fs.statSync(fullPath)

  if (stats.isFile()) {
    const item = await import(pathToFileURL(fullPath))
    const slug = filename.split('.')[0]
    app.use(`${apiPath}/${slug === 'index' ? '' : slug}`, item.default)
    console.log(`掛載路由: ${apiPath}/${slug === 'index' ? '' : slug}`);
  } else if (stats.isDirectory()) {
    const subFilenames = await fs.promises.readdir(fullPath)
    for (const subFilename of subFilenames) {
      const subFullPath = path.join(fullPath, subFilename)
      const subStats = fs.statSync(subFullPath)
      if (subStats.isFile()) {
        const item = await import(pathToFileURL(subFullPath))
        const subSlug = subFilename.split('.')[0]
        app.use(`${apiPath}/${filename}/${subSlug === 'index' ? '' : subSlug}`, item.default)
        console.log(`掛載路由: ${apiPath}/${filename}/${subSlug === 'index' ? '' : subSlug}`);
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
    stack: req.app.get('env') === 'development' ? err.stack : undefined
  })
})

const port = process.env.PORT || 3000
server.listen(port, () => console.log(`Server ready on port ${port}.`))

export default app

// import * as fs from 'fs'
// import cookieParser from 'cookie-parser'
// import cors from 'cors'
// import createError from 'http-errors'
// import express from 'express'
// import logger from 'morgan'
// import path from 'path'
// import session from 'express-session'
// import { createServer } from 'http'
// import { Server as SocketIO } from 'socket.io'
// import RedisStore from 'connect-redis'
// import { createClient } from 'redis'
// import sessionFileStore from 'session-file-store'
// import { serverConfig } from '../config/server.config.js'
// import { pathToFileURL } from 'url'
// import 'dotenv/config.js'
// import chatRouter from '../routes/article/chat.js'
// import memberRouter from '../routes/member/login.js' // 你這路徑可能要依實際調整

// import jwt from 'jsonwebtoken'
// import cookie from 'cookie'
// // 建立 Express 應用程式與 HTTP Server
// const app = express()
// const server = createServer(app)

// // 伺服器端暫存聊天室訊息陣列，供 REST API 路由與 Socket.IO 共用
// const messages = []
// const whiteList = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')
// // Socket.IO 初始化
// const io = new SocketIO(server, {
//   cors: {
//     origin: whiteList,
//     methods: ['GET', 'POST'],
//     credentials: true,
//   },
// })

// function verifyToken(token) {
//   try {
//     return jwt.verify(token, process.env.JWT_SECRET)
//   } catch (err) {
//     return null
//   }
// }
// io.use((socket, next) => {
//   const token = socket.handshake.auth.token
//   console.log('socket.auth.token:', socket.handshake.auth.token)

//   if (!token) return next(new Error('缺少 token'))

//   const member = verifyToken(token)
//   if (!member) return next(new Error('JWT 驗證失敗'))
//   console.log('驗證成功的會員資料:', member)
//   socket.member = member
//   next()
// })

// // CORS 白名單設定



// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // 如果是非瀏覽器的請求（例如 Postman、server），origin 會是 undefined，這裡可判斷允許
//       if (!origin) return callback(null, true)

//       if (whiteList.indexOf(origin) !== -1) {
//         callback(null, true)
//       } else {
//         callback(new Error('Not allowed by CORS'))
//       }
//     },
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//     credentials: true,
//   })
// )

// app.use(logger('dev'))
// app.use(express.json())
// app.use(express.urlencoded({ extended: false }))
// app.use(cookieParser())
// app.use(express.static(path.join(process.cwd(), 'public')))

// // Session Store 設定
// let sessionStore = null

// if (serverConfig.sessionStoreType === 'redis') {
//   const redisClient = createClient({ url: process.env.REDIS_URL })
//   redisClient.connect().catch(console.error)
//   sessionStore = new RedisStore({ client: redisClient, prefix: 'express-vercel:' })
// } else {
//   const FileStore = sessionFileStore(session)
//   sessionStore = new FileStore({ logFn: () => { } })
// }

// const isDev = process.env.NODE_ENV === 'development'

// const options = isDev
//   ? { maxAge: 30 * 86400000 }
//   : {
//     domain: serverConfig.domain,
//     maxAge: 30 * 86400000,
//     httpOnly: true,
//     secure: true,
//     sameSite: 'none',
//   }

// if (!isDev) app.set('trust proxy', 1)

// app.use(
//   session({
//     store: sessionStore,
//     name: 'SESSION_ID',
//     secret: process.env.SESSION_SECRET || 'default-secret-string',
//     proxy: !isDev,
//     cookie: options,
//     resave: false,
//     saveUninitialized: false,
//   })
// )

// // middleware 把 messages 注入 req 方便 router 使用
// app.use((req, res, next) => {
//   req.messages = messages
//   next()
// })

// // 根路由簡單回應
// app.get('/', (req, res) => res.send('Express server is running.'))

// // 自動讀取 routes 資料夾並掛載路由（包含你的 chat 路由）
// const apiPath = '/api'
// const routePath = path.join(process.cwd(), 'routes')
// const filenames = await fs.promises.readdir(routePath)

// for (const filename of filenames) {
//   const stats = fs.statSync(path.join(routePath, filename))
//   if (stats.isFile()) {
//     const item = await import(pathToFileURL(path.join(routePath, filename)))
//     const slug = filename.split('.')[0]
//     app.use(`${apiPath}/${slug === 'index' ? '' : slug}`, item.default)
//   }
//   if (stats.isDirectory()) {
//     const subFilenames = await fs.promises.readdir(path.join(routePath, filename))
//     for (const subFilename of subFilenames) {
//       const subStats = fs.statSync(path.join(routePath, filename, subFilename))
//       if (subStats.isFile()) {
//         const item = await import(pathToFileURL(path.join(routePath, filename, subFilename)))
//         const slug = subFilename.split('.')[0]
//         app.use(`${apiPath}/${filename}/${slug === 'index' ? '' : slug}`, item.default)
//       }
//     }
//   }
// }


// // 404 錯誤處理
// app.use((req, res, next) => {
//   next(createError(404))
// })

// // 錯誤處理中介軟體
// app.use((err, req, res, next) => {
//   res.locals.message = err.message
//   res.locals.error = req.app.get('env') === 'development' ? err : {}
//   res.status(err.status || 500)
//   res.json({ error: err.message || 'Internal Server Error' })
// })

// const port = process.env.PORT || 3000
// server.listen(port, () => console.log(`Server ready on port ${port}.`))

// export default app

