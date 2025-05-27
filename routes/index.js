import express from 'express'
const router = express.Router()

/* GET home page. */
router.get('/', function (req, res) {
  res.status(200).json({ status: 'success', message: 'Express(path: /api)' })
})

export default router
