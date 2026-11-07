import { useState } from "react";
import { fmt, inr } from "./shared.js";
import { ButtonLoader } from "./Animation.jsx";

const dateLabel = value =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function NotificationHeader({ state, onView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="notification-center">
      <button
        className={`notification-bell${state.ringing ? " ringing" : ""}`}
        type="button"
        aria-label={`Notifications, ${state.overdueCount} unread for more than five minutes`}
        title={`${state.overdueCount} unread appointment${state.overdueCount === 1 ? "" : "s"} waiting over five minutes`}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {state.overdueCount > 0 && (
          <span className="notification-count">
            {state.overdueCount > 99 ? "99+" : state.overdueCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-heading">
            <b>Recent appointments</b>
            <div>
              <button type="button" onClick={state.markAllRead}>Mark all read</button>
              <button type="button" onClick={state.clearAll}>Clear All</button>
            </div>
          </div>
          {state.syncError && <p className="notification-error">{state.syncError}</p>}
          {!state.notifications.length && <p className="notification-empty">No recent notifications.</p>}
          {state.notifications.map(item => (
            <button
              type="button"
              className={`notification-item${item.read ? "" : " unread"}`}
              key={item._id}
              onClick={() => {
                state.markRead(item._id);
                setOpen(false);
                onView(item);
              }}
            >
              <span className="notification-item-title">{item.customerName} · {item.service}</span>
              <span>{dateLabel(item.date)} · {fmt(item.time)} · {inr(item.amount)}</span>
              <small>{item.bookingId || item.appointmentId}</small>
            </button>
          ))}
        </div>
      )}
      <label className="notification-sound-toggle">
        <input
          type="checkbox"
          checked={state.soundEnabled}
          onChange={event => state.setSoundEnabled(event.target.checked)}
          aria-label="Notification sound"
        />
        <span>Sound {state.soundEnabled ? "ON" : "OFF"}</span>
      </label>
      <span
        className={`socket-status${state.connected ? " connected" : ""}`}
        title={state.connectionError || ""}
        role="status"
      >
        {state.connected ? "Live" : state.connectionError ? "Offline" : "Connecting"}
      </span>
      {state.connectionError && <p className="notification-connection-error">{state.connectionError}</p>}
      {state.soundError && <p className="notification-connection-error">{state.soundError}</p>}
    </div>
  );
}

export function NewAppointmentPopup({ item, onView, onConfirm, onDismiss, confirmBusy = false }) {
  if (!item) return null;
  return (
    <aside className="new-appointment-popup" role="status" aria-live="polite">
      <button className="new-appointment-close" type="button" aria-label="Dismiss notification" onClick={onDismiss}>×</button>
      <p className="new-appointment-eyebrow">🔔 NEW APPOINTMENT RECEIVED!</p>
      <dl>
        <div><dt>Customer Name</dt><dd>{item.customerName}</dd></div>
        <div><dt>Customer ID</dt><dd>{item.customerId}</dd></div>
        <div><dt>Service</dt><dd>{item.service}</dd></div>
        <div><dt>Appointment Date</dt><dd>{dateLabel(item.date)}</dd></div>
        <div><dt>Appointment Time</dt><dd>{fmt(item.time)}</dd></div>
        <div><dt>Booking ID</dt><dd>{item.bookingId || item.appointmentId}</dd></div>
        <div><dt>Amount</dt><dd>{inr(item.amount)}</dd></div>
        <div><dt>Status</dt><dd>{item.status}</dd></div>
      </dl>
      <div className="new-appointment-actions">
        <button className="btn sm ghost" type="button" onClick={() => onView(item)}>View Appointment</button>
        {item.status === "pending" && (
          <button className="btn sm" type="button" disabled={confirmBusy} onClick={() => onConfirm(item)}>
            {confirmBusy ? <ButtonLoader label="Confirming..." /> : "Confirm Booking"}
          </button>
        )}
      </div>
    </aside>
  );
}

export function NotificationSoundSettings({ state }) {
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const volumePercent = Math.round(state.volume * 100);
  const soundOptions = [
    ["classic", "Classic chime", "A warm three-note salon chime."],
    ["gentle", "Gentle", "A soft two-note chime."],
    ["double", "Double bell", "A bright three-note bell pattern."],
    ["digital", "Digital", "A short, crisp alert."],
  ];
  const selectedSound = soundOptions.find(([id]) => id === state.soundPreset)?.[1] || "Classic chime";
  return (
    <section className="notification-sound-settings">
      <h2>Notification Sound</h2>
      <p>Notification permission: {state.permission}</p>
      <div className="notification-sound-picker">
        <div className="notification-sound-current">
          <div>
            <span className="notification-sound-label">Selected sound</span>
            <strong>{selectedSound}</strong>
          </div>
          <button
            type="button"
            className="notification-sound-change"
            aria-expanded={soundPickerOpen}
            onClick={() => setSoundPickerOpen(open => !open)}
          >
            {soundPickerOpen ? "Done" : "Change sound"}
          </button>
        </div>
        {soundPickerOpen && (
          <div className="notification-sound-options" aria-label="Choose a notification sound">
            {soundOptions.map(([id, name, description]) => (
              <button
                type="button"
                className={state.soundPreset === id ? "selected" : ""}
                aria-pressed={state.soundPreset === id}
                key={id}
                onClick={() => {
                  state.setSoundPreset(id);
                  void state.previewSound();
                }}
              >
                <span>{name}</span>
                <small>{description}</small>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="notification-sound-preview"
          onClick={() => void state.previewSound()}
        >
          <span aria-hidden="true">▶</span> Preview sound
        </button>
      </div>
      <label className="sound-volume">
        <span>Volume</span>
        <input
          id="admin-notification-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={state.volume}
          style={{ "--volume-level": `${volumePercent}%` }}
          aria-label="Notification sound volume"
          onChange={event => state.setVolume(event.target.value)}
        />
        <output htmlFor="admin-notification-volume" aria-live="polite">
          {volumePercent}%
        </output>
      </label>
    </section>
  );
}
