import prisma from '../lib/prisma.js'
import { z } from 'zod'
import bcrypt from 'bcrypt'

import {
  isDev,
  isEmpty,
  validatedParamId,
  safeParseBindSchema,
} from '../lib/utils.js'

// service層的函式，主要負責處理與模型間的業務邏輯，被route層的API呼叫
// 並不負責所有的安全性檢查與資料轉型，但會作輸入資料格式的檢查
// 當發生錯誤時，拋出錯誤，將由route層的錯誤處理try-catch陳述式捕捉回應給前端
// 注意"檔案上傳"與"JWT"的處理，因為與平台系統層有關，不會在此層處理，會在route層的API處理

// #region 建立驗證格式用函式
// 建立會員資料的驗證用的schema物件
const userSchema = {}

// 建立會員資料的驗証用的schema
userSchema.newUser = z.object({
  name: z.string().min(1).max(20), // 1-20個字元，必要
  email: z.string().min(1).email(), // 1個字元以上，且符合email格式，必要
  password: z.string().min(5).max(30), // 5-30個字元，必要
  username: z.string().min(1).max(50), // 1-50個字元，必要
  emailValidated: z.boolean().optional(), // 布林值，可選填
  avatar: z.string().optional(), // 字串，可選填
  googleUid: z.string().optional(), // 字串，可選填
  lineUid: z.string().optional(), // 字串，可選填
})

// 更新會員資料的驗証用的schema
userSchema.updateUser = z.object({
  email: z.string().min(1).email(), // 1個字元以上，且符合email格式，必要
  emailValidated: z.boolean().optional(), // 布林值，可選填
  profile: z
    .object({
      name: z.string().min(1).max(20), // 1-20個字元，必要
      bio: z.string().max(160).optional(), // 0-160個字元，可選填
      avatar: z.string().optional(), // 字串，可選填
      sex: z.enum(['男', '女', '其他']).optional(), // 列舉，可選填
      birth: z.string().date().optional(), // 日期字串，可選填
      phone: z.string().optional(), // 字串，可選填
      postcode: z.string().optional(), // 字串，可選填
      address: z.string().optional(), // 字串，可選填
    })
    .optional(), // 物件，可選填
})

// 更新會員資料的驗証用的schema(不包含頭像avatar)
// {"name":"榮恩","bio":"","sex":"","phone":"","birth":"","postcode":"","address":""}
userSchema.updateUserProfile = z.object({
  name: z.string().min(1).max(20), // 1-20個字元，必要
  bio: z.string().max(200).optional(), // 0-200個字元，可選填
  sex: z.enum(['男', '女']).or(z.string().max(0)).optional(), // 列舉或空字串，可選填
  birth: z.string().date().or(z.string().max(0)).optional(), // 日期字串或空字串，可選填
  phone: z.string().optional(), // 字串，可選填
  postcode: z.string().optional(), // 字串，可選填
  address: z.string().optional(), // 字串，可選填
})

// 更新會員密碼的驗証用的schema
userSchema.updatePassword = z.object({
  currentPassword: z.string().min(5).max(30), // 5-30個字元，必要
  newPassword: z.string().min(5).max(30), // 5-30個字元，必要
})

// 綁定驗證用的schema的檢查函式
const userSchemaValidator = safeParseBindSchema(userSchema)
// #endregion

// 獲得所有使用者資料
export const getUsers = async () => {
  // 使用findMany方法取得所有使用者資料
  const users = await prisma.user.findMany()

  // 不回傳密碼，刪除密碼屬性
  users.forEach((user) => {
    delete user.password
  })

  return users
}

// 獲得單筆使用者資料(包含profile)
export const getUserById = async (userId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // 使用findUnique方法取得單筆使用者資料
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      profile: true,
    },
  })

  // user=null，表示無此會員資料
  if (!user) {
    throw new Error('會員資料不存在')
  }

  if (user.profile.birth) {
    // 將生日的日期格式轉為字串 yyyy-mm-dd
    user.profile.birth = user.profile.birth.toISOString().split('T')[0]
  }

  // 如果user的屬性中有null值，轉換為空字串
  if (user) {
    for (const key in user) {
      if (user[key] === null) {
        user[key] = ''
      }
    }
  }

  // 如果profile的屬性中有null值，轉換為空字串
  if (user.profile) {
    for (const key in user.profile) {
      if (user.profile[key] === null) {
        user.profile[key] = ''
      }
    }
  }

  // 不回傳密碼，刪除密碼屬性
  if (user) delete user.password

  return user
}

