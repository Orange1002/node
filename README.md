# Express Server

## 說明

本專案以Vercel提供的[express佈署範例](https://vercel.com/guides/using-express-with-vercel)為基礎，加入了[Prisma ORM](https://www.prisma.io/orm)，目的如下:

1. 快速建立一個REST API伺服器，提供各種可以立即使用的範例
2. 將你的專案成果，佈署REST API伺服器在Vercel雲端伺服器上(基本計劃為免費)
3. 移轉MySQL資料庫的程式到雲端PostgreSQL資料庫

如果使用本專案並使用Prisma ORM的開發方式，可以達成以上的目的。

但如果並非使用以上的方式，將可能無法達到這目的，或可能造成在執行期間的各種錯誤情況。

以下是幾種非正常應用的情況:

- 建立資料庫或操作資料表，只使用mysql2套件，與原本的`db.query`或`db.execute`方式，或是其它ORM、資料庫連接方式。這會造成資料庫無法移轉至雲端PostgreSQL資料庫
- 更動目錄結構或是重構其它功能，例如使用自訂的express啟動程式、中介軟體(middleware)或是自訂的路由(routes)。這會造成Vercel的部署失敗，或是無法正常運作

在這些情況下，會建議你另外建立一個全新的專案，本專案的內容將只能提供參考。

## 如何使用

### 安裝

1. git clone，或下載後，將`.env.example`改為`.env`檔案
2. `.env`中`DB_XXX`相關設定，需改為你的資料庫、帳號、密碼
3. `.env`中`DATABASE_URL`依照資料庫的帳號、密碼、主機、埠號、資料庫名稱填寫(參考範例): `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
4. 另外在config資料夾中有`server.config.js`，可以設定各種伺服器的設定，例如`smtp`、`jwt`，以及一些特殊應用如line-pay、line-login等等所需的設定

安裝所需專案套件:

```bash
npm i
```

### 初次執行&資料庫範例導入

以下的指令在執行後，會建立對應的資料表與範例資料(seeds)，以及ORM要使用的Prisma Client(客戶端):

> 注意: 這個指令會以目前的模型(model)與範例(seed)，完全重建整個資料庫。如果這並不是你要的(例如資料庫中是有需要保留的資料表結構或資料)，請勿執行這指令。

```bash
npm run build
```

> 注意: 如果之後不使用orm(prisma)開發，請勿執行`npm run build`，有可能會產生錯誤

## 佈署說明

安裝Vercel CLI:

```bash
npm i -g vercel
```

需要在vercel設定FRONTEND_URL，這是用來設定CORS的來源網址，這是在`.env`中設定的，可以用逗號分隔多個網址，例如:

```text
FRONTEND_URL=https://example1.com,https://www.example2.com
```

如果沒有設定 CORS 來源網址，瀏覽器在發送跨域請求時會遇到以下問題：

請求被阻擋：瀏覽器會自動阻擋跨域請求，並在控制台中顯示一條錯誤訊息，指出請求被 CORS 政策阻擋。

無法訪問資源：前端應用程式將無法訪問後端伺服器上的資源，導致功能無法正常運作，例如無法獲取數據或提交表單。

### 切換資料庫

需要在prisma的schema.prisma中，更改資料庫的連接方式，例如從MySQL改為PostgreSQL，或是其它資料庫。

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("POSTGRES_PRISMA_URL") 
  directUrl = env("POSTGRES_URL_NON_POOLING") 
}
```

注意，vercel的部署環境不支援file session store，所以在進行部署時，必須改使用redis session store，這是因為vercel的部署環境是無法存取本地端的檔案系統。

另外也在.env中設定`REDIS_URL`，這是要和`server.config.js`中的`sessionStoreType`對應，以下是一個範例:

```text
REDIS_URL="redis://default:lRmnKcoWSIar@redis-13656.c57.ec2.redns.redis-cloud.com:13656"
```

切換為redis資料庫，應用在session store上，這是要和本地端的file session store做對應:

```js
// config/server.config.js
export const serverConfig = {
  // if use redis session store type, .env file must set REDIS_URL
  sessionStoreType: 'file', // file | redis
  // ...
}
```

vercel的NODE_ENV環境變數是`production`，所以在`server.config.js`或其它檔案中，可以透過`process.env.NODE_ENV`來判斷是否為production環境，這樣可以設定不同的設定值。


### 其它指令



### 原始連結參考

- [express on vercel](https://github.com/vercel/examples/tree/main/solutions/express)

## 命名規則&設計準則

> 結論: 目的是提高`閱讀性`與`一致性`

以下出自[命名規則 (程式設計)-維基百科](<https://zh.wikipedia.org/zh-tw/%E5%91%BD%E5%90%8D%E8%A7%84%E5%88%99_(%E7%A8%8B%E5%BA%8F%E8%AE%BE%E8%AE%A1)>):

程式設計的命名規則(naming convention)是電腦程式設計的原始碼針對識別碼的名稱字串進行定義（即「命名」）而規定的一系列規則。通常是為了提高原始碼的易讀性、易認性、程式效率以及可維護性。

JavaScript 的內建庫採用與 Java 同樣的命名規則。資料類型和建造函式使用 upper camel case (RegExp, TypeError, XMLHttpRequest, DOMObject) 而方法使用 lower camel case (getElementById, getElementsByTagNameNS, createCDATASection)。為了保持統一，大部分 JavaScript 開發者都遵循此命名規則。

### 命名說明

#### 駝峰(Camel Case)

> 又稱`小駝峰`(lower camelCase)，為了區分PascalCase

以英文小寫字元開頭，如果是多個字詞之後以英文大寫開頭

例如: `firstName`或`lastName`

#### 蛇形(Snake Case)

全小寫英文字詞，在多個字詞間使用`下底線符號underscore`(\_)來分隔。

例如: `first_name`或`last_name`

#### 烤肉串(Kebab Case)

> 又稱dash-case, css-case, slug-case

全小寫英文字詞，在多個字詞間使用`連接符號hyphen`(\_)符號來分隔。

例如: `first-name`或`last-name`

#### 帕斯卡(Pascal Case)

> 又稱為`大駝峰`(UpperCamelCase)

以英文大寫字元開頭，如果是多個字詞之後以英文大寫開頭

例如: `FirstName` and `LastName`

#### 全大寫

也是蛇形命名的一種變形，但所有字詞都是全大寫的，又稱ALL_CAPS, SCREAMING_SNAKE_CASE, CONSTANT_CASE

### 資料庫 DB

為了與Prisma ORM盡可能達成一致，先理解Prisma中的預設命名:

- 資料表(table)命名: `PascalCase帕斯卡命名`，這會與模型(model)一致
- 欄位(column)命名: 預設是`camelCase駝峰命名`與模型中的欄位(field)一致

在取用模型時一樣是使用`camelCase駝峰命名`命名來取用模型，例如模型(Model)名稱為`UserProfile`，取用時是`userProfile`。

由於在Windows作業系統中，MySQL/MariaDB的表單(Table)預設命名會變成是`全小寫命名`，這是因為實際上是大小寫無差異(case insensitive)，這會造成與模型(model)不一致的情況。例如模型(Model)名稱為`UserProfile`，建立的表單(Table)名稱會是`userprofile`，因為它大小寫並無差異，但會造成閱讀上困難，或是有可能的名稱衝突。在其它不同的作業系統上就會有大小寫差異。

以下是針對MySQL/MariaDB的表單(Table)與欄位(column)的命名說明:

```text
在 Unix 系統上，資料表名稱是區分大小寫的。在 Windows 系統上則不是。換句話說，如果你在 Windows 上開發，但計劃部署到 Linux 機器上，最好也在基於 Linux 的 MySQL 上測試你的 SQL，否則在生產環境中可能會遇到「找不到資料表」錯誤。
```

另外在PostgreSQL中，對於databases(資料庫)、tables(表單)、columns(欄位)的命名習慣，也是建議用蛇形(Snake Case)命名。(參考[Don't use upper case table or column names](https://wiki.postgresql.org/wiki/Don%27t_Do_This#Don.27t_use_upper_case_table_or_column_names)與[PostgreSQL naming conventions](https://stackoverflow.com/questions/2878248/postgresql-naming-conventions))

因此建議不論在表單或是欄位上，都統一使用蛇形(Snake Case)命名，這樣在不同的作業系統上都會是一致的。

要改變資料表和資料欄位名稱可以用`@map`或`@@map`在`schema.prisma`手動定義，參考[Database mapping](https://www.prisma.io/docs/orm/prisma-schema/data-model/database-mapping)，注意seed對應的是模型中的名稱，所以這只會更動資料表名或資料欄位名，和模型使用上無關。

以下是一個範例，`@@map`是對應到資料庫中的表單名稱，`@map`是對應到資料庫中的欄位名稱:

```prisma
model OrderDetail {
  id        Int      @id @default(autoincrement())
  paymentId Int      @map("payment_id")
  total     Int
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user      User     @relation(fields: [userId], references: [id])
  userId    Int      @map("user_id")

  @@map("order_detail")
}
```

#### 模型命名

- [Naming conventions](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#defining-fields)

- Model 模型名稱使用以下命名正規表達式: `[A-Za-z][A-Za-z0-9_]\*`
- Model 名稱必需使用英文字元，慣例上使用帕斯卡(PascalCase)命名
- Model 名稱為單數詞(singular)形式 (例如使用 `User`而不是 `user`, `users`或 `Users`)
- 不可使用 Prisma ORM 保留字詞，參考[這裡](https://github.com/prisma/prisma/blob/main/packages/client/src/generation/generateClient.ts#L556-L605)與[這裡](https://github.com/prisma/prisma-engines/blob/main/psl/parser-database/src/names/reserved_model_names.rs#L44)

#### 其它參考

> 註: 僅提供參考

- [SQL Style Guide](https://www.sqlstyle.guide/zh-tw/)
- [Modern SQL Style Guide](https://gist.github.com/mattmc3/38a85e6a4ca1093816c08d4815fbebfb)

### API路由 REST API

#### 標準

- [JSend](https://github.com/omniti-labs/jsend)
- [Microsoft Azure REST API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md)
- [Google JSON guide](https://google.github.io/styleguide/jsoncstyleguide.xml)

#### 範例

成功:

```json
{
  "status": "success",
  "data": {
    "post": { "id": 1, "title": "A blog", "body": "Some content" }
  }
}
```

或 不需要回應資料時(DELETE...)

```json
{
  "status": "success",
  "data": null
}
```

失敗:

```json
{
  "status": "fail",
  "data": { "title": "A title is required" }
}
```

錯誤:

```json
{
  "status": "error",
  "message": "Unable to communicate with database"
}
```

#### 狀態碼(status code)

基本使用:(一般情況使用200通用)

```text
GET: 200 OK
POST: 201 Created
PUT: 200 OK
PATCH: 200 OK
DELETE: 204 No Content
```

常用的狀態碼:

```text
200 OK - 請求成功，回應包含請求的資料
201 Created - 請求成功並且建立了一個新的資源
400 Bad Request - 請求無效或缺少必要的參數
401 Unauthorized - 客戶端需要驗證以訪問資源
404 Not Found - 找不到請求的資源
500 Internal Server Error - 伺服器發生意外錯誤
```

`POST`

```text
當您在伺服器上新建立一個或多個資源，應該返回 201 狀態碼並附帶一個 Location 標頭，讓客戶端能夠定位新建立的資源。回應的有效負載(payload)是可選的，通常會描述並鏈接到新建的資源。
```

`PUT`

```text
200 OK 表示成功更新現有資源的 PUT 請求。不需要回應主體。(根據第 9.6 節，204 No Content 更為合適。)

201 Created 表示成功建立新資源的 PUT 請求，並在 Location 標頭欄位中返回新資源的最具體 URI，以及在回應主體中回顯資源的任何其他相關 URI 和元數據。(RFC 2616 第 10.2.2 節)

409 Conflict 表示由於第三方修改而導致 PUT 請求失敗，回應主體中包含嘗試更新與當前資源之間差異的列表。(RFC 2616 第 10.4.10 節)

400 Bad Request 表示 PUT 請求失敗，回應主體中包含解釋 PUT 為何失敗的自然語言文本（例如英語）。(RFC 2616 第 10.4 節)
```

`DELETE`
  
```text
202: 請求已被接受處理，但處理尚未完成。
204: 伺服器已成功處理請求，且回應的有效負載中沒有額外的內容。
200: 請求成功，回應的有效負載中包含操作狀態的表示。
```

#### 分頁用(pagination)

```text
GET /posts?limit=10&offset=0 - retrieves the first 10 posts
GET /posts?limit=10&offset=10 - retrieves the second 10 posts
GET /posts?limit=10&offset=20 - retrieves the third 10 posts, and so on
```

### JWT 相關

- 只會加入token中不會被修改或更動的欄位，例 username, role
