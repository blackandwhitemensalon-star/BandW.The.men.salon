import { useEffect, useState } from "react";
import { api, useFetch, inr, fmt } from "./shared.js";
import {
  BookingSuccessModal,
  ButtonLoader,
  ErrorAnimation,
} from "./Animation.jsx";

const today = () => new Date().toISOString().slice(0, 10);
const toDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeek = (date) => {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export default function Book() {
  const token = localStorage.bwc || "";
  const services = useFetch("/services", []);
  const initialDate = today();
  const [form, setForm] = useState({
    serviceId: new URLSearchParams(location.search).get("service") || "",
    date: initialDate,
    time: "",
    message: "",
  });
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(`${initialDate}T00:00:00`)),
  );
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const selectDate = (date) => {
    const dateString = toDateString(date);
    setWeekStart(startOfWeek(date));
    setForm((current) => ({ ...current, date: dateString }));
  };
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
  const currentWeekStart = startOfWeek(new Date(`${today()}T00:00:00`));
  const selectedService = services.find(
    (service) => service._id === form.serviceId,
  );
  const selectedDate = form.date
    ? new Date(`${form.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const loadSlots = () => {
    if (form.date) {
      api("/slots?date=" + form.date)
        .then(setSlots)
        .catch((requestError) => setError(requestError.message));
    }
  };

  useEffect(() => {
    loadSlots();
    setForm((current) => ({ ...current, time: "" }));
  }, [form.date]);

  if (!token) {
    return (
      <main className="bookpage">
        <a className="back customer-page-home" href="/" aria-label="Go to B&W home page">
          <img className="customer-page-logo" src="/customer-logo.png" alt="B&W The Men's Salon" />
        </a>
        <div className="form">
          <h1>Sign in to book</h1>
          <p>Appointments are saved to your customer profile.</p>
          <a
            className="btn"
            href={"/account?next=" + encodeURIComponent(location.pathname + location.search)}
          >
            LOGIN OR REGISTER
          </a>
        </div>
      </main>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.serviceId || !form.time) {
      setError("Please choose a service and a time slot.");
      return;
    }

    setBusy(true);
    try {
      const savedAppointment = await api(
        "/appointments",
        { method: "POST", body: JSON.stringify(form) },
        token,
      );
      setAppointment(savedAppointment);
    } catch (requestError) {
      setError(requestError.message);
      loadSlots();
      setForm((current) => ({ ...current, time: "" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="bookpage">
      <a className="back customer-page-home" href="/" aria-label="Go to B&W home page">
        <img className="customer-page-logo" src="/customer-logo.png" alt="B&W The Men's Salon" />
      </a>
      <div className="booking-layout">
        <form className="form" onSubmit={submit}>
        <h1>Book Appointment</h1>
        <p>Booking for your B&amp;W customer account.</p>
        <label>
          Service
          <select value={form.serviceId} onChange={set("serviceId")} required>
            <option value="">Select a service</option>
            {services.map((service) => (
              <option key={service._id} value={service._id}>
                {service.name} – {inr(service.price)} ({service.duration} min)
              </option>
            ))}
          </select>
        </label>
        <section className="booking-date" aria-label="Choose appointment date">
          <div className="booking-date-heading">
            <label>
              Date
              <span>
                {new Date(`${form.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </label>
            <div className="booking-date-navigation">
              <button
                type="button"
                aria-label="Previous week"
                disabled={weekStart <= currentWeekStart}
                onClick={() =>
                  setWeekStart((current) => {
                    const previous = new Date(current);
                    previous.setDate(previous.getDate() - 7);
                    return previous;
                  })
                }
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next week"
                onClick={() =>
                  setWeekStart((current) => {
                    const next = new Date(current);
                    next.setDate(next.getDate() + 7);
                    return next;
                  })
                }
              >
                ›
              </button>
            </div>
          </div>
          <div className="booking-date-days">
            {weekDates.map((date) => {
              const dateString = toDateString(date);
              const selected = form.date === dateString;
              const unavailable = dateString < today();
              return (
                <button
                  type="button"
                  key={dateString}
                  className={selected ? "selected" : ""}
                  disabled={unavailable}
                  aria-pressed={selected}
                  aria-label={date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  onClick={() => selectDate(date)}
                >
                  <span>
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <b>{date.getDate()}</b>
                </button>
              );
            })}
          </div>
        </section>
        <fieldset>
          <legend>Available Time Slots</legend>
          <div className="slots">
            {slots.map((slot) => (
              <button
                type="button"
                key={slot.time}
                disabled={slot.booked}
                className={form.time === slot.time ? "sel" : ""}
                aria-pressed={form.time === slot.time}
                onClick={() => setForm((current) => ({ ...current, time: slot.time }))}
              >
                {fmt(slot.time)}
                {slot.booked && <small>Booked</small>}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          Message (optional)
          <textarea
            rows="3"
            maxLength="300"
            value={form.message}
            onChange={set("message")}
          />
        </label>
        {error && (
          <ErrorAnimation
            message={error}
            onRetry={() => {
              setError("");
              loadSlots();
            }}
          />
        )}
        <div className="booking-actions">
          <a className="btn ghost" href="/account">CANCEL</a>
          <button className="btn" disabled={busy}>
            {busy ? <ButtonLoader label="Booking..." /> : "CONFIRM APPOINTMENT"}
          </button>
        </div>
      </form>
        <section className="booking-preview" aria-live="polite" aria-label="Appointment preview">
          <div className="booking-preview-heading">
            <h2>Appointment Preview</h2>
            <span>Review your selections</span>
          </div>
          <dl>
            <div>
              <dt>Service</dt>
              <dd>
                {selectedService
                  ? `${selectedService.name} · ${inr(selectedService.price)} · ${selectedService.duration} min`
                  : "Choose a service"}
              </dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{selectedDate || "Choose a date"}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{form.time ? fmt(form.time) : "Choose an available time"}</dd>
            </div>
            <div>
              <dt>Message</dt>
              <dd className="booking-preview-message">
                {form.message.trim() || "No message added"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {appointment && <BookingSuccessModal appointment={appointment} />}
    </main>
  );
}