// 過濾某個欄位得到使用者資料(不包含profile)
export const getUserByField = async (where = {}) => {
  // 驗證參數
  if (isEmpty(where)) {
    throw new Error('缺少必要參數')
  }

  // 使用findUnique方法取得單筆使用者資料
  const user = await prisma.user.findUnique({
    where,
  })

  // 如果user的屬性中有null值，轉換為空字串
  if (user) {
    for (const key in user) {
      if (user[key] === null) {
        user[key] = ''
      }
    }
  }

  // 不回傳密碼，刪除密碼屬性
  if (user) delete user.password

  return user
}

// export const getUserByEmail = async (email) => {
//   // 驗證參數
//   if (!email) {
//     throw new Error('缺少必要參數')
//   }

//   // 使用findUnique方法取得單筆使用者資料
//   const user = await prisma.user.findUnique({
//     where: { email: email },
//   })

//   // 如果user的屬性中有null值，轉換為空字串
//   if (user) {
//     for (const key in user) {
//       if (user[key] === null) {
//         user[key] = ''
//       }
//     }
//   }

//   // 不回傳密碼，刪除密碼屬性
//   if (user) delete user.password

//   return user
// }

// // 透過google uid取得使用者資料
// export const getUserByGoogleUid = async (googleUid) => {
//   // 驗證參數
//   if (!googleUid) {
//     throw new Error('缺少必要參數')
//   }

//   // 使用findUnique方法取得單筆使用者資料
//   const user = await prisma.user.findUnique({
//     where: { googleUid: googleUid },
//   })

//   // 如果user的屬性中有null值，轉換為空字串
//   if (user) {
//     for (const key in user) {
//       if (user[key] === null) {
//         user[key] = ''
//       }
//     }
//   }
//   // 不回傳密碼，刪除密碼屬性
//   if (user) delete user.password

//   return user
// }

// export const getUserByLineUid = async (lineUid) => {
//   // 驗證參數
//   if (!lineUid) {
//     throw new Error('缺少必要參數')
//   }

//   // 使用findUnique方法取得單筆使用者資料
//   const user = await prisma.user.findUnique({
//     where: { lineUid: lineUid },
//   })

//   // 如果user的屬性中有null值，轉換為空字串
//   if (user) {
//     for (const key in user) {
//       if (user[key] === null) {
//         user[key] = ''
//       }
//     }
//   }
//   // 不回傳密碼，刪除密碼屬性
//   if (user) delete user.password

//   return user
// }

// 新增會員資料
export const createUser = async (newUser) => {
  if (isDev) console.log('newUser', newUser)
  // newUser資料範例(物件) 註: name改為在profile資料表中
  // {
  //     "username":"ginny",
  //     "password":"123456",
  //     "name":"金妮",
  //     "avatar":"avatar.jpg",
  //     "email":"ginny@test.com"
  //     "emailValidated":true,
  //     "googleUid":"123456",
  //     "lineUid":"123456"
  // }

  // 簡單檢查的範例，檢查從前端來的資料哪些為必要(name, username...)
  // if (!email || !name) {
  //   throw new Error('缺少必要資料')
  // }

  // 檢查從前端來的資料是否符合格式，注意要傳入與檢查schema同名的物件值，例如{ newUser: newUser }，前者為物件的key，會比對schema物件中的檢查格式，後者為要檢查物件的值
  userSchemaValidator({ newUser })

  // 要新增的會員資料
  const {
    email,
    name,
    password,
    username,
    avatar = '',
    googleUid = null,
    lineUid = null,
  } = newUser

  // 查詢是否有相同email或username的會員資料(這兩者其一都不能有重覆)
  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          email: email,
        },
        {
          username: username,
        },
      ],
    },
  })

  // 如果有重覆的會員資料，拋出錯誤
  if (dbUser) {
    throw new Error('會員資料重覆')
  }

  // 將密碼字串進行加密
  const passwordHash = await bcrypt.hash(password, 10)
  // 建立會員資料，這裡會同時建立profile資料
  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      username,
      googleUid: googleUid,
      lineUid: lineUid,
      profile: {
        create: { name: name, avatar: avatar },
      },
    },
  })

  // 如果user的屬性中有null值，轉換為空字串
  if (user) {
    for (const key in user) {
      if (user[key] === null) {
        user[key] = ''
      }
    }
  }

  return user
}

// 更新會員資料(不包含頭像avatar)
export const updateUserProfileById = async (userId, updateUserProfile) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // updateUser資料範例(物件)
  // {
  //   "name":"金妮",
  //   "bio":"Hello World",
  //   "sex":"女",
  //   "birth":"1990-01-01",
  //   "phone":"0912345678",
  //   "postcode":"100",
  //   "address":"台北市中正區"
  // }

  // 檢查從前端來的資料是否符合格式
  userSchemaValidator({ updateUserProfile })

  // 將生日的日期字串轉為Date物件
  if (updateUserProfile.birth) {
    updateUserProfile.birth = new Date(updateUserProfile.birth)
  } else {
    updateUserProfile.birth = null
  }

  return await prisma.profile.update({
    where: { userId: userId },
    data: updateUserProfile,
  })
}

