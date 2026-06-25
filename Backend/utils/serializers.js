export const buildUserPayload = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl,
  preferences: user.preferences,
  notificationPrefs: user.notificationPrefs,
  deactivation: user.deactivation,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const buildUsersResponse = (users) =>
  users.map((user) => buildUserPayload(user));

const toPlainObject = (doc) =>
  doc && typeof doc.toObject === "function"
    ? doc.toObject({ virtuals: false })
    : doc;

export const buildCategoryPayload = (category) => {
  if (!category) return null;
  const raw = toPlainObject(category) ?? {};

  return {
    id: raw.id ?? raw.id ?? null,
    name: raw.name,
    slug: raw.slug,
  };
};

const resolveCategoryId = (category) => {
  if (!category) return null;

  if (typeof category === "string" || typeof category === "number") {
    return category;
  }

  if (typeof category === "object") {
    return category.id ?? category.id ?? null;
  }

  return null;
};

export const buildServicePayload = (service) => {
  const raw = toPlainObject(service) ?? {};

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    categoryId: resolveCategoryId(raw.category),
    category: buildCategoryPayload(raw.category),
    description: raw.description,
    priceMin: raw.priceMin,
    priceMax: raw.priceMax,
    durationMinutes: raw.durationMinutes,
    benefits: Array.isArray(raw.benefits)
      ? raw.benefits.filter((benefit) => typeof benefit === "string" && benefit)
      : [],
    featured: Boolean(raw.featured),
    active: Boolean(raw.active ?? true),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const buildServicesResponse = (services) =>
  Array.isArray(services)
    ? services.map((service) => buildServicePayload(service))
    : [];

export const buildServiceStats = (services) => {
  const stats = {
    total: 0,
    active: 0,
    inactive: 0,
    featured: 0,
  };

  if (!Array.isArray(services)) {
    return stats;
  }

  services.forEach((entry) => {
    stats.total += 1;
    const raw = toPlainObject(entry) ?? {};
    if (raw.active) {
      stats.active += 1;
    } else {
      stats.inactive += 1;
    }

    if (raw.featured) {
      stats.featured += 1;
    }
  });

  return stats;
};

const buildPersonPayload = (person) => {
  if (!person) return null;
  const raw = toPlainObject(person);

  return {
    id: raw?.id,
    fullName: raw?.fullName,
    email: raw?.email,
    phone: raw?.phone,
    role: raw?.role,
    avatarUrl: raw?.avatarUrl,
  };
};

const buildBookedServicePayload = (serviceItem) => {
  if (!serviceItem) return null;
  const raw = toPlainObject(serviceItem);
  const serviceRef = raw?.service;

  return {
    serviceId:
      typeof serviceRef === "object" && serviceRef !== null
        ? serviceRef.id ?? serviceRef.id
        : serviceRef,
    name: raw?.name,
    price: raw?.price,
    durationMinutes: raw?.durationMinutes,
  };
};

export const buildCouponPayload = (coupon) => ({
  id: coupon.id,
  code: coupon.code,
  description: coupon.description,
  discountType: coupon.discountType,
  amount: coupon.amount,
  minSpend: coupon.minSpend,
  startDate: coupon.startDate,
  endDate: coupon.endDate,
  usageLimit: coupon.usageLimit,
  usedCount: coupon.usedCount,
  isActive: coupon.isActive,
  serviceIds: coupon.serviceIds,
  categoryIds: coupon.categoryIds,
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt,
});

export const buildCouponsResponse = (coupons) =>
  coupons.map((coupon) => buildCouponPayload(coupon));

export const buildBookingPayload = (booking) => {
  const raw = toPlainObject(booking) ?? {};

  const services = Array.isArray(raw.services)
    ? raw.services
        .map((serviceItem) => buildBookedServicePayload(serviceItem))
        .filter(Boolean)
    : [];

  return {
    id: raw.id,
    user: buildPersonPayload(raw.user),
    stylist: buildPersonPayload(raw.stylist),
    services,
    startTime: raw.startTime,
    endTime: raw.endTime,
    status: raw.status,
    notes: raw.notes,
    adminNotes: raw.adminNotes,
    slot: raw.slot,
    payment: raw.payment
      ? {
          method: raw.payment.method,
          dpAmount: raw.payment.dpAmount,
          totalAmount: raw.payment.totalAmount,
          status: raw.payment.status,
          invoiceNo: raw.payment.invoiceNo,
          reference: raw.payment.reference,
        }
      : null,
    reminders: raw.reminders
      ? {
          threeDay: raw.reminders.threeDay
            ? {
                sentAt: raw.reminders.threeDay.sentAt,
                messageSid: raw.reminders.threeDay.messageSid,
              }
            : null,
        }
      : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const buildBookingsResponse = (bookings) =>
  bookings.map((booking) => buildBookingPayload(booking));

export const buildBookingStats = (bookings) => {
  const stats = {
    total: 0,
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    paymentPaid: 0,
  };

  if (!Array.isArray(bookings)) {
    return stats;
  }

  bookings.forEach((entry) => {
    stats.total += 1;
    const raw = toPlainObject(entry) ?? {};

    switch (raw.status) {
      case "pending":
        stats.pending += 1;
        break;
      case "confirmed":
        stats.confirmed += 1;
        break;
      case "in-progress":
        stats.inProgress += 1;
        break;
      case "completed":
        stats.completed += 1;
        break;
      case "cancelled":
        stats.cancelled += 1;
        break;
      default:
        break;
    }

    if (raw.payment?.status === "paid") {
      stats.paymentPaid += 1;
    }
  });

  return stats;
};

const buildInvoiceItemPayload = (item) => {
  if (!item) return null;
  const raw = toPlainObject(item) ?? {};

  return {
    itemId: raw.itemId,
    name: raw.name ?? raw.description,
    description: raw.description,
    quantity: raw.quantity,
    price: raw.price,
    total: raw.total,
  };
};

const buildVirtualAccountPayload = (va) => {
  if (!va) return null;
  const raw = toPlainObject(va) ?? {};

  return {
    bank: raw.bank,
    vaNumber: raw.vaNumber,
    paymentCode: raw.paymentCode,
    billerCode: raw.billerCode,
    channel: raw.channel,
    grossAmount: raw.grossAmount,
    expiresAt: raw.expiresAt,
  };
};

export const buildTransactionPayload = (transaction) => {
  const raw = toPlainObject(transaction) ?? {};

  const items = Array.isArray(raw.items)
    ? raw.items.map(buildInvoiceItemPayload).filter(Boolean)
    : [];

  const bookedServices = Array.isArray(raw.bookedServices)
    ? raw.bookedServices
        .map((serviceItem) => buildBookedServicePayload(serviceItem))
        .filter(Boolean)
    : [];

  const virtualAccounts = Array.isArray(raw.virtualAccounts)
    ? raw.virtualAccounts.map(buildVirtualAccountPayload).filter(Boolean)
    : [];

  const bookingRaw =
    raw.booking && typeof raw.booking === "object"
      ? toPlainObject(raw.booking)
      : null;

  const booking = bookingRaw
    ? {
        id: bookingRaw.id ?? bookingRaw.id,
        status: bookingRaw.status,
        startTime: bookingRaw.startTime,
        endTime: bookingRaw.endTime,
        slot: bookingRaw.slot,
        payment: bookingRaw.payment
          ? {
              method: bookingRaw.payment.method,
              totalAmount: bookingRaw.payment.totalAmount,
              status: bookingRaw.payment.status,
              invoiceNo: bookingRaw.payment.invoiceNo,
              reference: bookingRaw.payment.reference,
            }
          : null,
      }
    : null;

  let bookingId;
  if (booking?.id) {
    bookingId = booking.id.toString();
  } else if (
    typeof raw.booking === "string" ||
    typeof raw.booking === "number"
  ) {
    bookingId = raw.booking;
  } else if (
    raw.booking &&
    typeof raw.booking === "object" &&
    typeof raw.booking.toString === "function"
  ) {
    bookingId = raw.booking.toString();
  }

  return {
    id: raw.id,
    bookingId,
    booking,
    user: buildPersonPayload(raw.user),
    amount: raw.amount,
    grossAmount: raw.grossAmount,
    method: raw.method,
    status: raw.status,
    reference: raw.reference,
    paymentType: raw.paymentType,
    orderId: raw.orderId,
    invoice: raw.invoice
      ? {
          id: raw.invoice.id,
          number: raw.invoice.number,
          title: raw.invoice.title,
          paidTitle: raw.invoice.paidTitle,
          publishedAt: raw.invoice.publishedAt,
          dueDate: raw.invoice.dueDate,
          invoiceDate: raw.invoice.invoiceDate,
          pdfUrl: raw.invoice.pdfUrl,
          paymentLinkUrl: raw.invoice.paymentLinkUrl,
        }
      : null,
    customer: raw.customer
      ? {
          id: raw.customer.customerId,
          name: raw.customer.name,
          email: raw.customer.email,
          phone: raw.customer.phone,
        }
      : null,
    items,
    virtualAccounts,
    bookedServices,
    metadata: raw.metadata,
    midtransResponse: raw.midtransResponse,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const buildTransactionsResponse = (transactions) =>
  transactions.map((transaction) => buildTransactionPayload(transaction));

export const buildTransactionStats = (transactions) => {
  const stats = {
    total: 0,
    pending: 0,
    paid: 0,
    failed: 0,
    cancelled: 0,
    expired: 0,
    overdue: 0,
    refunded: 0,
  };

  if (!Array.isArray(transactions)) {
    return stats;
  }

  transactions.forEach((entry) => {
    stats.total += 1;
    const raw = toPlainObject(entry) ?? {};

    switch (raw.status) {
      case "paid":
        stats.paid += 1;
        break;
      case "failed":
        stats.failed += 1;
        break;
      case "cancelled":
        stats.cancelled += 1;
        break;
      case "expired":
        stats.expired += 1;
        break;
      case "overdue":
        stats.overdue += 1;
        break;
      case "refunded":
        stats.refunded += 1;
        break;
      case "pending":
      case "draft":
        stats.pending += 1;
        break;
      default:
        break;
    }
  });

  return stats;
};
