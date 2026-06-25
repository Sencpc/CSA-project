import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sortable from "sortablejs";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../../context/AuthContext";
import { addItem, selectCartCount } from "../../../store/cartSlice";
import { API_BASE_URL } from "../../../config/env.js";

const resolveServiceId = (service) =>
  service?.id ?? service?._id ?? service?.serviceId ?? service?.slug ?? "";

const resolveServiceDuration = (service) => {
  const raw = Number(
    service?.durationMinutes ?? service?.duration ?? service?.duration_min
  );
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  return raw;
};

const resolveServicePrice = (service) => {
  const raw = Number(service?.priceMin ?? service?.price ?? 0);
  if (!Number.isFinite(raw) || raw < 0) {
    return 0;
  }
  return raw;
};

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const monthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});

const scheduleDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateKeyFromDate = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) {
    return null;
  }
  return date.toISOString().split("T")[0];
};

const parseDateKey = (dateKey) => {
  if (typeof dateKey !== "string" || dateKey.length === 0) {
    return null;
  }
  const [year, month, day] = dateKey
    .split("-")
    .map((segment) => Number(segment));
  if ([year, month, day].some((value) => !Number.isFinite(value))) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const monthParamFromDate = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthParamFromDateKey = (dateKey) =>
  typeof dateKey === "string" && dateKey.length >= 7
    ? dateKey.slice(0, 7)
    : null;

const formatMinutesToClock = (minutes) => {
  if (!Number.isFinite(minutes)) {
    return "";
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const pad = (value) => value.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(mins)}`;
};

const Book = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cartCount = useSelector(selectCartCount);

  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [totals, setTotals] = useState({ minutes: 0, price: 0 });
  const [selectionCount, setSelectionCount] = useState(0);
  const [toast, setToast] = useState({ message: "", visible: false });
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [pendingPackage, setPendingPackage] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [availabilitySummary, setAvailabilitySummary] = useState({
    totalStaff: 0,
    workStart: "08:00",
    workEnd: "17:00",
  });
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [slotOptions, setSlotOptions] = useState([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const serviceListRef = useRef(null);
  const slotRefs = useRef([]);
  const toastTimeoutRef = useRef(null);
  const scheduleModalOpenRef = useRef(false);

  const fetchServices = useCallback(
    async (signal) => {
      if (!token) {
        setServices([]);
        setFilteredServices([]);
        setError("Silakan masuk untuk melihat daftar layanan.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/customer/services`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          ...(signal ? { signal } : {}),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || "Failed to load services");
        }

        const payload = await response.json();
        const list = Array.isArray(payload?.services)
          ? payload.services.filter((service) => service)
          : [];

        setServices(list);
        setFilteredServices(list);
      } catch (err) {
        if (signal?.aborted || err.name === "AbortError") {
          return;
        }
        console.error("Failed to load services", err);
        setServices([]);
        setFilteredServices([]);
        setError(err.message || "Gagal memuat layanan");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [token]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchServices(controller.signal);
    return () => controller.abort();
  }, [fetchServices]);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      setFilteredServices(services);
      return;
    }

    const filtered = services.filter((service) => {
      const name = (service?.name || service?.title || "")
        .toString()
        .toLowerCase();
      const description = (service?.description || "").toString().toLowerCase();
      return (
        name.includes(query) ||
        description.includes(query) ||
        resolveServiceId(service).toString().toLowerCase().includes(query)
      );
    });
    setFilteredServices(filtered);
  }, [searchQuery, services]);

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  }, []);

  const formatTotalDuration = useCallback((minutes) => {
    if (minutes <= 0) {
      return "0 menit";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    const segments = [];

    if (hours > 0) {
      segments.push(`${hours} ${hours === 1 ? "jam" : "jam"}`);
    }

    if (remainingMinutes > 0) {
      segments.push(`${remainingMinutes} menit`);
    }

    return segments.join(" ");
  }, []);

  const calculateTotals = useCallback(() => {
    const slots = slotRefs.current.filter(Boolean);
    let totalMinutes = 0;
    let totalPrice = 0;
    let itemCount = 0;

    slots.forEach((slot) => {
      slot.querySelectorAll(".service-item").forEach((item) => {
        totalMinutes += Number(item.dataset.duration ?? 0);
        totalPrice += Number(item.dataset.price ?? 0);
        itemCount += 1;
      });
    });

    setTotals({ minutes: totalMinutes, price: totalPrice });
    setSelectionCount(itemCount);
  }, []);

  const showToast = useCallback((message) => {
    if (!message) {
      return;
    }

    setToast({ message, visible: true });
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast({ message: "", visible: false });
      toastTimeoutRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    scheduleModalOpenRef.current = scheduleModalOpen;
  }, [scheduleModalOpen]);

  useEffect(() => {
    if (!isModalOpen && !scheduleModalOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen, scheduleModalOpen]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    const serviceListElement = serviceListRef.current;
    const slots = slotRefs.current.filter(Boolean);

    if (!serviceListElement || slots.length === 0) {
      return undefined;
    }

    setSelectionCount(0);
    setTotals({ minutes: 0, price: 0 });

    const placeholderMessages = [
      "<strong>Main Service</strong><br />(Drag here)",
      "<strong>+ Extra Service</strong><br />(Optional)",
      "<strong>+ Extra Service</strong><br />(Optional)",
      "<strong>+ Extra Service</strong><br />(Optional)",
    ];

    const placeholderBySlot = new Map(
      slots.map((slot, index) => [slot, placeholderMessages[index] ?? ""])
    );

    const removePlaceholder = (slotEl) => {
      if (!slotEl) {
        return;
      }
      const placeholder = slotEl.querySelector(".placeholder-text");
      if (placeholder) {
        placeholder.remove();
      }
    };

    const ensurePlaceholder = (slotEl) => {
      if (!slotEl) {
        return;
      }

      const hasItem = slotEl.querySelector(".service-item");
      if (!hasItem) {
        const span = document.createElement("span");
        span.className = "placeholder-text text-slate-500 text-sm text-center";
        span.innerHTML = placeholderBySlot.get(slotEl) ?? "";
        slotEl.appendChild(span);
      }
    };

    const attachRemoveButton = (item, slotEl) => {
      const serviceName = item.dataset.name || "Item";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className =
        "remove-btn text-red-500 hover:text-red-700 ml-auto pl-1 flex-shrink-0";
      removeBtn.innerHTML =
        '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';

      removeBtn.addEventListener("click", () => {
        item.remove();
        ensurePlaceholder(slotEl);
        calculateTotals();
        showToast(`${serviceName} removed from selection`);
      });

      item.appendChild(removeBtn);
    };

    const renderSlotItem = (slotEl, service) => {
      if (!slotEl || !service) {
        return;
      }

      removePlaceholder(slotEl);

      const item = document.createElement("div");
      item.className =
        "service-item flex items-center p-3 pr-2 w-full bg-slate-50 rounded-lg shadow-sm border border-slate-200";
      const displayName = service?.name || service?.title || "Service";
      const resolvedId = resolveServiceId(service);
      const durationValue = resolveServiceDuration(service);
      const priceValue = resolveServicePrice(service);
      item.dataset.id = resolvedId || displayName;
      item.dataset.name = displayName;
      item.dataset.duration = String(durationValue);
      item.dataset.price = String(priceValue);

      item.innerHTML = `
        <div class="flex-grow overflow-hidden mr-2">
          <p class="font-semibold text-slate-800 text-sm truncate" title="${displayName}">${displayName}</p>
          <p class="text-xs text-slate-500">${durationValue} menit</p>
        </div>
        <p class="text-sm font-semibold text-slate-900">${formatPrice(
          priceValue
        )}</p>
      `;

      attachRemoveButton(item, slotEl);
      slotEl.appendChild(item);
      calculateTotals();
      showToast(`${displayName} added to selection`);
    };

    slots.forEach((slot) => {
      slot.innerHTML = "";
    });

    slots.forEach((slot) => {
      ensurePlaceholder(slot);
    });

    const listSortable = new Sortable(serviceListElement, {
      group: {
        name: "services",
        pull: "clone",
        put: false,
      },
      animation: 150,
      sort: false,
    });

    const slotSortables = slots.map((slotEl) => {
      return new Sortable(slotEl, {
        group: { name: "services" },
        animation: 150,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        onAdd: (evt) => {
          const item = evt.item;
          const slotElement = evt.to;

          removePlaceholder(slotElement);

          const otherItems = Array.from(
            slotElement.querySelectorAll(".service-item")
          ).filter((serviceItem) => serviceItem !== item);

          if (otherItems.length > 0) {
            if (evt.from && evt.from !== serviceListElement) {
              const originSlot = evt.from;
              slotElement.removeChild(item);
              removePlaceholder(originSlot);
              originSlot.appendChild(item);
            } else {
              slotElement.removeChild(item);
            }

            showToast(
              "Setiap slot hanya dapat berisi satu layanan. Hapus layanan yang ada terlebih dahulu."
            );
            ensurePlaceholder(slotElement);
            calculateTotals();
            return;
          }

          const duration = Number(item.dataset.duration ?? 0);
          const price = Number(item.dataset.price ?? 0);
          const name = item.dataset.name ?? "";
          const displayName = name || "Service";

          item.className =
            "service-item flex items-center p-3 pr-2 w-full bg-slate-50 rounded-lg shadow-sm border border-slate-200";
          item.style.position = "static";
          item.innerHTML = `
            <div class="flex-grow overflow-hidden mr-2">
              <p class="font-semibold text-slate-800 text-sm truncate" title="${displayName}">${displayName}</p>
              <p class="text-xs text-slate-500">${duration} menit</p>
            </div>
            <p class="text-sm font-semibold text-slate-900">${formatPrice(
              price
            )}</p>
          `;
          item.dataset.duration = String(duration);
          item.dataset.price = String(price);
          item.dataset.name = displayName;

          attachRemoveButton(item, slotElement);
          calculateTotals();

          const isFromServiceList =
            evt.from === serviceListElement || evt.pullMode === "clone";

          if (isFromServiceList) {
            showToast(`${displayName} added to selection`);
          }
        },
        onRemove: (evt) => {
          const slotElement = evt.from;
          ensurePlaceholder(slotElement);
          calculateTotals();
        },
      });
    });

    if (selectedService) {
      renderSlotItem(slots[0], selectedService);
    } else {
      calculateTotals();
    }

    return () => {
      listSortable.destroy();
      slotSortables.forEach((sortable) => sortable.destroy());
    };
  }, [isModalOpen, selectedService, calculateTotals, formatPrice, showToast]);

  const handleBookClick = (service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedService(null);
    setTotals({ minutes: 0, price: 0 });
    setSelectionCount(0);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToast({ message: "", visible: false });
  };

  const loadAvailabilitySlots = useCallback(
    async (dateKey) => {
      if (!token || !pendingPackage || !dateKey) {
        setSlotOptions([]);
        return [];
      }

      setSlotLoading(true);
      setSlotError("");

      const params = new URLSearchParams();
      const monthParam =
        monthParamFromDateKey(dateKey) || monthParamFromDate(calendarCursor);
      if (monthParam) {
        params.set("month", monthParam);
      }
      params.set("date", dateKey);

      if (pendingPackage?.durationMinutes) {
        params.set(
          "durationMinutes",
          String(Math.max(pendingPackage.durationMinutes, 0))
        );
      }

      const query = params.toString();
      const url = `${API_BASE_URL}/api/customer/availability${
        query ? `?${query}` : ""
      }`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        let data;
        if (response.ok) {
          data = await response.json();
        } else {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || "Gagal memuat slot waktu");
        }

        const options = Array.isArray(data?.slots?.options)
          ? data.slots.options
          : [];

        if (!scheduleModalOpenRef.current) {
          return [];
        }

        setSlotOptions(options);
        setSlotError("");
        return options;
      } catch (error) {
        console.error("Failed to load availability slots", error);
        if (scheduleModalOpenRef.current) {
          setSlotOptions([]);
          setSlotError(error.message || "Gagal memuat slot waktu");
        }
        return [];
      } finally {
        setSlotLoading(false);
      }
    },
    [token, pendingPackage, calendarCursor]
  );

  const loadAvailabilityMonth = useCallback(
    async (targetDate) => {
      if (!token || !pendingPackage) {
        setAvailabilityDays([]);
        return null;
      }

      setAvailabilityLoading(true);
      setAvailabilityError("");

      const params = new URLSearchParams();
      const monthParam = monthParamFromDate(targetDate);
      if (monthParam) {
        params.set("month", monthParam);
      }
      if (pendingPackage?.durationMinutes) {
        params.set(
          "durationMinutes",
          String(Math.max(pendingPackage.durationMinutes, 0))
        );
      }

      const query = params.toString();
      const url = `${API_BASE_URL}/api/customer/availability${
        query ? `?${query}` : ""
      }`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        let data;
        if (response.ok) {
          data = await response.json();
        } else {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || "Gagal memuat ketersediaan");
        }

        const days = Array.isArray(data?.days) ? data.days : [];
        if (!scheduleModalOpenRef.current) {
          return data;
        }

        setAvailabilityDays(days);
        setAvailabilitySummary({
          totalStaff: data?.staff?.totalStaff ?? 0,
          workStart: data?.staff?.workStart ?? "08:00",
          workEnd: data?.staff?.workEnd ?? "17:00",
        });
        setAvailabilityError("");
        return data;
      } catch (error) {
        console.error("Failed to load availability", error);
        if (scheduleModalOpenRef.current) {
          setAvailabilityDays([]);
          setAvailabilitySummary({
            totalStaff: 0,
            workStart: "08:00",
            workEnd: "17:00",
          });
          setAvailabilityError(error.message || "Gagal memuat ketersediaan");
        }
        return null;
      } finally {
        setAvailabilityLoading(false);
      }
    },
    [token, pendingPackage]
  );

  const handleCalendarPrev = useCallback(() => {
    setCalendarCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }, []);

  const handleCalendarNext = useCallback(() => {
    setCalendarCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }, []);

  const handleDateSelect = useCallback(
    async (dateKey, isSelectable) => {
      if (!isSelectable) {
        return;
      }
      setSlotError("");
      setSelectedDate(dateKey);
      const options = await loadAvailabilitySlots(dateKey);
      const nextSelected = options.find((option) => option.available) || null;
      setSelectedSlot(nextSelected);
    },
    [loadAvailabilitySlots]
  );

  const handleSlotSelect = useCallback((slot) => {
    if (!slot?.available) {
      return;
    }
    setSelectedSlot(slot);
    setSlotError("");
  }, []);

  const handleCloseScheduleModal = useCallback(() => {
    setScheduleModalOpen(false);
    setPendingPackage(null);
    setAvailabilityDays([]);
    setAvailabilitySummary({
      totalStaff: 0,
      workStart: "08:00",
      workEnd: "17:00",
    });
    setAvailabilityError("");
    setAvailabilityLoading(false);
    setSlotOptions([]);
    setSlotError("");
    setSlotLoading(false);
    setSelectedDate(null);
    setSelectedSlot(null);
    const now = new Date();
    setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  const handleConfirmSchedule = useCallback(() => {
    if (!pendingPackage || !selectedDate || !selectedSlot) {
      setSlotError("Pilih tanggal dan waktu terlebih dahulu");
      return;
    }

    const schedulePayload = {
      date: selectedDate,
      startMinutes: selectedSlot.startMinutes,
      endMinutes: selectedSlot.endMinutes,
      startTime: formatMinutesToClock(selectedSlot.startMinutes),
      endTime: formatMinutesToClock(selectedSlot.endMinutes),
      label: selectedSlot.label,
    };

    dispatch(addItem({ ...pendingPackage, schedule: schedulePayload }));
    handleCloseScheduleModal();
    showToast("Paket layanan ditambahkan ke cart");
  }, [
    dispatch,
    pendingPackage,
    selectedDate,
    selectedSlot,
    handleCloseScheduleModal,
    showToast,
  ]);

  const handleConfirmBooking = () => {
    const slotElements = slotRefs.current.filter(Boolean);
    const detailedSelections = [];

    slotElements.forEach((slot, slotIndex) => {
      let itemOrder = 0;
      slot.querySelectorAll(".service-item").forEach((item) => {
        detailedSelections.push({
          slotIndex,
          order: itemOrder,
          id: item.dataset.id,
          name: item.dataset.name,
          durationMinutes: Number(item.dataset.duration ?? 0),
          price: Number(item.dataset.price ?? 0),
        });
        itemOrder += 1;
      });
    });

    if (detailedSelections.length === 0) {
      showToast("Tambahkan layanan ke pilihan terlebih dahulu");
      return;
    }

    detailedSelections.sort((a, b) => {
      if (a.slotIndex !== b.slotIndex) {
        return a.slotIndex - b.slotIndex;
      }
      return a.order - b.order;
    });

    const selectionsWithSource = detailedSelections.map((selection) => {
      const source = services.find((service) => {
        const resolvedId = resolveServiceId(service) || service?.name || "";
        return (
          resolvedId === selection.id ||
          service?.name === selection.name ||
          service?.title === selection.name
        );
      });

      return {
        ...selection,
        source,
      };
    });

    const buildPayload = (detail) => {
      if (!detail) {
        return null;
      }

      const base = detail.source || {
        id: detail.id,
        name: detail.name,
        priceMin: detail.price,
        durationMinutes: detail.durationMinutes,
        description: "",
      };

      const serviceId =
        resolveServiceId(base) ||
        base?.id ||
        base?.name ||
        detail.id ||
        detail.name;

      return {
        serviceId,
        name: base?.name || base?.title || detail.name || "Service",
        description: base?.description || "",
        price: Number(detail.price) || 0,
        durationMinutes: Number(detail.durationMinutes) || 0,
      };
    };

    const mainSelection = selectionsWithSource[0];
    const extrasSelections = selectionsWithSource.slice(1);

    const mainServicePayload = buildPayload(mainSelection);

    if (!mainServicePayload) {
      showToast("Pilih layanan utama terlebih dahulu");
      return;
    }
    const extrasPayload = extrasSelections
      .map((detail) => buildPayload(detail))
      .filter(Boolean);

    const totalPrice = selectionsWithSource.reduce(
      (acc, item) => acc + (Number(item.price) || 0),
      0
    );

    const totalDuration = selectionsWithSource.reduce(
      (acc, item) => acc + (Number(item.durationMinutes) || 0),
      0
    );

    const extrasNames = extrasPayload
      .map((extra) => extra.name)
      .filter(Boolean);

    const combinedName = extrasNames.length
      ? `${mainServicePayload?.name ?? "Paket Layanan"} (+${
          extrasNames.length
        } ekstra)`
      : mainServicePayload?.name ?? "Paket Layanan";

    const combinedDescription = extrasNames.length
      ? `Termasuk layanan tambahan: ${extrasNames.join(", ")}.`
      : mainServicePayload?.description || "";

    const packagePayload = {
      name: combinedName,
      description: combinedDescription,
      price: totalPrice,
      durationMinutes: totalDuration,
      cartMain: mainServicePayload,
      cartExtras: extrasPayload,
    };

    setPendingPackage(packagePayload);
    setAvailabilityDays([]);
    setAvailabilitySummary({
      totalStaff: 0,
      workStart: "08:00",
      workEnd: "17:00",
    });
    setAvailabilityError("");
    setSlotOptions([]);
    setSlotError("");
    setSelectedDate(null);
    setSelectedSlot(null);
    const now = new Date();
    setCalendarCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setScheduleModalOpen(true);
    handleCloseModal();
  };

  useEffect(() => {
    if (!scheduleModalOpen || !pendingPackage) {
      return;
    }

    let cancelled = false;

    setAvailabilityError("");
    setSlotError("");

    const run = async () => {
      const data = await loadAvailabilityMonth(calendarCursor);
      if (cancelled || !scheduleModalOpen) {
        return;
      }

      const daysList = Array.isArray(data?.days) ? data.days : [];
      let targetDate = selectedDate;

      const hasSelected = targetDate
        ? daysList.some(
            (day) => day.date === targetDate && day.fitsRequest && !day.isClosed
          )
        : false;

      if (!hasSelected) {
        targetDate =
          daysList.find((day) => day.fitsRequest && !day.isClosed)?.date ||
          null;
        setSelectedDate(targetDate);
      }

      if (targetDate) {
        const options = await loadAvailabilitySlots(targetDate);
        if (cancelled || !scheduleModalOpen) {
          return;
        }
        const firstAvailable =
          options.find((option) => option.available) || null;
        setSelectedSlot(firstAvailable);
      } else {
        setSlotOptions([]);
        setSelectedSlot(null);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    scheduleModalOpen,
    pendingPackage,
    calendarCursor,
    loadAvailabilityMonth,
    loadAvailabilitySlots,
  ]);

  const availabilityMap = useMemo(() => {
    const map = new Map();
    availabilityDays.forEach((day) => {
      if (day?.date) {
        map.set(day.date, day);
      }
    });
    return map;
  }, [availabilityDays]);

  const calendarCells = useMemo(() => {
    const cells = [];
    const firstDay = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth(),
      1
    );
    const lastDay = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth() + 1,
      0
    );

    const leadingBlanks = firstDay.getDay();
    for (let index = 0; index < leadingBlanks; index += 1) {
      cells.push(null);
    }

    const totalDays = lastDay.getDate();
    for (let day = 1; day <= totalDays; day += 1) {
      const dateInstance = new Date(
        calendarCursor.getFullYear(),
        calendarCursor.getMonth(),
        day
      );
      cells.push({ date: dateInstance, key: dateKeyFromDate(dateInstance) });
    }

    return cells;
  }, [calendarCursor]);

  const monthLabel = useMemo(
    () => monthFormatter.format(calendarCursor),
    [calendarCursor]
  );

  const selectedDateInstance = selectedDate ? parseDateKey(selectedDate) : null;
  const selectedDateLabel = selectedDateInstance
    ? scheduleDateFormatter.format(selectedDateInstance)
    : "";

  return (
    <div className="min-h-screen bg-gray-50 py-15">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Our Services
          </h1>
          <p className="text-gray-600">Pilih layanan terbaik untuk Anda</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari layanan..."
              className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>
        </div>

        {/* Services Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 rounded-full border-b-2 border-red-400 motion-safe:animate-spin"></div>
            <p className="mt-4 text-gray-600">Loading services...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-600">
            {error}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Layanan tidak ditemukan
            </h3>
            <p className="mt-2 text-gray-600">
              Coba kata kunci lain atau hapus filter
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service, index) => {
              const displayName = service?.name || service?.title || "Service";
              const serviceId =
                resolveServiceId(service) ||
                service?.slug ||
                service?.name ||
                `service-${index}`;
              const durationValue = resolveServiceDuration(service);
              const priceValue = resolveServicePrice(service);
              const description =
                service?.description?.trim?.() ||
                "Deskripsi layanan belum tersedia.";

              return (
                <div
                  key={serviceId}
                  className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
                >
                  <div className="p-6">
                    {/* Service Name */}
                    <h3 className="mb-2 text-xl font-semibold text-gray-900 transition-colors group-hover:text-red-400">
                      {displayName}
                    </h3>

                    {/* Description */}
                    <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                      {description}
                    </p>

                    {/* Details */}
                    <div className="mb-4 space-y-2">
                      {/* Duration */}
                      <div className="flex items-center text-sm text-gray-700">
                        <svg
                          className="mr-2 h-5 w-5 text-red-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        <span>
                          {durationValue > 0
                            ? `${durationValue} menit`
                            : "Durasi belum tersedia"}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="flex items-center text-sm text-gray-700">
                        <svg
                          className="mr-2 h-5 w-5 text-red-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          ></path>
                        </svg>
                        <span className="font-semibold text-gray-900">
                          {formatPrice(priceValue)}
                        </span>
                      </div>
                    </div>

                    {/* Book Button */}
                    <button
                      onClick={() => handleBookClick(service)}
                      className="w-full rounded-lg bg-red-400 py-2.5 font-medium text-white transition-colors hover:bg-red-500"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl transform transition-transform"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">
                Customize Your Booking
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between md:space-x-3 space-y-3 md:space-y-0 mb-6">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={`slot-${index}`}
                    className="flex items-center w-full md:w-1/4 gap-2"
                  >
                    <div
                      ref={(element) => {
                        slotRefs.current[index] = element;
                      }}
                      className="drop-slot w-full border-2 border-dashed border-slate-300 bg-slate-50 min-h-[110px] flex flex-col items-stretch justify-center rounded-lg p-3 text-center transition-colors gap-2"
                    />
                    {index < 3 && (
                      <span className="hidden md:block text-gray-400 font-bold">
                        &gt;
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Seret layanan dari daftar di bawah ini ke slot di atas untuk
                menyusun pemesanan Anda.
              </p>

              <h4 className="text-lg font-semibold text-gray-800 mb-3">
                Available Services
              </h4>
              <ul
                ref={serviceListRef}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-1"
              >
                {services.map((service, index) => {
                  const displayName =
                    service?.name || service?.title || "Service";
                  const serviceId =
                    resolveServiceId(service) ||
                    service?.slug ||
                    service?.name ||
                    `service-${index}`;
                  const durationValue = resolveServiceDuration(service);
                  const priceValue = resolveServicePrice(service);

                  return (
                    <li
                      key={serviceId}
                      className="service-item flex cursor-move flex-col justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-150 ease-out hover:shadow-md"
                      data-id={serviceId}
                      data-name={displayName}
                      data-duration={durationValue}
                      data-price={priceValue}
                    >
                      <div className="flex-grow">
                        <p className="break-words text-sm font-semibold text-gray-800">
                          {displayName}
                        </p>
                      </div>
                      <div className="mt-2 w-full">
                        <p className="text-xs text-gray-500">
                          {durationValue > 0
                            ? `${durationValue} menit`
                            : "Durasi belum tersedia"}
                        </p>
                        <p className="mt-1 text-base font-semibold text-gray-900">
                          {formatPrice(priceValue)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-gray-50 border-t border-gray-200 rounded-b-xl gap-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Durasi
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatTotalDuration(totals.minutes)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Biaya
                  </p>
                  <p className="text-2xl font-bold text-red-500">
                    {formatPrice(totals.price)}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {selectionCount > 0
                  ? `${selectionCount} layanan dipilih`
                  : "Belum ada layanan dipilih"}
              </div>

              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={selectionCount === 0}
                className={`w-full sm:w-auto px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors ${
                  selectionCount === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-red-500 text-white hover:bg-red-600"
                }`}
              >
                {selectionCount === 0
                  ? "Pilih layanan terlebih dahulu"
                  : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      )}
      {scheduleModalOpen && pendingPackage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={handleCloseScheduleModal}
        >
          <div
            className="w-full max-w-7xl rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  Pilih Jadwal Layanan
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Tentukan tanggal dan waktu agar tim kami dapat menyiapkan slot
                  untuk Anda.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseScheduleModal}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Paket Layanan
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {pendingPackage.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    Durasi {formatTotalDuration(pendingPackage.durationMinutes)}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Estimasi Biaya
                  </p>
                  <p className="text-lg font-semibold text-red-500">
                    {formatPrice(pendingPackage.price)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="relative rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleCalendarPrev}
                      className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100"
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
                          d="m15 19-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {monthLabel}
                    </h4>
                    <button
                      type="button"
                      onClick={handleCalendarNext}
                      className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-100"
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
                          d="m9 5 7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500">
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={`weekday-${label}`}>{label}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-sm">
                    {calendarCells.map((cell, index) => {
                      if (!cell) {
                        return <span key={`empty-${index}`} className="h-10" />;
                      }

                      const dayKey = cell.key;
                      const dayInfo = availabilityMap.get(dayKey);
                      const isSelected = selectedDate === dayKey;
                      const isSelectable =
                        Boolean(dayInfo) &&
                        !dayInfo.isClosed &&
                        dayInfo.fitsRequest;

                      let className =
                        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition";
                      let title = scheduleDateFormatter.format(cell.date);

                      if (!dayInfo || dayInfo.isClosed) {
                        className +=
                          " cursor-not-allowed bg-gray-200 text-gray-400";
                        title += " — Tidak beroperasi";
                      } else if (!dayInfo.fitsRequest) {
                        className += " bg-red-500 text-white";
                        title += " — Slot penuh";
                      } else {
                        className +=
                          " bg-emerald-500 text-white hover:bg-emerald-600";
                      }

                      if (isSelected) {
                        className += " ring-2 ring-offset-2 ring-red-400";
                      }

                      return (
                        <button
                          key={dayKey}
                          type="button"
                          onClick={() => handleDateSelect(dayKey, isSelectable)}
                          className={className}
                          disabled={!isSelectable}
                          title={title}
                        >
                          {cell.date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-emerald-500" />
                      Tersedia
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-500" />
                      Penuh / Tidak cukup durasi
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-gray-300" />
                      Tutup
                    </span>
                  </div>

                  {availabilityError && (
                    <p className="mt-4 text-sm text-red-600">
                      {availabilityError}
                    </p>
                  )}

                  {availabilityLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                      <div className="h-9 w-9 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    </div>
                  )}
                </div>

                <div className="relative flex max-h-[500px] flex-col rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      Pilih Waktu
                    </h4>
                    <p className="mt-1 text-sm text-gray-600">
                      {availabilitySummary.totalStaff > 0
                        ? `Kapasitas ${availabilitySummary.totalStaff} staf • ${availabilitySummary.workStart} – ${availabilitySummary.workEnd}`
                        : "Data kapasitas staf belum tersedia."}
                    </p>
                  </div>

                  <div className="mt-4 flex-1 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {slotOptions.map((slot) => {
                        const key = `${slot.startMinutes}-${slot.endMinutes}`;
                        const isSelectedSlot =
                          selectedSlot?.startMinutes === slot.startMinutes &&
                          selectedSlot?.endMinutes === slot.endMinutes;

                        let className =
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-sm transition";

                        if (!slot.available) {
                          className +=
                            " cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400";
                        } else if (isSelectedSlot) {
                          className +=
                            " border-red-500 bg-red-500 text-white shadow";
                        } else {
                          className +=
                            " border-emerald-400 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50";
                        }

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleSlotSelect(slot)}
                            disabled={!slot.available}
                            className={className}
                          >
                            <span className="font-semibold">{slot.label}</span>
                            <span className="mt-1 text-xs">
                              {slot.available
                                ? `Sisa kapasitas ${slot.remainingCapacity}`
                                : "Penuh"}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {!slotLoading && slotOptions.length === 0 && !slotError && (
                      <p className="mt-6 text-sm text-gray-500">
                        Tidak ada slot tersedia pada tanggal ini.
                      </p>
                    )}
                  </div>

                  {slotError && (
                    <p className="mt-4 text-sm text-red-600">{slotError}</p>
                  )}

                  {slotLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm">
                      <div className="h-9 w-9 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {selectedDate ? (
                    <>
                      <span className="font-medium text-gray-800">
                        {selectedDateLabel}
                      </span>
                      {selectedSlot ? (
                        <span className="ml-2 inline-flex items-center gap-2 text-gray-600">
                          <span className="hidden sm:inline">•</span>
                          {selectedSlot.label}
                        </span>
                      ) : (
                        <span className="ml-2 text-gray-500">
                          Pilih jam yang tersedia
                        </span>
                      )}
                    </>
                  ) : (
                    "Pilih tanggal yang tersedia untuk melanjutkan"
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseScheduleModal}
                    className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSchedule}
                    disabled={!selectedDate || !selectedSlot || slotLoading}
                    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                      !selectedDate || !selectedSlot || slotLoading
                        ? "cursor-not-allowed bg-gray-300 text-gray-500"
                        : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  >
                    Simpan Jadwal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[60]">
        <button
          type="button"
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-lg border border-gray-200 hover:shadow-xl transition-shadow"
          aria-label="Cart"
          onClick={() => navigate("/customer/cart")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-8 h-8 text-red-500"
          >
            <path d="M7 4h-2.5a1 1 0 1 1 0-2H7a1 1 0 0 1 .97.757L8.61 5H20a1 1 0 0 1 .967 1.255l-2 8A1 1 0 0 1 18 15H9a1 1 0 0 1-.97-.757L6.39 5.03 6.26 4.5A1 1 0 0 1 7 4Zm2.28 9H17.2l1.5-6H8.72l.56 2.24zm-.28 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          </svg>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
              {cartCount}
            </span>
          )}
        </button>
      </div>
      {toast.visible && (
        <div className="fixed top-6 right-6 z-[70]">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-white shadow-xl">
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
                d="m5 12 4 4 10-10"
              />
            </svg>
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Book;
