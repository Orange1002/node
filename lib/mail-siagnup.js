import nodemailer from 'nodemailer'
import { serverConfig } from '../config/server.config.js'
import { isDev } from './utils.js'

// 取得config檔案中的smtp設定
const { host, user, pass, provider } = serverConfig.smtp

// 使用gmail寄送
const gmail = {
  host,
  port: 465,
  secure: true, // use TLS
  //在專案的 .env 檔案中定義關於寄送郵件的 process.env 變數
  auth: {
    user,
    pass,
  },
  tls: {
    servername: 'smtp.gmail.com',
    rejectUnauthorized: false,
  },
}

// 使用 https://ethereal.email/
const ethereal = {
  host,
  port: 587,
  auth: {
    user,
    pass,
  },
}

// 定義所有email的寄送伺服器位置
const transport = provider === 'gmail' ? gmail : ethereal

const otpMailHtml = (otpToken, secret) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>信箱驗證碼 OTP Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f6f6f6;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color: #ed784a; /* Corporate color */
            padding: 20px;
            text-align: center;
        }
        .header img {
            max-width: 150px;
        }
        .content {
            padding: 20px;
        }
        .otp-code {
            display: flex;
            justify-content: center;
            text-align: center;
            font-size: 40px;
            font-weight: bold;
            color: #ed784a;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 10px;
            font-size: 12px;
            color: #777777;
        }
        .BARK{
            font-size: 40px;
            color: #ffffff;
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <p class="BARK">BARK & BIJOU</p>
            <h1 style="color: #ffffff;">一次性驗證碼(OTP)</h1>
        </div>
        <div class="content">
            <p>親愛的網站會員 您好，</p>
            <p>您的一次性驗證碼(OTP code)如下:</p>
            <div class="otp-code">${otpToken}</div>
            <p>請在您目前的註冊頁面中的"驗證碼"輸入框進行輸入。或是從以下的連結連入頁面:</p>
            <p><a href="${serverConfig.nextUrl}/member/login?type=signup/secret=${secret}" target="_blank">信箱驗證頁面連結</a></p>
            <p>請注意驗證碼將於寄送後5分鐘後到期，如有任何問題請洽網站客服人員。</p>
        </div>
        <div class="footer">
            <p>&copy; 2025 BARK & BIJOU.</p>
        </div>
    </div>

</body>
</html>
`
// 電子郵件文字訊息樣版
const otpMailText = (otpToken, secret) => `親愛的會員 您好，
通知信箱驗證所需要的驗證碼，
請輸入以下的6位數字，註冊頁面的"驗證碼"欄位中。
    
${otpToken}

或是點選以下連結:

<a href="${serverConfig.nextUrl}/member/login?type=signup&secret=${secret}">
    
請注意驗證碼將於寄送後5分鐘後到期，如有任何問題請洽網站客服人員:

敬上

BARK & BIJOU`

// 測試用一般寄送
export const sendOtpMail = async (to, otpToken, secret = '') => {
  if (isDev) console.log(otpToken)
  // 寄送email
  const mailOptions = {
    // 這裡要改寄送人
    from: user, // sender address
    to: to, // list of receivers
    subject: '信箱驗證的一次性驗證碼(OTP)',
    text: otpMailText(otpToken, secret),
    html: otpMailHtml(otpToken, secret),
  }

  // 呼叫transport函式
  const transporter = nodemailer.createTransport(transport)

  // 寄送email
  try {
    const info = await transporter.sendMail(mailOptions)
    if (isDev) console.log('Message sent: ', info.messageId)
  } catch (err) {
    console.log(err)
    throw new Error('無法寄送email')
  }
}
