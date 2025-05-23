import db from '../config/mysql.js'
import fs from 'fs'
import path from 'path'

// 你要插入的圖片數量與來源
const imageFiles = ['dog1.jpg', 'dog2.jpg'] // 圖片來源，可是你事先放好的圖

const saveImages = (files) => {
  const savedPaths = []

  for (const file of files) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '')
    const ext = path.extname(file)
    const newFileName = `${timestamp}${ext}`
    const srcPath = path.resolve('seeds/images', file)
    const destPath = path.resolve(
      'public/article_upload/article_img',
      newFileName
    )

    try {
      fs.copyFileSync(srcPath, destPath)
      savedPaths.push(`/article_img/${newFileName}`)
    } catch (err) {
      console.error(`❌ 圖片複製失敗: ${file}`, err)
    }
  }

  return savedPaths
}

;(async () => {
  try {
    const title = '新手養狗一定要知道的事：散步小撇步大公開！'
    const subtitle1 = '牽繩握法有訣竅，握好才不會受傷！'
    const subtitle2 = '高品質散步，就從緩步慢行開始'
    const subtitle3 = '「眼觀八方」提早遠離刺激物，就能避免刺激狀況發生'
    const member_username = '小善 Edward'

    const content1 = `首先要提醒，如果狗狗散步還不穩定，建議將牽繩扣在胸背上，而非項圈，一來避免過度拉扯傷到狗狗氣管，二來是拉扯項圈的壓迫會累積成壓力，反而讓狗狗無法好好享受散步。

再來是牽繩的握法，你也是用類似單手提袋子的方式握住牽繩嗎？這種握法當狗狗暴衝時，不僅瞬間的拉扯可能讓你的手受傷，也很難在當下控制住狗狗，有些人可能因此鬆手，有時甚至一個不穩而摔倒。

比較好的握法是：握住握把的手像比讚一樣，以大拇指卡進繩頭，四根手指頭握住握把下方，可以確保繩子不會鬆脫；另一隻手則握住下方的繩子，用以控制長度，並將雙手貼近身體，就能穩如泰山！（如有很嚴重暴衝狀況，還是建議尋找專業協助喔！）`
    const content2 = `許多毛爸媽都知道散步是為了讓狗狗盡情嗅聞，消耗心力體力，釋放日常壓力。也都努力的讓牽繩維持適當的鬆緊，呈現微笑曲線，但偏偏狗狗就是一個勁地往前衝，拉也拉不住，該怎辦？

記住！這時候盡量不要將繩子越縮越短，或是拉到完全緊繃，這樣可能會讓狗狗累積更多的壓力。當你已經採取上述牽繩握法，遇到狗狗使勁往前加速時，可以嘗試堅定的停下腳步，狗狗自然會跟著停下，此時牠可能會回頭疑惑地看你，等你的下一步，這時可以口頭輕撫狗狗，並再慢慢的邁出步伐，用像是老人家走路的速度，緩～慢～地散步。如果狗狗又試圖往前衝，你就再停下腳步維持不動，久而久之，狗狗會知道要配合主人步伐，自然的慢了下來，也更有餘裕展開嗅聞。`
    const content3 = `每隻狗狗個性不同，散步要注意的狀況也不同，有些狗狗把散步當成 Buffet，吃遍各種東西；有些狗狗看到松鼠、老鼠、鳥就要追；有些則是一有車子經過就發狂吠叫...等等，總逼得主人大叫「不可以！」，但這些行為源於狗狗天性，對牠來說完全沒有問題，很多時候我們叫破了喉嚨狗狗也無動於衷。

但其實不管何種狀況，只要學會「眼觀八方」，比狗狗更早看見刺激物，搭配縮短牽繩、帶領狗狗繞離刺激物，就能避免這些狀況發生。當遠離刺激物時，就可以重新放鬆牽繩。除此之外，當人眼比不過狗鼻的夜晚時刻，就得靠日常記憶，例如哪個巷口總有機車突然出現、哪個草叢總很多食物...等等，盡量繞離那些區域。

看似簡單的三個小撇步，但一定要每天不斷實踐與練習，就能讓你跟狗狗都能擁有悠閒的散步時光。`

    const [articleResult] = await db.execute(
      `INSERT INTO article
        (title, subtitle1, content1, subtitle2, content2, subtitle3, content3, member_username)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        subtitle1,
        content1,
        subtitle2,
        content2,
        subtitle3,
        content3,
        member_username,
      ]
    )

    const articleId = articleResult.insertId
    console.log('✅ 寫入成功，文章 ID:', articleId)

    // 儲存圖片並寫入路徑到資料庫
    const imagePaths = saveImages(imageFiles)

    for (const imagePath of imagePaths) {
      await db.execute(
        `INSERT INTO article_images (article_id, image_path) VALUES (?, ?)`,
        [articleId, imagePath]
      )
    }

    console.log('✅ 圖片寫入成功:', imagePaths)
    process.exit()
  } catch (err) {
    console.error('❌ 寫入失敗:', err)
    process.exit(1)
  }
})()

// import db from '../config/mysql.js'
// ;(async () => {
//   try {
//     const title = '新手養狗一定要知道的事：散步小撇步大公開！'
//     const subtitle1 = '牽繩握法有訣竅，握好才不會受傷！'
//     const subtitle2 = '高品質散步，就從緩步慢行開始'
//     const subtitle3 = '「眼觀八方」提早遠離刺激物，就能避免刺激狀況發生'

//     const content1 = `首先要提醒，如果狗狗散步還不穩定，建議將牽繩扣在胸背上，而非項圈，一來避免過度拉扯傷到狗狗氣管，二來是拉扯項圈的壓迫會累積成壓力，反而讓狗狗無法好好享受散步。

// 再來是牽繩的握法，你也是用類似單手提袋子的方式握住牽繩嗎？這種握法當狗狗暴衝時，不僅瞬間的拉扯可能讓你的手受傷，也很難在當下控制住狗狗，有些人可能因此鬆手，有時甚至一個不穩而摔倒。

// 比較好的握法是：握住握把的手像比讚一樣，以大拇指卡進繩頭，四根手指頭握住握把下方，可以確保繩子不會鬆脫；另一隻手則握住下方的繩子，用以控制長度，並將雙手貼近身體，就能穩如泰山！（如有很嚴重暴衝狀況，還是建議尋找專業協助喔！）`

//     const content2 = `許多毛爸媽都知道散步是為了讓狗狗盡情嗅聞，消耗心力體力，釋放日常壓力。也都努力的讓牽繩維持適當的鬆緊，呈現微笑曲線，但偏偏狗狗就是一個勁地往前衝，拉也拉不住，該怎辦？

// 記住！這時候盡量不要將繩子越縮越短，或是拉到完全緊繃，這樣可能會讓狗狗累積更多的壓力。當你已經採取上述牽繩握法，遇到狗狗使勁往前加速時，可以嘗試堅定的停下腳步，狗狗自然會跟著停下，此時牠可能會回頭疑惑地看你，等你的下一步，這時可以口頭輕撫狗狗，並再慢慢的邁出步伐，用像是老人家走路的速度，緩～慢～地散步。如果狗狗又試圖往前衝，你就再停下腳步維持不動，久而久之，狗狗會知道要配合主人步伐，自然的慢了下來，也更有餘裕展開嗅聞。`

//     const content3 = `每隻狗狗個性不同，散步要注意的狀況也不同，有些狗狗把散步當成 Buffet，吃遍各種東西；有些狗狗看到松鼠、老鼠、鳥就要追；有些則是一有車子經過就發狂吠叫...等等，總逼得主人大叫「不可以！」，但這些行為源於狗狗天性，對牠來說完全沒有問題，很多時候我們叫破了喉嚨狗狗也無動於衷。

// 但其實不管何種狀況，只要學會「眼觀八方」，比狗狗更早看見刺激物，搭配縮短牽繩、帶領狗狗繞離刺激物，就能避免這些狀況發生。當遠離刺激物時，就可以重新放鬆牽繩。除此之外，當人眼比不過狗鼻的夜晚時刻，就得靠日常記憶，例如哪個巷口總有機車突然出現、哪個草叢總很多食物...等等，盡量繞離那些區域。

// 看似簡單的三個小撇步，但一定要每天不斷實踐與練習，就能讓你跟狗狗都能擁有悠閒的散步時光。`

//     const member_name = '小善 Edward'

//     const [result] = await db.execute(
//       `INSERT INTO article
//       (title, subtitle1, content1, subtitle2, content2, subtitle3, content3, member_name)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//       [title, subtitle1, content1, subtitle2, content2, subtitle3, content3, member_name]
//     )

//     console.log('✅ 寫入成功，文章 ID:', result.insertId)
//     process.exit()
//   } catch (err) {
//     console.error('❌ 寫入失敗:', err)
//     process.exit(1)
//   }
// })()

// import db from '../config/mysql.js'
// ;(async () => {
//   try {
//     const username = 'Loewy'
//     const email = 'test@gmail.com'
//     const password = '12345'
//     const phone = '0912345678'

//     const gender_id = `1`

//     const vip_levels_id = `1`

//     const created_at = `2025/5/19`

//     const [result] = await db.execute(
//       `INSERT INTO member
//       (username, email, password, phone, gender_id, vip_levels_id, created_at)
//       VALUES (?, ?, ?, ?, ?, ?, ?)`,
//       [username, email, password, phone, gender_id, vip_levels_id, created_at]
//     )

//     console.log('✅ 寫入成功，會員 ID:', result.insertId)
//     process.exit()
//   } catch (err) {
//     console.error('❌ 寫入失敗:', err)
//     process.exit(1)
//   }
// })()
