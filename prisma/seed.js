import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'
// 需要額外安裝 csvtojson package
import csv from 'csvtojson'
// 需要額外安裝 install bcrypt package
import bcrypt from 'bcrypt'
import { isDev } from '../lib/utils.js'

// 定義表關聯在這裡，目的是按正確順序的匯入種子資料，否則會出現外鍵約束錯誤或無法匯入的問題
// foreignKey is in the second table
const oneToOne = ['User:Profile']
// foreignKey is in the second table
const oneToMany = ['Category:Product', 'Brand:Product']
// foreignKey is in the third table
const manyToMany = ['User:Product:Favorite']

// seed檔案種類(副檔名)seed files extension (csv| json)
const fileExtension = 'json'
// seed檔案存放目錄(相對於專案根目錄) seed files folder path (relative to project root)
const seedsFolder = 'seeds'
// 需要先轉換為bcrypt編碼的欄位名稱 create bcrypt password hash
const bcryptFields = ['password']
// 需要先轉換為日期的欄位名稱 date format fields
const dateFields = ['birth']

// convert CamelCase to camelCase for Prisma modelName
function convertToCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

async function main() {
  // seed 檔案存放路徑(相對於專案根目錄)
  const seedsPath = path.join(process.cwd(), seedsFolder)
  const filenames = await fs.promises.readdir(seedsPath)

  const relations = [...oneToOne, ...oneToMany, ...manyToMany]

  let relationFileList = []

  // 建立關聯檔案名稱陣列
  for (const relation of relations) {
    const tmp = relation.split(':')
    for (let i = 0; i < tmp.length; i++) {
      relationFileList.push(`${tmp[i]}.${fileExtension}`)
    }
  }

  // console.log(relationFileList)
  // sort relationFileList with oneToOne, oneToMany, manyToMany table sequence
  // 依照關聯表順序排序種子檔案
  relationFileList.sort(function (a, b) {
    for (let i = 0; i < relations.length; i++) {
      const tmp = relations[i].split(':')
      // oneToOne, oneToMany
      if (tmp.length === 2 && a.includes(tmp[0]) && b.includes(tmp[1])) {
        return -1
      }

      // manyToMany
      if (tmp.length === 3 && a.includes(tmp[0]) && b.includes(tmp[2])) {
        return -1
      }

      // manyToMany
      if (tmp.length === 3 && a.includes(tmp[1]) && b.includes(tmp[2])) {
        return -1
      }
    }

    // others
    return 0
  })

  // 去除重覆檔案 remove duplicate
  relationFileList = [...new Set(relationFileList)]

  let restFileList = []

  // 比對出原本加入的剩餘檔案
  for (let i = 0; i < filenames.length; i++) {
    // fix: macos may has .DS_Store file and ignore it
    if (
      !relationFileList.includes(filenames[i]) &&
      filenames[i].includes(fileExtension)
    ) {
      restFileList.push(filenames[i])
    }
  }

  //  重建seed檔案 re structure seeders
  const seedFileList = [...restFileList, ...relationFileList]

  // console.log(seedFileList)

  for (const filename of seedFileList) {
    let data = []

    if (fileExtension === 'json') {
      const jsonData = await readFile(
        path.join(process.cwd(), `./${seedsFolder}/${filename}`)
      )
      // allData is an array of objects
      const allData = JSON.parse(jsonData)

      for (let i = 0; i < allData.length; i++) {
        const newItem = JSON.parse(JSON.stringify(allData[i]))

        for (const [key, value] of Object.entries(newItem)) {
          // bcrypt password
          if (bcryptFields.includes(key)) {
            newItem[key] = await bcrypt.hash(value, 10)
          }

          // date format
          if (dateFields.includes(key)) {
            newItem[key] = new Date(value)
          }
        }

        data.push(newItem)
      }
    }

    if (fileExtension === 'csv') {
      const allData = await csv().fromFile(
        path.join(process.cwd(), `./${seedsFolder}/${filename}`)
      )

      // transform to correct object data type
      for (let i = 0; i < allData.length; i++) {
        const newItem = JSON.parse(JSON.stringify(allData[i]))

        for (const [key, value] of Object.entries(newItem)) {
          // string to null
          if (value === 'Null' || value === 'null' || value === 'NULL') {
            newItem[key] = null
          }

          // string to boolean
          if (value === 'True' || value === 'true' || value === 'TRUE') {
            newItem[key] = true
          }
          // string to boolean
          if (value === 'False' || value === 'false' || value === 'FALSE') {
            newItem[key] = false
          }

          // bcrypt password
          if (bcryptFields.includes(key)) {
            newItem[key] = await bcrypt.hash(value, 10)
          }

          // date format
          if (dateFields.includes(key)) {
            newItem[key] = new Date(value)
          }

          // string to number
          if (
            !isNaN(value) &&
            value !== '' &&
            value !== null &&
            typeof value !== 'boolean' &&
            !bcryptFields.includes(key)
          ) {
            // maybe string start with 0 like '09123123456' should be string
            if (value.startsWith('0') && value.length > 1) {
              newItem[key] = value
            } else {
              newItem[key] = Number(value)
            }
          }
        }
        // to data object array
        data.push(newItem)
      }
    }

    const model = filename.split('.')[0]
    const prop = convertToCamelCase(model)

    // console.log('prop', prop, 'data', data)

    // this maybe anti typescript way
    const result = await prisma[prop].createMany({
      data,
      skipDuplicates: true,
    })

    // 如果是開發環境，顯示訊息
    if (isDev)
      console.log(`Created ${result.count} seeds for "${model}" Model.`)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    // 如果是開發環境，顯示錯誤訊息
    if (isDev) console.log(e)
    await prisma.$disconnect()
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  })
