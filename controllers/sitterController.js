import db from '../config/mysql.js'

export const createSitter = async (req, res) => {
  try {
    const memberId = req.member.id
    const { name, area, service_time, experience, introduction, price } =
      req.body

    // ✅ 欄位檢查
    if (
      !name ||
      !area ||
      !service_time ||
      !experience ||
      !introduction ||
      !price
    ) {
      return res
        .status(400)
        .json({ status: 'error', message: '欄位未填寫完整' })
    }

    // 🔒 每個會員只能新增一位保母
    const [existing] = await db.query(
      'SELECT id FROM sitters WHERE member_id = ?',
      [memberId]
    )
    if (existing.length > 0) {
      return res
        .status(400)
        .json({ status: 'error', message: '每位會員只能新增一位保母' })
    }

    // 📷 處理圖片上傳
    const avatar = req.files?.avatar?.[0]?.filename || null
    const avatar_url = avatar ? `/images/${avatar}` : null
    const gallery =
      req.files?.gallery?.map((f) => `/sitter/${f.filename}`) || []

    // ✅ 寫入 sitters 資料表
    const insertSql = `
      INSERT INTO sitters 
        (member_id, name, area, service_time, experience, introduction, price, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    const values = [
      memberId,
      name,
      area,
      service_time,
      experience,
      introduction,
      price,
      avatar_url,
    ]
    const [result] = await db.query(insertSql, values)
    const sitterId = result.insertId

    // ✅ 寫入 sitter_gallery
    for (const imageUrl of gallery) {
      await db.query(
        'INSERT INTO sitter_gallery (sitter_id, image_url) VALUES (?, ?)',
        [sitterId, imageUrl]
      )
    }

    // ✅ 查詢剛新增的 sitter 資料回傳
    const [sitterRows] = await db.query(
      'SELECT id, name, area, service_time, experience, introduction, price, avatar_url FROM sitters WHERE id = ?',
      [sitterId]
    )

    res.status(201).json({
      status: 'success',
      sitter: sitterRows[0], // ✅ 回傳完整 sitter 給前端
      gallery, // 如需使用可保留
    })
  } catch (err) {
    console.error('新增保母失敗:', err)
    res.status(500).json({ status: 'error', message: '伺服器錯誤' })
  }
}

// 修改保母資料（只能修改自己的）
export const updateSitter = async (req, res) => {
  try {
    const memberId = req.member.id
    const sitterId = req.params.id
    const { name, area, service_time, experience, introduction, price } =
      req.body

    // 🔒 1. 確認保母是否存在且是自己
    const [rows] = await db.query(
      'SELECT * FROM sitters WHERE id = ? AND member_id = ?',
      [sitterId, memberId]
    )

    if (rows.length === 0) {
      return res
        .status(403)
        .json({ status: 'error', message: '無權限修改這筆資料' })
    }

    const oldData = rows[0]

    // 📸 2. 處理圖片上傳
    let avatarUrl = oldData.avatar_url
    const avatarFile = req.files?.avatar?.[0]
    if (avatarFile) {
      avatarUrl = `/images/${avatarFile.filename}`
      // 👉 你可以選擇刪除舊圖（選擇性）
    }

    const galleryFiles = req.files?.gallery || []

    // 📝 3. 更新文字欄位 & avatar
    const sql = `
      UPDATE sitters
      SET name = ?, area = ?, service_time = ?, experience = ?, introduction = ?, price = ?, avatar_url = ?
      WHERE id = ? AND member_id = ?
    `
    const values = [
      name,
      area,
      service_time,
      experience,
      introduction,
      price,
      avatarUrl,
      sitterId,
      memberId,
    ]

    await db.query(sql, values)

    // 🖼️ 4. 新增新的 gallery 圖片（不刪除原本的）
    for (const file of galleryFiles) {
      const imageUrl = `/sitter/${file.filename}`
      await db.query(
        'INSERT INTO sitter_gallery (sitter_id, image_url) VALUES (?, ?)',
        [sitterId, imageUrl]
      )
    }

    res.json({ status: 'success', message: '保母資料已更新' })
  } catch (err) {
    console.error('更新保母失敗:', err)
    res.status(500).json({ status: 'error', message: '伺服器錯誤，請稍後再試' })
  }
}
// 刪除保母（只能刪除自己的）
export const deleteSitter = async (req, res) => {
  try {
    const memberId = req.member.id
    const sitterId = req.params.id

    // 檢查這筆保母是否是此會員的
    const [sitter] = await db.query(
      'SELECT id FROM sitters WHERE id = ? AND member_id = ?',
      [sitterId, memberId]
    )

    if (sitter.length === 0) {
      return res
        .status(403)
        .json({ status: 'error', message: '無權限刪除這筆資料' })
    }

    await db.query('DELETE FROM sitters WHERE id = ? ', [sitterId])

    res.json({ status: 'success', message: '保母已刪除' })
  } catch (err) {
    console.error('刪除保母失敗:', err)
    res.status(500).json({ status: 'error', message: '伺服器錯誤' })
  }
}

// 取得目前會員自己的保母（最多一筆）
export const getMemberSitter = async (req, res) => {
  try {
    const memberId = req.member.id //正式版

    console.log('🚀 查詢 member_id =', memberId)
    const [rows] = await db.query(
      'SELECT * FROM sitters WHERE member_id = ? LIMIT 1',
      [memberId]
    )

    if (rows.length === 0) {
      return res.json({ status: 'success', sitter: null })
    }

    res.json({ status: 'success', sitter: rows[0] })
  } catch (err) {
    console.error('查詢保母失敗:', err)
    res.status(500).json({ status: 'error', message: '伺服器錯誤' })
  }
}
