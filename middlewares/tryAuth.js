import jwt from 'jsonwebtoken'
export default function tryAuth(req, res, next) {
  const token = req.cookies.accessToken

  if (!token) return next()

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.member = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
    }
  } catch (err) {
    // 驗證失敗也不報錯，只是不設 req.member
  }

  next()
}
