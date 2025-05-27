import express from 'express'
import authenticateMember from '../../middlewares/Auth.js'

const router = express.Router()

router.get('/', authenticateMember, (req, res) => {
  res.json({
    id: req.member.id,
    username: req.member.username,
    email: req.member.email,
  })
})

export default router