import { useEffect, useState } from "react";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export const api = async (path, options = {}, token) => {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
};

export const assetUrl = source => {
  if (!source || !API_BASE_URL || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) {
    return source;
  }
  return new URL(source, `${API_BASE_URL}/`).href;
};

export const dirUrl = settings =>
  "https://www.google.com/maps/dir/?api=1&destination=" +
  encodeURIComponent(settings.mapQuery);
export const mapSrc = settings =>
  "https://www.google.com/maps?q=" +
  encodeURIComponent(settings.mapQuery) +
  "&output=embed";
export const tel = settings => "tel:" + settings.phone.replace(/\s/g, "");
export const inr = amount => "₹" + amount;
export const fmt = time => {
  const hour = Number(time.slice(0, 2));
  return (hour % 12 || 12) + ":00 " + (hour >= 12 ? "PM" : "AM");
};
export const D0 = {
  address: "",
  phone: "098668 36511",
  whatsapp: "919866836511",
  mapQuery: "B&W The Mens Saloon, Bhimavaram",
};

export const useFetch = (path, initialValue) => {
  const [data, setData] = useState(initialValue);
  useEffect(() => {
    api(path).then(setData).catch(() => {});
  }, [path]);
  return data;
};

export const useReveal = () =>
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries =>
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add("in");
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".fade").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  });
