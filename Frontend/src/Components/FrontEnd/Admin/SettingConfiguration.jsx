import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const emptyHoursRow = () => ({ day: "", open: "", close: "" });

const normalizeHours = (hours) => {
	if (!Array.isArray(hours) || hours.length === 0) {
		return [emptyHoursRow()];
	}
	return hours.map((row) => ({
		day: typeof row?.day === "string" ? row.day : "",
		open: typeof row?.open === "string" ? row.open : "",
		close: typeof row?.close === "string" ? row.close : "",
	}));
};

const SettingConfiguration = () => {
	const { token } = useAuth();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const [general, setGeneral] = useState({
		businessName: "",
		description: "",
		address: "",
		phone: "",
		email: "",
		social: { instagram: "", facebook: "", tiktok: "" },
		hours: [emptyHoursRow()],
	});

	const [appearance, setAppearance] = useState({
		logoUrl: "",
	});

	const canSave = useMemo(() => !loading && !saving, [loading, saving]);

	useEffect(() => {
		let mounted = true;

		const load = async () => {
			setLoading(true);
			setError("");
			setSuccess("");
			try {
				const response = await fetch(`${API_BASE_URL}/api/settings`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				const data = await response.json();
				if (!response.ok) {
					throw new Error(data?.message || "Failed to load settings");
				}

				const settings = data?.settings ?? {};
				const nextGeneral = settings.general ?? {};
				const nextAppearance = settings.appearance ?? {};

				if (!mounted) return;

				setGeneral({
					businessName: nextGeneral.businessName || "",
					description: nextGeneral.description || "",
					address: nextGeneral.address || "",
					phone: nextGeneral.phone || "",
					email: nextGeneral.email || "",
					social: {
						instagram: nextGeneral?.social?.instagram || "",
						facebook: nextGeneral?.social?.facebook || "",
						tiktok: nextGeneral?.social?.tiktok || "",
					},
					hours: normalizeHours(nextGeneral.hours),
				});

				setAppearance({
					logoUrl: nextAppearance.logoUrl || "",
				});
			} catch (loadError) {
				console.error(loadError);
				if (mounted) setError(loadError?.message || "Failed to load settings");
			} finally {
				if (mounted) setLoading(false);
			}
		};

		load();

		return () => {
			mounted = false;
		};
	}, [token]);

	const updateGeneral = (key) => (event) => {
		const value = event.target.value;
		setGeneral((prev) => ({ ...prev, [key]: value }));
	};

	const updateSocial = (key) => (event) => {
		const value = event.target.value;
		setGeneral((prev) => ({
			...prev,
			social: { ...prev.social, [key]: value },
		}));
	};

	const updateHourRow = (index, key) => (event) => {
		const value = event.target.value;
		setGeneral((prev) => {
			const nextHours = [...prev.hours];
			nextHours[index] = { ...nextHours[index], [key]: value };
			return { ...prev, hours: nextHours };
		});
	};

	const addHourRow = () => {
		setGeneral((prev) => ({ ...prev, hours: [...prev.hours, emptyHoursRow()] }));
	};

	const removeHourRow = (index) => {
		setGeneral((prev) => {
			const nextHours = prev.hours.filter((_, i) => i !== index);
			return { ...prev, hours: nextHours.length ? nextHours : [emptyHoursRow()] };
		});
	};

	const save = async () => {
		if (!canSave) return;

		setSaving(true);
		setError("");
		setSuccess("");

		try {
			const payload = {
				general: {
					businessName: general.businessName,
					description: general.description,
					address: general.address,
					phone: general.phone,
					email: general.email,
					social: { ...general.social },
					hours: (general.hours || []).filter(
						(row) => typeof row?.day === "string" && row.day.trim().length > 0
					),
				},
				appearance: {
					logoUrl: appearance.logoUrl,
				},
			};

			const response = await fetch(`${API_BASE_URL}/api/settings`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(payload),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.message || "Failed to save settings");
			}

			setSuccess("Settings berhasil disimpan.");
		} catch (saveError) {
			console.error(saveError);
			setError(saveError?.message || "Failed to save settings");
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminLayout title="Settings">
			<div className="p-6 max-w-5xl mx-auto">
				<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
					<h3 className="text-xl font-semibold text-gray-900 mb-1">
						Konten About Us (Customer)
					</h3>
					<p className="text-sm text-gray-500 mb-6">
						Data di sini akan tampil di halaman About Us.
					</p>

					{loading ? (
						<div className="text-gray-600">Loading settings...</div>
					) : null}

					{error ? (
						<div className="mb-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
							{error}
						</div>
					) : null}

					{success ? (
						<div className="mb-4 rounded-lg bg-green-50 border border-green-100 p-3 text-sm text-green-700">
							{success}
						</div>
					) : null}

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Nama Bisnis
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.businessName}
								onChange={updateGeneral("businessName")}
								placeholder="Contoh: Salon Cantik Indah"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Logo URL (opsional)
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={appearance.logoUrl}
								onChange={(e) =>
									setAppearance((prev) => ({ ...prev, logoUrl: e.target.value }))
								}
								placeholder="https://.../logo.png"
							/>
						</div>

						<div className="md:col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Deskripsi About Us
							</label>
							<textarea
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 min-h-28"
								value={general.description}
								onChange={updateGeneral("description")}
								placeholder="Tulis deskripsi singkat tentang salon..."
							/>
						</div>
					</div>

					<hr className="my-6" />

					<h4 className="text-lg font-semibold text-gray-900 mb-3">Kontak</h4>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Telepon / WhatsApp
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.phone}
								onChange={updateGeneral("phone")}
								placeholder="Contoh: +62 812-3456-7890"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Email
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.email}
								onChange={updateGeneral("email")}
								placeholder="Contoh: info@domain.com"
							/>
						</div>

						<div className="md:col-span-2">
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Alamat
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.address}
								onChange={updateGeneral("address")}
								placeholder="Alamat lengkap"
							/>
						</div>
					</div>

					<hr className="my-6" />

					<h4 className="text-lg font-semibold text-gray-900 mb-3">Sosial Media</h4>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Instagram
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.social.instagram}
								onChange={updateSocial("instagram")}
								placeholder="@salon / https://instagram.com/..."
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Facebook
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.social.facebook}
								onChange={updateSocial("facebook")}
								placeholder="salon / https://facebook.com/..."
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								TikTok
							</label>
							<input
								className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
								value={general.social.tiktok}
								onChange={updateSocial("tiktok")}
								placeholder="@salon / https://tiktok.com/@..."
							/>
						</div>
					</div>

					<hr className="my-6" />

					<h4 className="text-lg font-semibold text-gray-900 mb-3">Jam Buka</h4>
					<div className="space-y-3">
						{general.hours.map((row, index) => (
							<div
								key={`hours-${index}`}
								className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
							>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Hari
									</label>
									<input
										className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
										value={row.day}
										onChange={updateHourRow(index, "day")}
										placeholder="Senin - Jumat"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Buka
									</label>
									<input
										className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
										value={row.open}
										onChange={updateHourRow(index, "open")}
										placeholder="09:00"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Tutup
									</label>
									<input
										className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
										value={row.close}
										onChange={updateHourRow(index, "close")}
										placeholder="20:00"
									/>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={addHourRow}
										className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
									>
										+
									</button>
									<button
										type="button"
										onClick={() => removeHourRow(index)}
										className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
										disabled={general.hours.length === 1}
									>
										-
									</button>
								</div>
							</div>
						))}
					</div>

					<div className="mt-8 flex justify-end">
						<button
							type="button"
							onClick={save}
							disabled={!canSave}
							className={`px-5 py-3 rounded-lg text-white font-medium transition-all duration-200 ${
								canSave
									? "bg-red-400 hover:bg-red-500"
									: "bg-gray-300 cursor-not-allowed"
							}`}
						>
							{saving ? "Menyimpan..." : "Simpan"}
						</button>
					</div>
				</div>
			</div>
		</AdminLayout>
	);
};

export default SettingConfiguration;