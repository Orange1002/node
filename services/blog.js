import prisma from '../lib/prisma.js'
import { z } from 'zod'
import { dateToStringWithTimeZone, validatedParamId } from '../lib/utils.js'

// 部落格資料的驗証用的schema
const blogSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(500),
  published: z.boolean().optional(),
})

// 檢查部落格是否存在
const isBlogExist = async (blogId) => {
  const blog = await prisma.blog.findUnique({
    where: {
      id: blogId,
    },
  })

  return blog ? true : false
}

// 取得所有部落格資料
export const getBlogs = async () => {
  const blogs = await prisma.blog.findMany()
  // 轉換日期格式與時區為UTC+8
  return blogs.map((blog) => {
    return {
      ...blog,
      createdAt: dateToStringWithTimeZone(blog.createdAt),
      updatedAt: dateToStringWithTimeZone(blog.updatedAt),
    }
  })
}

// 取得單筆部落格資料
export const getBlogById = async (blogId) => {
  // 驗證參數是否為正整數
  validatedParamId(blogId)

  const blog = await prisma.blog.findUnique({
    where: {
      id: blogId,
    },
  })

  if (!blog) {
    throw new Error('資料不存在')
  }

  // 轉換日期格式與時區為UTC+8
  return {
    ...blog,
    createdAt: dateToStringWithTimeZone(blog.createdAt),
    updatedAt: dateToStringWithTimeZone(blog.updatedAt),
  }
}

// 建立部落格資料
export const createBlog = async (newBlog) => {
  // 驗證部落格資料是否符合schema
  const validatedBlog = blogSchema.safeParse(newBlog)

  if (!validatedBlog.success) {
    throw new Error('資料格式不正確')
  }

  return await prisma.blog.create({
    data: validatedBlog.data,
  })
}

// 更新部落格資料
export const updateBlog = async (blogId, updatedBlog) => {
  // 驗證參數是否為正整數
  validatedParamId(blogId)

  // 驗證部落格資料是否符合schema
  const validatedBlog = blogSchema.safeParse(updatedBlog)

  if (!validatedBlog.success) {
    throw new Error('資料格式不正確')
  }

  // 檢查部落格是否存在
  const blogExist = await isBlogExist(blogId)

  if (!blogExist) {
    throw new Error('資料不存在')
  }

  return await prisma.blog.update({
    where: {
      id: blogId,
    },
    data: validatedBlog.data,
  })
}

// 刪除部落格資料
export const deleteBlog = async (blogId) => {
  // 驗證參數是否為正整數
  validatedParamId(blogId)

  // 檢查部落格是否存在
  const blogExist = await isBlogExist(blogId)

  if (!blogExist) {
    throw new Error('資料不存在')
  }

  return await prisma.blog.delete({
    where: {
      id: blogId,
    },
  })
}
