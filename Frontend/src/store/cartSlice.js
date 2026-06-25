import { createSlice, nanoid } from "@reduxjs/toolkit";

const sanitizeNestedService = (service) => {
  if (!service) {
    return null;
  }

  const baseId =
    service.serviceId ||
    service.id ||
    service._id ||
    service.slug ||
    service.name ||
    null;

  const name = service.name || service.title || "Service";
  const description = service.description || "";
  const price = Number(service.priceMin ?? service.price ?? 0);
  const durationMinutes = Number(
    service.durationMinutes ?? service.duration ?? service.duration_min
  );

  return {
    serviceId: baseId || nanoid(6),
    name,
    description,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : 0,
  };
};

const normalizeService = (service) => {
  if (!service) {
    return null;
  }

  const baseId =
    service.id ||
    service._id ||
    service.serviceId ||
    service.slug ||
    service.name ||
    null;

  const name = service.name || service.title || "Service";
  const description = service.description || "";
  const price = Number(service.priceMin ?? service.price ?? 0) || 0;
  const durationMinutes = Number(
    service.durationMinutes ?? service.duration ?? service.duration_min
  );

  const cartMain = sanitizeNestedService(service.cartMain);
  const cartExtras = Array.isArray(service.cartExtras)
    ? service.cartExtras
        .map((extra) => sanitizeNestedService(extra))
        .filter(Boolean)
    : [];
  const schedule =
    service.schedule && typeof service.schedule === "object"
      ? {
          date: service.schedule.date || null,
          startMinutes: Number(service.schedule.startMinutes) || null,
          endMinutes: Number(service.schedule.endMinutes) || null,
          startTime: service.schedule.startTime || null,
          endTime: service.schedule.endTime || null,
          label: service.schedule.label || null,
        }
      : null;

  return {
    serviceId: baseId || nanoid(6),
    name,
    description,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    durationMinutes:
      Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : 0,
    cartMain,
    cartExtras,
    schedule,
    raw: service,
  };
};

const computeTotals = (items) =>
  items.reduce(
    (acc, item) => {
      const price = Number(item.price);
      const duration = Number(item.durationMinutes);
      acc.totalPrice += Number.isFinite(price) ? price : 0;
      acc.totalDuration += Number.isFinite(duration) ? duration : 0;
      return acc;
    },
    { totalPrice: 0, totalDuration: 0 }
  );

const resetCouponState = (state) => {
  state.coupon = null;
  state.discountAmount = 0;
};

const applyTotals = (state) => {
  const totals = computeTotals(state.items);
  state.totalPrice = totals.totalPrice;
  state.totalDuration = totals.totalDuration;
  if (state.discountAmount > state.totalPrice) {
    state.discountAmount = state.totalPrice;
  }
  if (state.discountAmount < 0) {
    state.discountAmount = 0;
  }
};

const initialState = {
  items: [],
  totalPrice: 0,
  totalDuration: 0,
  coupon: null,
  discountAmount: 0,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem: (state, action) => {
      const normalized = normalizeService(action.payload);
      if (!normalized) {
        return;
      }

      state.items.push({
        entryId: nanoid(10),
        ...normalized,
      });

      applyTotals(state);
      resetCouponState(state);
    },
    addItems: (state, action) => {
      const services = Array.isArray(action.payload) ? action.payload : [];
      services.forEach((service) => {
        const normalized = normalizeService(service);
        if (!normalized) {
          return;
        }
        state.items.push({ entryId: nanoid(10), ...normalized });
      });

      applyTotals(state);
      resetCouponState(state);
    },
    removeItem: (state, action) => {
      const entryId = action.payload;
      state.items = state.items.filter((item) => item.entryId !== entryId);
      applyTotals(state);
      resetCouponState(state);
    },
    clearCart: (state) => {
      state.items = [];
      state.totalPrice = 0;
      state.totalDuration = 0;
      resetCouponState(state);
    },
    applyCoupon: (state, action) => {
      const payload = action.payload ?? {};
      const coupon = payload.coupon ?? null;

      if (!coupon) {
        resetCouponState(state);
        return;
      }

      const subtotal = Number(payload.subtotal);
      if (Number.isFinite(subtotal) && subtotal >= 0) {
        state.totalPrice = Math.round(subtotal);
      }

      const totalDuration = Number(payload.totalDuration);
      if (Number.isFinite(totalDuration) && totalDuration >= 0) {
        state.totalDuration = Math.round(totalDuration);
      }

      const discountAmount = Number(payload.discountAmount);
      state.discountAmount =
        Number.isFinite(discountAmount) && discountAmount > 0
          ? Math.min(Math.round(discountAmount), state.totalPrice)
          : 0;

      state.coupon = coupon;
    },
    clearCoupon: (state) => {
      resetCouponState(state);
    },
  },
});

export const {
  addItem,
  addItems,
  removeItem,
  clearCart,
  applyCoupon,
  clearCoupon,
} = cartSlice.actions;

export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) => state.cart.items.length;
export const selectCartTotals = (state) => {
  const subtotal = state.cart.totalPrice;
  const discountAmount = Math.min(state.cart.discountAmount, subtotal);
  const payable = Math.max(subtotal - discountAmount, 0);

  return {
    subtotal,
    totalPrice: subtotal,
    discountAmount,
    totalDuration: state.cart.totalDuration,
    payable,
  };
};

export const selectCartCoupon = (state) => state.cart.coupon;

export default cartSlice.reducer;
