import prisma from '../lib/prisma.js'

export const getCoupons = async () => {
  return await prisma.coupon.findMany({
    where: { enabled: true },
    include: {
      images: true,
      categoryCouponMap: {
        include: { category: true },
      },
      subcategoryCouponMap: {
        include: { subcategory: true },
      },
    },
  })
}

export const getCouponById = async (couponId, memberId = null) => {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: {
      usageType: true,
      images: true,
      categoryCouponMap: {
        include: { category: true },
      },
    },
  })

  if (!coupon) throw new Error('優惠券不存在')

  // ✅ 查詢會員是否已領取
  let isClaimed = false
  if (memberId) {
    const claim = await prisma.memberCoupon.findFirst({
      where: {
        memberId,
        couponId,
      },
    })
    isClaimed = !!claim
  }

  // ✅ 根據 usageTypeId 判斷是否查詢相關商品
  let relatedProducts = []

  if (coupon.usageTypeId === 1) {
    const categoryIds = coupon.categoryCouponMap.map((c) => c.categoryId)

    const allProducts = await prisma.product.findMany({
      where: {
        category_id: {
          in: categoryIds,
        },
      },
      include: {
        product_images: {
          where: { is_primary: true },
          select: { image: true },
        },
      },
    })

    const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)
    relatedProducts = shuffle(allProducts).slice(0, 4)
  }

  return {
    coupon: {
      ...coupon,
      image: coupon.images?.[0]?.image || null,
      usageTypeId: coupon.usageTypeId,
      isClaimed,
    },
    products: relatedProducts,
  }
}

export const claimCoupon = async (memberId, couponId) => {
  // 是否已經領取
  const exists = await prisma.memberCoupon.findFirst({
    where: {
      memberId,
      couponId,
    },
  })

  if (exists) throw new Error('已經領取過此優惠券')

  return await prisma.memberCoupon.create({
    data: {
      memberId,
      couponId,
      acquiredAt: new Date(),
      source: '使用者領取',
    },
  })
}

export const useCoupon = async (memberId, couponId, orderAmount) => {
  const couponRecord = await prisma.memberCoupon.findFirst({
    where: {
      memberId,
      couponId,
      usedAt: null,
    },
    include: {
      coupon: true,
    },
  })

  if (!couponRecord) throw new Error('找不到可使用的優惠券')

  // ✅ 檢查最低金額
  if (orderAmount < couponRecord.coupon.minPurchase) {
    throw new Error(`未達最低消費金額 ${couponRecord.coupon.minPurchase}`)
  }

  return await prisma.memberCoupon.update({
    where: { id: couponRecord.id },
    data: { usedAt: new Date() },
  })
}

const computeCouponStatus = (coupon, usedAt) => {
  if (usedAt) return 'used'
  const now = new Date()
  if (coupon.endAt && new Date(coupon.endAt) < now) return 'expired'
  return 'available'
}

export const getMemberCoupons = async (memberId) => {
  const results = await prisma.memberCoupon.findMany({
    where: { memberId },
    orderBy: { acquiredAt: 'desc' },
    include: {
      coupon: {
        include: {
          images: true,
          categoryCouponMap: {
            include: { category: true },
          },
          subcategoryCouponMap: {
            include: { subcategory: true },
          },
        },
      },
    },
  })

  return results.map((entry) => ({
    ...entry,
    status: computeCouponStatus(entry.coupon, entry.usedAt),
  }))
}

export const getAvailableCoupons = async (memberId) => {
  const now = new Date()

  const results = await prisma.memberCoupon.findMany({
    where: {
      memberId,
      usedAt: null,
      coupon: {
        enabled: true,
        startAt: {
          lte: now,
        },
        endAt: {
          gte: now,
        },
      },
    },
    include: {
      coupon: {
        include: {
          images: true,
          categoryCouponMap: {
            include: { category: true },
          },
          subcategoryCouponMap: {
            include: { subcategory: true },
          },
        },
      },
    },
    orderBy: {
      acquiredAt: 'desc',
    },
  })

  return results.map((entry) => {
    const categoryId = entry.coupon.categoryCouponMap?.[0]?.categoryId || null

    return {
      ...entry.coupon,
      image: entry.coupon.images?.[0]?.image || null,
      status: computeCouponStatus(entry.coupon, entry.usedAt),
      categoryId,
      usageTypeId: entry.coupon.usageTypeId,
    }
  })
}

