import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import CustomerDashboardLayout from "./CustomerDashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";
import {
  applyCoupon as applyCouponAction,
  clearCart as clearCartAction,
  clearCoupon as clearCouponAction,
  removeItem as removeItemAction,
  selectCartCoupon,
  selectCartItems,
  selectCartTotals,
} from "../../../store/cartSlice";

const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || "";
// Choose Snap URL based on key unless explicitly provided.
const MIDTRANS_SNAP_URL =
  import.meta.env.VITE_MIDTRANS_SNAP_URL ||
  (MIDTRANS_CLIENT_KEY.startsWith("SB-")
    ? "https://app.sandbox.midtrans.com/snap/snap.js"
    : "https://app.midtrans.com/snap/snap.js");

const SNAP_EMBED_CONTAINER_ID = "midtrans-snap-container";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

const scheduleDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatClock = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const pad = (value) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}`;
};

const normalizeScheduleDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const formatScheduleDate = (schedule) => {
  if (!schedule?.date) {
    return "";
  }
  const parsed = normalizeScheduleDate(schedule.date);
  if (!parsed) {
    return schedule.date;
  }
  return scheduleDateFormatter.format(parsed);
};

const getScheduleTimeLabel = (schedule) => {
  if (!schedule) {
    return "";
  }
  if (schedule.label) {
    return schedule.label;
  }
  const start =
    schedule.startTime || formatClock(schedule.startMinutes ?? undefined);
  const end = schedule.endTime || formatClock(schedule.endMinutes ?? undefined);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end || "";
};

const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) {
    return "0 menit";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "jam" : "jam"}`);
  }

  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} menit`);
  }

  return parts.join(" ");
};

const CustomerCart = () => {
  const dispatch = useDispatch();
  const { token } = useAuth();
  const navigate = useNavigate();

  const items = useSelector(selectCartItems);
  const totals = useSelector(selectCartTotals, shallowEqual);
  const coupon = useSelector(selectCartCoupon, shallowEqual);

  const { subtotal, discountAmount, payable, totalDuration } = totals;

  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponStatus, setCouponStatus] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutStatus, setCheckoutStatus] = useState(null);

  const [snapReady, setSnapReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.snap)
  );
  const [snapModalVisible, setSnapModalVisible] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [retryPrompt, setRetryPrompt] = useState(null);
  const snapContainerRef = useRef(null);
  const navigationTimeoutRef = useRef(null);

  const cartPayload = useMemo(
    () =>
      items.map((item) => ({
        entryId: item.entryId,
        name: item.name,
        price: item.price,
        durationMinutes: item.durationMinutes,
        cartMain: item.cartMain,
        cartExtras: item.cartExtras,
        schedule: item.schedule,
      })),
    [items]
  );

  useEffect(() => {
    if (coupon?.code) {
      setCouponCode(coupon.code);
    } else if (!applyingCoupon) {
      setCouponCode("");
    }
  }, [coupon, applyingCoupon]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  const clearSnapEmbed = useCallback(() => {
    if (snapContainerRef.current) {
      snapContainerRef.current.innerHTML = "";
    }
  }, []);

  const closeSnapModal = useCallback(() => {
    setSnapModalVisible(false);
    setCurrentTransaction(null);
    clearSnapEmbed();
  }, [clearSnapEmbed]);

  const resolveAppUrl = useCallback((path) => {
    if (!path) {
      return "";
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    if (typeof window === "undefined") {
      return path;
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${window.location.origin}${normalized}`;
  }, []);

  const overrideSnapRedirectUrls = useCallback(
    (result, targetPath) => {
      if (!result || !targetPath) {
        return;
      }

      const targetUrl = resolveAppUrl(targetPath);

      if (targetUrl) {
        if (result.finish_redirect_url) {
          result.finish_redirect_url = targetUrl;
        }
        if (result.pending_redirect_url) {
          result.pending_redirect_url = targetUrl;
        }
        if (result.error_redirect_url) {
          result.error_redirect_url = targetUrl;
        }
      }
    },
    [resolveAppUrl]
  );

  const scheduleRedirect = useCallback(
    (path) => {
      if (!path || typeof window === "undefined") {
        return;
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = window.setTimeout(() => {
        navigate(path);
      }, 1800);
    },
    [navigate]
  );

  const handlePaymentResult = useCallback(
    (status, payload) => {
      setCheckoutLoading(false);

      if (status === "success") {
        closeSnapModal();
        setRetryPrompt(null);
        setCheckoutStatus("success");
        setCheckoutMessage(
          "Pembayaran berhasil. Anda akan diarahkan ke riwayat booking."
        );
        overrideSnapRedirectUrls(payload, "/customer/history?payment=success");
        scheduleRedirect("/customer/history?payment=success");
        return;
      }

      if (status === "pending") {
        closeSnapModal();
        setRetryPrompt(null);
        setCheckoutStatus("info");
        setCheckoutMessage(
          "Transaksi menunggu penyelesaian. Anda akan diarahkan ke riwayat booking untuk memantau status."
        );
        overrideSnapRedirectUrls(payload, "/customer/history?payment=pending");
        scheduleRedirect("/customer/history?payment=pending");
        return;
      }

      if (status === "error") {
        closeSnapModal();
        setCheckoutStatus("error");
        setCheckoutMessage(
          payload?.status_message || "Transaksi gagal diproses."
        );
        overrideSnapRedirectUrls(payload, "/customer/cart?payment=error");
        setRetryPrompt({
          title: "Pembayaran Gagal",
          description:
            "Apakah Anda ingin melanjutkan transaksi dan mencoba membayar kembali?",
        });
        return;
      }

      if (status === "close") {
        closeSnapModal();
        setCheckoutStatus("warning");
        setCheckoutMessage("Pembayaran dibatalkan sebelum transaksi selesai.");
        overrideSnapRedirectUrls(payload, "/customer/cart?payment=cancelled");
        setRetryPrompt({
          title: "Transaksi Dibatalkan",
          description:
            "Anda menutup jendela pembayaran. Ingin melanjutkan transaksi sekarang?",
        });
      }
    },
    [closeSnapModal, scheduleRedirect, overrideSnapRedirectUrls]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.snap) {
      setSnapReady(true);
      return;
    }

    if (!MIDTRANS_CLIENT_KEY) {
      return;
    }

    let cancelled = false;
    const existing = document.querySelector(
      'script[data-midtrans-snap="true"]'
    );

    const handleLoad = () => {
      if (!cancelled) {
        setSnapReady(true);
      }
    };

    const handleError = () => {
      /* ignore load error notice to avoid noisy UI; snap fallback still works */
    };

    if (existing) {
      existing.addEventListener("load", handleLoad, { once: true });
      existing.addEventListener("error", handleError, { once: true });
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = MIDTRANS_SNAP_URL;
    script.async = true;
    script.setAttribute("data-client-key", MIDTRANS_CLIENT_KEY);
    script.setAttribute("data-midtrans-snap", "true");
    script.onload = handleLoad;
    script.onerror = handleError;
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  useEffect(() => {
    if (!snapModalVisible || !currentTransaction || !snapReady) {
      if (!snapModalVisible) {
        clearSnapEmbed();
      }
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const snap = window.snap;
    if (!snap || typeof snap.embed !== "function") {
      return;
    }

    snap.embed(currentTransaction.token, {
      embedId: SNAP_EMBED_CONTAINER_ID,
      onSuccess: (result) => handlePaymentResult("success", result),
      onPending: (result) => handlePaymentResult("pending", result),
      onError: (result) => handlePaymentResult("error", result),
      onClose: () => handlePaymentResult("close"),
    });

    return () => {
      clearSnapEmbed();
    };
  }, [
    snapModalVisible,
    currentTransaction,
    snapReady,
    clearSnapEmbed,
    handlePaymentResult,
  ]);

  useEffect(() => {
    if (!snapModalVisible) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [snapModalVisible]);

  const handleClear = useCallback(() => {
    dispatch(clearCartAction());
    setCouponMessage("");
    setCouponStatus(null);
  }, [dispatch]);

  const handleRemove = useCallback(
    (entryId) => {
      dispatch(removeItemAction(entryId));
    },
    [dispatch]
  );

  const handleApplyCoupon = useCallback(
    async (event) => {
      event.preventDefault();

      const codeToApply = couponCode.trim().toUpperCase();

      if (!codeToApply) {
        setCouponStatus("error");
        setCouponMessage("Masukkan kode kupon terlebih dahulu.");
        return;
      }

      if (!token) {
        setCouponStatus("error");
        setCouponMessage("Sesi tidak valid. Silakan login kembali.");
        return;
      }

      if (!cartPayload.length) {
        setCouponStatus("error");
        setCouponMessage("Keranjang masih kosong.");
        return;
      }

      setApplyingCoupon(true);
      setCouponStatus(null);
      setCouponMessage("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/customer/cart/redeem-coupon`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              code: codeToApply,
              items: cartPayload,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.message || "Gagal menerapkan kupon");
        }

        dispatch(applyCouponAction(data));
        setCouponStatus("success");
        setCouponMessage(
          data?.coupon?.code
            ? `Kupon ${data.coupon.code} berhasil diterapkan.`
            : "Kupon berhasil diterapkan."
        );
      } catch (error) {
        console.error("Apply coupon failed", error);
        setCouponStatus("error");
        setCouponMessage(error.message || "Gagal menerapkan kupon.");
      } finally {
        setApplyingCoupon(false);
      }
    },
    [couponCode, token, cartPayload, dispatch]
  );

  const handleRemoveCoupon = useCallback(() => {
    dispatch(clearCouponAction());
    setCouponStatus(null);
    setCouponMessage("");
    setCouponCode("");
  }, [dispatch]);

  const handleCloseSnapManually = useCallback(() => {
    handlePaymentResult("close");
  }, [handlePaymentResult]);

  const handleCheckout = useCallback(async () => {
    if (!token) {
      setCheckoutStatus("error");
      setCheckoutMessage("Sesi tidak valid. Silakan login kembali.");
      return;
    }

    if (!cartPayload.length) {
      setCheckoutStatus("error");
      setCheckoutMessage("Keranjang masih kosong.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutStatus(null);
    setCheckoutMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/customer/checkout/snap-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: cartPayload,
            couponCode: coupon?.code ?? null,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "Gagal memulai pembayaran.");
      }

      if (!data?.token) {
        throw new Error("Token Midtrans tidak tersedia.");
      }

      const snap = typeof window !== "undefined" ? window.snap : null;

      if (snap && typeof snap.pay === "function") {
        snap.pay(data.token, {
          onSuccess: (result) => handlePaymentResult("success", result),
          onPending: (result) => handlePaymentResult("pending", result),
          onError: (result) => handlePaymentResult("error", result),
          onClose: () => handlePaymentResult("close"),
        });
        return;
      }

      if (snap && typeof snap.embed === "function" && snapReady) {
        setCurrentTransaction({
          ...data,
          token: data.token,
        });
        setSnapModalVisible(true);
        return;
      }

      if (data.redirectUrl) {
        setCheckoutStatus("info");
        setCheckoutMessage("Mengalihkan ke halaman pembayaran Midtrans...");
        window.location.href = data.redirectUrl;
      } else {
        setCheckoutStatus("error");
        setCheckoutMessage(
          "Token dibuat tetapi Snap tidak tersedia. Segarkan halaman dan coba lagi."
        );
      }
    } catch (error) {
      console.error("Checkout failed", error);
      setCheckoutStatus("error");
      setCheckoutMessage(error.message || "Gagal memproses checkout.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [token, cartPayload, coupon, handlePaymentResult, snapReady]);

  return (
    <>
      <CustomerDashboardLayout title="Cart">
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-gray-200">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Keranjang Layanan
              </h1>
              <p className="text-gray-600">
                {items.length > 0
                  ? `Anda memiliki ${items.length} layanan dalam keranjang.`
                  : "Belum ada layanan di keranjang Anda."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Durasi</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatDuration(totalDuration)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-lg font-semibold text-red-500">
                  {currencyFormatter.format(subtotal)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                disabled={items.length === 0}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
              >
                Kosongkan Keranjang
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-10 rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-lg font-medium text-gray-700">
                Keranjang Anda masih kosong.
              </p>
              <p className="mt-2 text-gray-500">
                Tambahkan layanan melalui halaman pemesanan untuk mulai
                membangun paket Anda.
              </p>
              <a
                href="/customer/book"
                className="mt-6 inline-flex rounded-lg bg-red-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
              >
                Cari Layanan
              </a>
            </div>
          ) : (
            <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
              <div className="space-y-4">
                {items.map((item) => {
                  const scheduleDateText =
                    formatScheduleDate(item.schedule) || "-";
                  const scheduleTimeText =
                    getScheduleTimeLabel(item.schedule) || "-";

                  return (
                    <div
                      key={item.entryId}
                      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {item.name}
                        </h2>
                        {item.description ? (
                          <p className="mt-1 text-sm text-gray-600">
                            {item.description}
                          </p>
                        ) : null}
                        {item.cartExtras?.length > 0 && item.cartMain?.name ? (
                          <p className="mt-2 text-sm text-gray-600">
                            Layanan utama: {item.cartMain.name}
                          </p>
                        ) : null}
                        {item.cartExtras?.length > 0 ? (
                          <div className="mt-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500">
                              Layanan Tambahan
                            </p>
                            <ul className="mt-1 space-y-1">
                              {item.cartExtras.map((extra, extraIndex) => (
                                <li
                                  key={
                                    extra.serviceId ||
                                    `${item.entryId}-extra-${extraIndex}`
                                  }
                                  className="flex items-center justify-between text-sm text-gray-600"
                                >
                                  <span>{extra.name}</span>
                                  <span>
                                    {formatDuration(extra.durationMinutes)} |{" "}
                                    {currencyFormatter.format(extra.price)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {item.schedule ? (
                          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                            <p className="font-semibold">
                              Jadwal: {scheduleDateText}
                            </p>
                            <p className="mt-1">Waktu: {scheduleTimeText}</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Durasi
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatDuration(item.durationMinutes)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            Harga
                          </p>
                          <p className="text-base font-semibold text-red-500">
                            {currencyFormatter.format(item.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(item.entryId)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-red-300 hover:text-red-500"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <aside className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Ringkasan Pembayaran
                  </h2>
                  <p className="text-sm text-gray-600">
                    Pastikan detail layanan sudah sesuai sebelum melanjutkan ke
                    pembayaran.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold text-gray-900">
                      {currencyFormatter.format(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Diskon</span>
                    <span className="font-semibold text-red-500">
                      {discountAmount > 0
                        ? `- ${currencyFormatter.format(discountAmount)}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-3 text-base font-semibold">
                    <span className="text-gray-700">Total Bayar</span>
                    <span className="text-emerald-600">
                      {currencyFormatter.format(payable)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      Kupon
                    </span>
                    {coupon?.code ? (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-sm font-medium text-red-500 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    ) : null}
                  </div>

                  {coupon?.code ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                      <p className="font-semibold">
                        Kupon {coupon.code} diterapkan.
                      </p>
                      <p className="mt-1 text-emerald-600">
                        Penghematan {currencyFormatter.format(discountAmount)}.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value)}
                        placeholder="Masukkan kode kupon"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-200"
                      />
                      <button
                        type="submit"
                        disabled={applyingCoupon}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                      >
                        {applyingCoupon ? "Memproses..." : "Terapkan"}
                      </button>
                    </form>
                  )}

                  {couponMessage ? (
                    <p
                      className={`text-sm ${
                        couponStatus === "success"
                          ? "text-emerald-600"
                          : "text-red-600"
                      }`}
                    >
                      {couponMessage}
                    </p>
                  ) : null}
                </div>

                {checkoutMessage ? (
                  <p
                    className={`rounded-lg border p-3 text-sm ${
                      checkoutStatus === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : checkoutStatus === "error"
                        ? "border-red-200 bg-red-50 text-red-600"
                        : "border-yellow-200 bg-yellow-50 text-yellow-700"
                    }`}
                  >
                    {checkoutMessage}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={
                      checkoutLoading || items.length === 0 || payable <= 0
                    }
                    className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {checkoutLoading
                      ? "Menghubungkan Midtrans..."
                      : "Bayar dengan Midtrans"}
                  </button>
                  <p className="text-xs text-gray-500">
                    Pembayaran diproses secara aman melalui Midtrans Snap.
                    {snapReady ? "" : " Script Snap akan dimuat otomatis."}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </CustomerDashboardLayout>
      {snapModalVisible && currentTransaction ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="relative flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Selesaikan Pembayaran
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Midtrans Snap akan dimuat di bawah ini. Ikuti instruksi untuk
                  menyelesaikan transaksi Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseSnapManually}
                className="rounded-full border border-gray-200 p-2 text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Tutup pembayaran"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 pt-4">
              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                <div className="text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Nomor Order</p>
                  <p className="mt-0.5 font-mono text-gray-700">
                    {currentTransaction.orderId || "-"}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">
                    Total Pembayaran
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-emerald-600">
                    {currencyFormatter.format(
                      currentTransaction.total ?? payable
                    )}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Subtotal</p>
                  <p className="mt-0.5">
                    {currencyFormatter.format(
                      currentTransaction.subtotal ?? subtotal
                    )}
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="font-semibold text-gray-800">Diskon</p>
                  <p className="mt-0.5 text-red-500">
                    {currentTransaction.discountAmount
                      ? `- ${currencyFormatter.format(
                          currentTransaction.discountAmount
                        )}`
                      : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 pt-3">
              <div
                id={SNAP_EMBED_CONTAINER_ID}
                ref={snapContainerRef}
                className="min-h-[520px] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
              />
              <p className="mt-4 text-xs text-gray-500">
                Jika Anda menutup jendela ini, transaksi akan dibatalkan.
                Pastikan pembayaran selesai sebelum keluar.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default CustomerCart;
