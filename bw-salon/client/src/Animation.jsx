import { useEffect } from "react";
import { fmt } from "./shared.js";

export function ButtonLoader({ label }) {
  return (
    <span className="button-loading">
      <svg className="svg-spinner" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function ScissorsLoader() {
  return (
    <svg
      className="scissors-loader"
      viewBox="0 0 64 64"
      role="img"
      aria-label="Animated barber scissors"
    >
      <circle className="scissor-handle" cx="14" cy="46" r="8" />
      <circle className="scissor-handle" cx="14" cy="18" r="8" />
      <g className="scissor-blade scissor-blade-top">
        <path d="M20 22 53 53" />
        <path d="M20 42 39 31" />
      </g>
      <g className="scissor-blade scissor-blade-bottom">
        <path d="M20 42 53 11" />
        <path d="M20 22 39 33" />
      </g>
      <circle className="scissor-pivot" cx="40" cy="32" r="3" />
    </svg>
  );
}

export function GlobalLoader({ subtitle = "Preparing your experience..." }) {
  return (
    <div className="global-loader" role="status" aria-live="polite">
      <div className="loader-ring">
        <ScissorsLoader />
      </div>
      <strong>B&amp;W THE MEN'S SALON</strong>
      <span>{subtitle}</span>
    </div>
  );
}

export function SuccessAnimation({
  title,
  description,
  kind = "check",
  compact = false,
  onComplete,
  children,
}) {
  const complete = (event) => {
    if (
      event.target === event.currentTarget &&
      event.animationName === "success-draw-check"
    ) {
      onComplete?.();
    }
  };

  return (
    <div
      className={`success-animation${compact ? " compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <svg className={`success-icon${kind === "user" ? " user-icon" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle className="success-circle" cx="50" cy="50" r="43" />
        {kind === "user" && (
          <g className="success-user">
            <circle cx="50" cy="37" r="11" />
            <path d="M28 75c2-13 10-20 22-20s20 7 22 20" />
          </g>
        )}
        <path
          className="success-check"
          d={kind === "user" ? "m39 75 7 7 16-17" : "m28 51 14 14 30-32"}
          onAnimationEnd={complete}
        />
      </svg>
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}

export function BookingSuccessModal({ appointment, onClose }) {
  return (
    <div className="modal animation-modal">
      <section
        className="pop animation-card"
        role="dialog"
        aria-modal="true"
        aria-label="Appointment booked successfully"
      >
        <SuccessAnimation
          title="APPOINTMENT BOOKED SUCCESSFULLY!"
          description="Your appointment request has been saved."
        >
          <div className="success-details">
            <p><b>Booking ID:</b> {appointment.bookingId || appointment._id}</p>
            <p><b>Service:</b> {appointment.serviceName}</p>
            <p><b>Date:</b> {appointment.date}</p>
            <p><b>Time:</b> {fmt(appointment.time)}</p>
          </div>
          <div className="success-actions">
            <a className="btn" href="/account">View My Appointments</a>
            <a className="btn ghost" href="/">Back to Home</a>
            {onClose && (
              <button className="btn ghost" type="button" onClick={onClose}>
                Book Another Appointment
              </button>
            )}
          </div>
        </SuccessAnimation>
      </section>
    </div>
  );
}

export function ErrorAnimation({ message, compact = false, onRetry }) {
  return (
    <div
      className={`error-animation${compact ? " compact" : ""}`}
      role="alert"
      aria-live="assertive"
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" />
        <path d="m14 14 12 12M26 14 14 26" />
      </svg>
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn sm ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function ReviewThankYouPopup({ onClose }) {
  useEffect(() => {
    const timeout = setTimeout(onClose, 6000);
    return () => clearTimeout(timeout);
  }, [onClose]);

  return (
    <div className="review-thank-you-overlay">
      <section
        className="review-thank-you-card"
        role="dialog"
        aria-modal="true"
        aria-label="Review submitted successfully"
      >
        <SuccessAnimation
          title="THANK YOU!"
          description="Thank you for sharing your experience with B&W THE MEN'S SALON. We truly appreciate your feedback!"
        />
        <button className="btn" type="button" onClick={onClose} autoFocus>
          Close
        </button>
      </section>
    </div>
  );
}
