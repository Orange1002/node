import db from '../config/mysql.js'

export const getUserDogs = async (req, res) => {
  const memberId = req.member.id

  if (!memberId) {
    return res.status(401).json({ status: 'error', message: '未授權' })
  }

  try {
    const [rows] = await db.query(
      'SELECT id, name FROM dogs WHERE member_id = ?',
      [memberId]
    )

    if (rows.length === 0) {
      return res.json({ status: 'empty', dogs: [] })
    }

    res.json({ status: 'success', dogs: rows })
  } catch (err) {
    console.error('取得狗狗失敗:', err)
    res.status(500).json({ status: 'error', message: '無法取得狗狗資料' })
  }
}
