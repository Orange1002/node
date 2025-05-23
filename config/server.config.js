import 'dotenv/config.js'

const env = process.env.NODE_ENV || 'development'

export const serverConfig = {
  // 如果要使用redis session store類型，必需要在 .env 檔案中設定 REDIS_URL
  // 這裡判斷是否為開發環境，如果是開發環境，就使用file session store
  sessionStoreType: env === 'development' ? 'file' : 'redis', // file | redis
  // 前端網址
  nextUrl:
    env === 'development'
      ? 'http://localhost:3000'
      : 'https://xxxxx.vercel.app',
  // 後端伺服器佈置後的網域名稱，與cookie有關
  domain: env === 'development' ? '' : 'xxxxxx.vercel.app',
  // ethereal
  smtp: {
    provider: 'ethereal',
    host: 'smtp.ethereal.email',
    user: 'mittie.daniel91@ethereal.email',
    pass: 'b6en9s7EqjP9EPVKkd',
  },
  // gmail
  // smtp: {
  //   provider: 'gmail',
  //   host: 'smtp.gmail.com',
  //   user: 'xxxxxx@gmail.com',
  //   pass: 'xxxxxxxx',
  // },
  jwt: {
    secret: 'access_token_secret',
  },
  otp: {
    secret: 'otp_secret',
    expire: 5 * 60 * 1000, // 5 分鐘
  },
  // local development
  lineLogin: {
    development: {
      channelId: '123456789',
      channelSecret: 'xxxxxxxxxxxx',
      callbackUrl: 'http://localhost:3000/user/line-login',
    },
    production: {
      channelId: '',
      channelSecret: '',
      callbackUrl: 'https://xxxxx.vercel.app/user/line-login',
    },
  },
  // 前端接回導向的網址
  ship711: {
    development: {
      callbackUrl: 'http://localhost:3000/ship/callback',
    },
    production: {
      callbackUrl: 'https://xxxxx.vercel.app/ship/callback',
    },
  },
  linePay: {
    development: {
      channelId: '123456789',
      channelSecret: 'xxxxxxxxxxxx',
      confirmUrl: 'http://localhost:3000/line-pay',
      cancelUrl: 'http://localhost:3000/line-pay/cancel',
    },
    production: {
      channelId: '',
      channelSecret: '',
      confirmUrl: 'https://next-app-raw.vercel.app/line-pay',
      cancelUrl: 'https://next-app-raw.vercel.app/line-pay/cancel',
    },
  },
  // 目前沒有使用這個設定，直接寫在 routes/ecpay-test-only.js 中
  // ecpay: {
  //   test: true,
  //   merchantId: '3002607',
  //   hashKey: 'pwFHCqoQZGmho4w6',
  //   hashIV: 'EkRm7iFT261dpevs',
  //   returnUrl: 'http://localhost:3005/test/ecpay/callback',
  //   clientOrderResultUrl: 'http://localhost:3005/api/ecpay/result',
  //   orderCallbackUrl: 'http://localhost:3000/test/ecpay/callback',
  // },
}
