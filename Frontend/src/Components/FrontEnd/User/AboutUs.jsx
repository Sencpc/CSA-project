import { useEffect, useMemo, useState } from "react";
import "../../../App.css";
import {
  Card,
  Col,
  Descriptions,
  Image,
  List,
  Row,
  Space,
  Typography,
} from "antd";
import logo from "../../../assets/SharedAsset/logo.png";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const normalizeSocialUrl = (platform, value) => {
  if (typeof value !== "string" || value.trim().length === 0) return "";
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  if (platform === "instagram") return `https://instagram.com/${handle}`;
  if (platform === "facebook") return `https://facebook.com/${handle}`;
  if (platform === "tiktok") return `https://tiktok.com/@${handle}`;
  return "";
};

const AboutUs = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/settings/public`, {
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to load settings");
        }
        if (mounted) {
          setSettings(data?.settings ?? null);
        }
      } catch (error) {
        console.error(error);
        if (mounted) {
          setSettings(null);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const view = useMemo(() => {
    const general = settings?.general ?? {};
    const appearance = settings?.appearance ?? {};
    const social = general?.social ?? {};

    const businessName =
      typeof general.businessName === "string" && general.businessName.trim()
        ? general.businessName.trim()
        : "Salon Cantik Indah";

    const description =
      typeof general.description === "string" && general.description.trim()
        ? general.description.trim()
        : "Salon Cantik Indah menyediakan layanan potong rambut, styling, perawatan wajah, manicure & pedicure, serta treatment profesional lainnya dengan tenaga ahli berpengalaman.";

    const phone =
      typeof general.phone === "string" && general.phone.trim()
        ? general.phone.trim()
        : "+62 898-5452-5596";

    const email =
      typeof general.email === "string" && general.email.trim()
        ? general.email.trim()
        : "info@saloncantikindah.com";

    const address =
      typeof general.address === "string" && general.address.trim()
        ? general.address.trim()
        : "Jl. Gubeng Kertajaya V F Blok F No.32 RT.007/RW.03, Airlangga, Kec. Gubeng, Surabaya, Jawa Timur 60286";

    const hours = Array.isArray(general.hours) ? general.hours : [];

    const instagramUrl = normalizeSocialUrl("instagram", social.instagram);
    const facebookUrl = normalizeSocialUrl("facebook", social.facebook);
    const tiktokUrl = normalizeSocialUrl("tiktok", social.tiktok);

    const logoUrl =
      typeof appearance.logoUrl === "string" && appearance.logoUrl.trim()
        ? appearance.logoUrl.trim()
        : logo;

    return {
      businessName,
      description,
      phone,
      email,
      address,
      hours,
      instagramUrl,
      facebookUrl,
      tiktokUrl,
      logoUrl,
      instagramHandle: social.instagram || "@saloncantikindah",
      facebookHandle: social.facebook || "Salon Cantik Indah",
      tiktokHandle: social.tiktok || "@saloncantikindah",
    };
  }, [settings]);

  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        padding: 24,
        paddingTop: 100,
        flexWrap: "wrap",
        boxSizing: "border-box",
      }}
    >
      <img
        src={view.logoUrl}
        alt="Foto Salon"
        style={{
          maxWidth: 400,
          width: "100%",
          height: "auto",
          objectFit: "cover",
          borderRadius: 8,
          flex: "0 0 auto",
        }}
      />

      <div
        style={{
          flex: 1,
          minWidth: 280,
          marginTop: 20,
        }}
        className="info-card"
      >
        <div className="info-card">
          <h1 className="sectionTitle">{view.businessName}</h1>
          <p>{view.description}</p>
        </div>
        <div style={{ marginTop: 16 }} className="info-card">
          <h3 className="sectionTitle">Kontak</h3>
          <p>
            Telepon: <span>{view.phone}</span>
          </p>
          <p>
            Email: <span>{view.email}</span>
          </p>
          <p>
            WhatsApp:{" "}
            <a
              href={`https://wa.me/${view.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              {view.phone}
            </a>
          </p>
        </div>

        <div style={{ marginTop: 16 }} className="info-card">
          <h3 className="sectionTitle">Lokasi</h3>
          <p>{view.address}</p>
          {view.hours.length > 0 ? (
            <div>
              <p>Jam buka:</p>
              <ul>
                {view.hours.map((item, index) => (
                  <li key={`${item.day}-${index}`}>
                    {item.day}: {item.open} - {item.close}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Jam buka: Senin - Sabtu, 09:00 - 20:00</p>
          )}
        </div>

        <div style={{ marginTop: 16 }} className="info-card">
          <h3 className="sectionTitle">Sosial Media</h3>
          <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: 8 }}>
            <li>
              Instagram:{" "}
              <a
                href={view.instagramUrl || "#"}
                target="_blank"
                rel="noreferrer"
              >
                {view.instagramHandle}
              </a>
            </li>
            <li>
              Facebook:{" "}
              <a
                href={view.facebookUrl || "#"}
                target="_blank"
                rel="noreferrer"
              >
                {view.facebookHandle}
              </a>
            </li>
            <li>
              TikTok:{" "}
              <a href={view.tiktokUrl || "#"} target="_blank" rel="noreferrer">
                {view.tiktokHandle}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