export const getUsedCoupons = async (memberId) => {
  const results = await prisma.memberCoupon.findMany({
    where: {
      memberId,
      usedAt: {
        not: null,
      },
    },
    include: {
      coupon: {
        include: {
          images: true,
          categoryCouponMap: {
            include: { category: true },
          },
          subcategoryCouponMap: {
            include: { subcategory: true },
          },
        },
      },
    },
    orderBy: {
      usedAt: 'desc',
    },
  })

  return results.map((entry) => ({
    ...entry.coupon,
    usedAt: entry.usedAt,
    image: entry.coupon.images?.[0]?.image || null,
    status: computeCouponStatus(entry.coupon, entry.usedAt),
  }))
}

export const createCoupon = async (data) => {
  const newCoupon = await prisma.coupon.create({
    data: {
      code: data.code,
      title: data.title,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minPurchase: data.minPurchase,
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: new Date(data.endAt),
      enabled: data.enabled ?? true,
      usageTypeId: data.usageTypeId ?? null,
    },
  })

  if (data.image) {
    await prisma.couponImage.create({
      data: {
        couponId: newCoupon.id,
        image: data.image,
      },
    })
  }

  if (data.categoryIds?.length) {
    const categoryData = data.categoryIds.map((categoryId) => ({
      couponId: newCoupon.id,
      categoryId,
    }))
    await prisma.categoryCouponMap.createMany({ data: categoryData })
  }

  if (data.subcategoryIds?.length) {
    const subcategoryData = data.subcategoryIds.map((subcategoryId) => ({
      couponId: newCoupon.id,
      subcategoryId,
    }))
    await prisma.subcategoryCouponMap.createMany({ data: subcategoryData })
  }

  return newCoupon
}

export const updateCoupon = async (id, data) => {
  const updated = await prisma.coupon.update({
    where: { id },
    data: {
      code: data.code,
      title: data.title,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minPurchase: data.minPurchase,
      startAt: data.startAt ? new Date(data.startAt) : null,
      endAt: new Date(data.endAt),
      enabled: data.enabled,
      usageTypeId: data.usageTypeId ?? null,
    },
  })

  if (data.image) {
    await prisma.couponImage.deleteMany({ where: { couponId: id } })
    await prisma.couponImage.create({
      data: {
        couponId: id,
        image: data.image,
      },
    })
  }

  if (data.categoryIds) {
    await prisma.categoryCouponMap.deleteMany({ where: { couponId: id } })
    if (data.categoryIds.length) {
      const categoryData = data.categoryIds.map((categoryId) => ({
        couponId: id,
        categoryId,
      }))
      await prisma.categoryCouponMap.createMany({ data: categoryData })
    }
  }

  if (data.subcategoryIds) {
    await prisma.subcategoryCouponMap.deleteMany({ where: { couponId: id } })
    if (data.subcategoryIds.length) {
      const subcategoryData = data.subcategoryIds.map((subcategoryId) => ({
        couponId: id,
        subcategoryId,
      }))
      await prisma.subcategoryCouponMap.createMany({ data: subcategoryData })
    }
  }

  return updated
}

export const deleteCoupon = async (id) => {
  return await prisma.coupon.delete({
    where: { id },
  })
}

export const getClaimableCoupons = async (memberId) => {
  const now = new Date()

  const claimedCouponIds = await prisma.memberCoupon.findMany({
    where: { memberId },
    select: { couponId: true },
  })

  const claimedIds = claimedCouponIds.map((c) => c.couponId)

  const coupons = await prisma.coupon.findMany({
    where: {
      id: { notIn: claimedIds },
      enabled: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    include: {
      images: true,
    },
    orderBy: {
      endAt: 'asc',
    },
  })

  return coupons.map((c) => ({
    ...c,
    image: c.images?.[0]?.image || null,
  }))
}
