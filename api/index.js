import * as fs from 'fs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import createError from 'http-errors'
import express from 'express'
import logger from 'morgan'
import path from 'path'
import session from 'express-session'
// 使用redis的session store
import RedisStore from 'connect-redis'
import { createClient } from 'redis'
// 使用檔案的session store，預設是存在sessions資料夾
import sessionFileStore from 'session-file-store'
import { serverConfig } from '../config/server.config.js'

// 修正 ESM 中的 __dirname 與 windows os 中的 ESM dynamic import
import { pathToFileURL } from 'url'
// import { fileURLToPath, pathToFileURL } from 'url'
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

import 'dotenv/config.js'

// 建立 Express 應用程式
const app = express()

// cors設定，參數為必要，注意不要只寫`app.use(cors())`
// 設定白名單，只允許特定網址存取
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
const whiteList = frontendUrl.split(',')
// 設定CORS
app.use(
  cors({
    origin: whiteList,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  })
)

// 視圖引擎設定(使用pug)，不使用視圖引擎，所以註解掉
// res.render()會找views資料夾中的pug檔案
// app.set('views', path.join(process.cwd(), 'views'))
// app.set('view engine', 'pug')

// 記錄HTTP要求
app.use(logger('dev'))
// 剖析 POST 與 PUT 要求的JSON格式資料
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
// 剖折 Cookie 標頭與增加至 req.cookies
app.use(cookieParser())
// 在 public 的目錄，提供影像、CSS 等靜態檔案
app.use(express.static(path.join(process.cwd(), 'public')))

let sessionStore = null

if (serverConfig.sessionStoreType === 'redis') {
  // 使用redis記錄session
  let redisClient = createClient({
    url: process.env.REDIS_URL,
  })

  // 連線redis
  redisClient.connect().catch(console.error)

  // 初始化redisStore
  sessionStore = new RedisStore({
    client: redisClient,
    prefix: 'express-vercel:',
  })
} else {
  // 使用檔案記錄session
  const FileStore = sessionFileStore(session)
  sessionStore = new FileStore({ logFn: function () {} })
}

const isDev = process.env.NODE_ENV === 'development'

const options = isDev
  ? { maxAge: 30 * 86400000 }
  : {
      domain: serverConfig.domain,
      maxAge: 30 * 86400000, // session保存30天
      httpOnly: true, // 無法透過JavaScript讀取
      secure: true, // HTTPS才能使用
      sameSite: 'none', // 跨域時也能使用
    }

// vercel布置需要設定trust proxy，以便取得正確的IP
if (!isDev) app.set('trust proxy', 1)

app.use(
  session({
    store: sessionStore, // 使用檔案記錄session
    name: 'SESSION_ID', // cookie名稱，儲存在瀏覽器裡
    secret: '67f71af4602195de2450faeb6f8856c0', // 安全字串，應用一個高安全字串
    proxy: !isDev, // 是否信任反向代理，預設false
    cookie: options,
    resave: false,
    saveUninitialized: false,
  })
)

// 根路由預設測試畫面
app.get('/', (req, res) => res.send('Express server is running.'))

// 載入routes中的各路由檔案，並套用api路由 START
// 目前可以讀取routes資料夾中的所有檔案，最多至其中再一層的資料夾自動套用路由檔案，以下為範例:
//  routes/index.js ==> /api/
//  routes/user.js ==> /api/user
//  routes/user/login.js ==> /api/user/login
const apiPath = '/api' // 預設路由
const routePath = path.join(process.cwd(), 'routes')
const filenames = await fs.promises.readdir(routePath)

for (const filename of filenames) {
  // statSync同步取得檔案資訊，判斷是檔案或資料夾
  const stats = fs.statSync(path.join(routePath, filename))

  // 如果是檔案，直接載入並套用路由
  if (stats.isFile()) {
    const item = await import(pathToFileURL(path.join(routePath, filename)))
    const slug = filename.split('.')[0]
    app.use(`${apiPath}/${slug === 'index' ? '' : slug}`, item.default)
  }

  // 如果是資料夾，則再讀取資料夾內的檔案
  if (stats.isDirectory()) {
    const subFilenames = await fs.promises.readdir(
      path.join(routePath, filename)
    )

    // 讀取資料夾內的檔案，並以此資料夾名稱為次路由，再載入並套用路由
    for (const subFilename of subFilenames) {
      const subStats = fs.statSync(path.join(routePath, filename, subFilename))

      if (subStats.isFile()) {
        const item = await import(
          pathToFileURL(path.join(routePath, filename, subFilename))
        )
        const slug = subFilename.split('.')[0]
        app.use(
          `${apiPath}/${filename}/${slug === 'index' ? '' : slug}`,
          item.default
        )
      }
    }
  }
}
// 載入routes中的各路由檔案，並套用api路由 END

// 捕抓404錯誤處理
app.use(function (req, res, next) {
  next(createError(404))
})

// 錯誤處理函式
app.use(function (err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  // 更改為錯誤訊息預設為JSON格式
  res.status(500).send({ error: err })
})

const port = process.env.PORT || 3000

app.listen(port, () => console.log(`Server ready on port ${port}.`))

export default app
