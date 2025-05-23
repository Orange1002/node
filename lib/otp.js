import * as OTPAuth from 'otpauth'
import { serverConfig } from '../config/server.config.js'

// 伺服器端的secret
const otpSecret = serverConfig.otpSecret

// Generate a token (returns the current token as a string).
export const generateToken = (
  secretString = '',
  issuer = 'EXPRESS_SERVER',
  label = 'user'
) => {
  let secret = secretString

  if (secretString === '') {
    secret = new OTPAuth.Secret({ size: 20 })
  } else {
    secret = OTPAuth.Secret.fromLatin1(secretString + otpSecret)
  }
  // 建立新的 TOTP 物件
  // 註: issuer和label是當需要整合Google Authenticator使用的
  const totp = new OTPAuth.TOTP({
    issuer: issuer,
    label: label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    // Arbitrary key encoded in base32 or OTPAuth.Secret instance
    // (if omitted, a cryptographically secure random secret is generated).
    secret: secret,
  })

  const token = totp.generate()

  return {
    totp: totp, // totp 物件
    token: token, // token 字串
    uri: totp.toString(), // uri 字串，整合Google Authenticator使用
  }
}
