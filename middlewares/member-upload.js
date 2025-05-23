import jwt from 'jsonwebtoken'
export default function authenticateMember(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ error: '未登入' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.member = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: '無效的 token' })
  }
}