export const getUserAvatarById = async (userId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // 使用findUnique方法取得單筆使用者資料
  const profile = await prisma.profile.findUnique({
    where: { userId: userId },
  })

  return profile.avatar
}

// 更新會員頭像avatar
export const updateUserAvatarById = async (userId, avatar) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // 檢查從avatar資料是否符合格式(檔案名稱)
  if (!avatar) {
    throw new Error('缺少必要參數')
  }

  // 更新頭像欄位
  return await prisma.profile.update({
    where: { userId: userId },
    data: { avatar: avatar },
  })
}

// google uid連結會員資料用
export const updateUserDataByField = async (where = {}, data = {}) => {
  // 驗證參數
  if (isEmpty(where) || isEmpty(data)) {
    throw new Error('缺少必要參數')
  }

  // 更新欄位
  return await prisma.user.update({
    where,
    data,
  })
}

// google uid連結會員資料用
// export const updateUserGoogleUidByEmail = async (email, googleUid) => {
//   // 驗證參數
//   if (!email || !googleUid) {
//     throw new Error('缺少必要參數')
//   }

//   // 更新欄位
//   return await prisma.user.update({
//     where: { email: email },
//     data: { googleUid: googleUid },
//   })
// }

//
// export const updateUserLineAccessTokenByLineUid = async (
//   lineUid,
//   lineAccessToken
// ) => {
//   // 驗證參數
//   if (!lineUid || !lineAccessToken) {
//     throw new Error('缺少必要參數')
//   }

//   // 更新欄位
//   return await prisma.user.update({
//     where: { lineUid: lineUid },
//     data: { lineAccessToken: lineAccessToken },
//   })
// }

// 更新會員密碼
export const updateUserPasswordById = async (userId, updatePassword) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // 檢查從前端來的資料是否符合格式
  userSchemaValidator({ updatePassword })

  // 使用findUnique方法取得單筆使用者資料
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error('無此會員資料')
  }

  // 比對密碼是否正確
  const isPasswordMatch = await bcrypt.compare(
    updatePassword.currentPassword, // 使用者輸入的目前密碼
    user.password
  )

  // 密碼不符合 拋出錯誤
  if (!isPasswordMatch) {
    throw new Error('輸入的當前密碼錯誤')
  }

  // 將輸入的新密碼字串進行加密
  const passwordHash = await bcrypt.hash(updatePassword.newPassword, 10)

  // 更新密碼欄位
  return await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  })
}

// 刪除會員資料
export const deleteUserById = async (userId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  return await prisma.user.delete({
    where: { id: userId },
  })
}

// 判斷某商品是否已加入我的最愛
export const isUserFavorite = async (userId, productId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)
  validatedParamId(productId)

  // 使用findUnique方法取得單筆最愛商品資料
  const favorite = await prisma.favorite.findFirst({
    where: {
      userId: userId,
      productId: productId,
    },
  })

  return favorite ? true : false
}

// 取得會員的加入我的最愛的商品id
export const getUserFavorites = async (userId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)

  // 使用findMany方法取得所有使用者的最愛商品資料
  const favorites = await prisma.favorite.findMany({
    where: {
      userId: userId,
    },
  })

  // console.log(favorites)

  // 將結果中的pid取出變為一個純資料的陣列
  return favorites.map((v) => v.productId)
}

// 新增商品到我的最愛
export const addUserFavorite = async (userId, productId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)
  validatedParamId(productId)

  // 查詢是否有相同的最愛商品資料
  const existFav = await isUserFavorite(userId, productId)

  // 如果有重覆的最愛商品資料，拋出錯誤
  if (existFav) {
    throw new Error('資料已經存在，新增失敗')
  }

  // 查詢是否有此商品資料
  const existProduct = await prisma.product.findUnique({
    where: {
      id: productId,
    },
  })

  // 如果無此商品資料，拋出錯誤
  if (!existProduct) {
    throw new Error('商品資料不存在，新增失敗')
  }

  // 建立最愛商品資料
  return await prisma.favorite.create({
    data: {
      userId: userId,
      productId: productId,
    },
  })
}

// 刪除我的最愛的商品
export const deleteUserFavorite = async (userId, productId) => {
  // 驗證參數是否為正整數
  validatedParamId(userId)
  validatedParamId(productId)

  // 查詢此資料是否存在
  const existFav = await isUserFavorite(userId, productId)

  // 如果無此最愛商品資料，拋出錯誤
  if (!existFav) {
    throw new Error('資料不存在，刪除失敗')
  }

  return await prisma.favorite.delete({
    where: {
      // 複合主鍵(預設名稱為兩個欄位名稱以_相加)
      userId_productId: {
        userId: userId,
        productId: productId,
      },
    },
  })
}
