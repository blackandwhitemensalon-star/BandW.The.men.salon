import { useCallback, useEffect, useState } from "react";
import { api, inr, fmt } from "./shared.js";
import {
  ButtonLoader,
  ErrorAnimation,
  GlobalLoader,
  ReviewThankYouPopup,
  SuccessAnimation,
} from "./Animation.jsx";

export default function Customer() {
  const [token, setToken] = useState(localStorage.bwc || ""),
    [user, setUser] = useState(null),
    [data, setData] = useState({
      appointments: [],
      upcoming: [],
      completed: [],
      total: 0,
    }),
    [mode, setMode] = useState("login"),
    [form, setForm] = useState({}),
    [msg, setMsg] = useState(""),
    [authBusy, setAuthBusy] = useState(false),
    [accountLoading, setAccountLoading] = useState(Boolean(localStorage.bwc)),
    [accountError, setAccountError] = useState(""),
    [successFlow, setSuccessFlow] = useState(null),
    [successMessage, setSuccessMessage] = useState(""),
    [updateBusy, setUpdateBusy] = useState(false),
    [cancellingId, setCancellingId] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [historyFilter, setHistoryFilter] = useState("upcoming");
  const [reviews, setReviews] = useState([]), [reviewAppt, setReviewAppt] = useState(null), [reviewThankYou, setReviewThankYou] = useState(false), [rating, setRating] = useState(0), [hover, setHover] = useState(0), [comment, setComment] = useState(""), [savingReview, setSavingReview] = useState(false);
  const historyAppointments = data.appointments.filter((appointment) =>
    historyFilter === "completed"
      ? appointment.status === "completed"
      : ["pending", "confirmed"].includes(appointment.status),
  );
  const pendingConfirmedCount = data.appointments.filter((appointment) =>
    ["pending", "confirmed"].includes(appointment.status),
  ).length;
  const req = (p, o = {}) => api(p, o, token);
  const refresh = async () => {
    try {
      const [customer, appointments, customerReviews] = await Promise.all([
        req("/customers/me"),
        req("/customers/me/appointments"),
        req("/customers/me/reviews"),
      ]);
      setUser(customer);
      setData(appointments);
      setReviews(customerReviews);
    } catch (error) {
      if (error.message === "Unauthorized") {
        localStorage.removeItem("bwc");
        setToken("");
        setUser(null);
        return;
      }
      throw error;
    }
  };
  useEffect(() => {
    if (!token) {
      setAccountLoading(false);
      return;
    }

    let active = true;
    setAccountLoading(true);
    setAccountError("");
    refresh()
      .catch((error) => {
        if (active) setAccountError(error.message);
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const set = (k) => (e) =>
    setForm((current) => ({ ...current, [k]: e.target.value }));
  const dashboardUrl = () => {
    const next = new URLSearchParams(location.search).get("next") || "/account";
    try {
      const destination = new URL(next, location.origin);
      return destination.origin === location.origin
        ? destination.pathname + destination.search + destination.hash
        : "/account";
    } catch {
      return "/account";
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setSuccessMessage("");
    setAuthBusy(true);
    try {
      const action = mode;
      const r = await api(
        action === "register" ? "/customers/register" : "/customers/login",
        { method: "POST", body: JSON.stringify(form) },
      );
      localStorage.bwc = r.token;
      setToken(r.token);
      setUser(r.customer);
      setData({ appointments: [], upcoming: [], completed: [], total: 0 });
      setReviews([]);
      setForm({});
      setSuccessFlow({
        type: action,
        destination: dashboardUrl(),
      });
    } catch (error) {
      setMsg(error.message);
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = () => {
    localStorage.removeItem("bwc");
    setToken("");
    setUser(null);
    setSuccessFlow(null);
  };
  const update = async (e) => {
    e.preventDefault();
    setMsg("");
    setSuccessMessage("");
    setUpdateBusy(true);
    try {
      setUser(
        await req("/customers/me", {
          method: "PATCH",
          body: JSON.stringify({ name: form.name }),
        }),
      );
      setForm({});
      setProfileOpen(false);
      setSuccessMessage("Profile updated successfully.");
    } catch (x) {
      setMsg(x.message);
    } finally {
      setUpdateBusy(false);
    }
  };
  const openProfile = () => {
    setForm({ name: user.name, currentPassword: "", password: "" });
    setMsg("");
    setProfileOpen(true);
  };
  const cancel = async (id) => {
    setCancellingId(id);
    setMsg("");
    setSuccessMessage("");
    try {
      await req("/customers/me/appointments/" + id + "/cancel", {
        method: "PATCH",
      });
      await refresh();
      setSuccessMessage("Appointment cancelled successfully.");
    } catch (x) {
      setMsg(x.message);
    } finally {
      setCancellingId("");
    }
  };
  const openReview = (appt) => { const existing=reviews.find(r=>r.appointmentId?._id===appt._id);setReviewAppt(appt);setRating(existing?.rating||0);setComment(existing?.comment||"");setMsg(""); };
  const saveReview = async (e) => {
    e.preventDefault();
    if (!rating) {
      setMsg("Please select a star rating.");
      return;
    }

    setSavingReview(true);
    setMsg("");
    setSuccessMessage("");
    try {
      const savedReview = await req(
        `/customers/me/appointments/${reviewAppt._id}/review`,
        { method: "POST", body: JSON.stringify({ rating, comment }) },
      );
      setReviews((current) => [
        ...current.filter(
          (review) => review.appointmentId?._id !== reviewAppt._id,
        ),
        {
          ...savedReview,
          appointmentId: { _id: reviewAppt._id },
        },
      ]);
      setReviewAppt(null);
      setReviewThankYou(true);
    } catch (error) {
      setMsg(error.message);
    } finally {
      setSavingReview(false);
    }
  };
  const closeReviewThankYou = useCallback(
    () => setReviewThankYou(false),
    [],
  );
  return (
    <main className="bookpage">
      <a className="back customer-page-home" href="/" aria-label="Go to B&W home page">
        <img
          className="customer-page-logo"
          src="/customer-logo.png"
          alt="B&W The Men's Salon"
        />
      </a>
      {!user ? (
        token ? (
          accountLoading ? (
            <GlobalLoader subtitle="Loading your account..." />
          ) : (
            <div className="form" aria-live="polite">
              <h1>Account unavailable</h1>
              <ErrorAnimation
                message={accountError || "We couldn't load your account. Please try again."}
              />
              <button
                className="btn"
                onClick={() => {
                  setAccountLoading(true);
                  setAccountError("");
                  refresh()
                    .catch((error) => setAccountError(error.message))
                    .finally(() => setAccountLoading(false));
                }}
              >
                TRY AGAIN
              </button>
              <button className="btn ghost" onClick={logout}>
                LOG OUT
              </button>
            </div>
          )
        ) : (
          <form className="form" onSubmit={submit}>
            <h1>
              {mode === "register" ? "Create Customer Account" : "Customer Login"}
            </h1>
            <p className="muted">
              {mode === "register"
                ? "Create your account to book and manage appointments."
                : "Sign in to manage your appointments and profile."}
            </p>
            {mode === "register" && (
              <label>
                Full Name
                <input
                  value={form.name || ""}
                  onChange={set("name")}
                  required
                  minLength={2}
                  autoComplete="name"
                />
              </label>
            )}
            <label>
              {mode === "login" ? "Username or Customer ID" : "Unique Username"}
              <input
                value={form.username || ""}
                onChange={set("username")}
                required
                minLength={mode === "register" ? 3 : undefined}
                maxLength={mode === "register" ? 24 : undefined}
                pattern={mode === "register" ? "[a-zA-Z0-9_.\\-]{3,24}" : undefined}
                title={
                  mode === "register"
                    ? "Use 3–24 letters, numbers, dots, underscores, or hyphens."
                    : undefined
                }
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password || ""}
                onChange={set("password")}
                required
                minLength={mode === "register" ? 8 : undefined}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </label>
            {mode === "register" && (
              <label>
                Confirm Password
                <input
                  type="password"
                  value={form.confirmPassword || ""}
                  onChange={set("confirmPassword")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
            )}
            {msg && <ErrorAnimation message={msg} />}
            <button className="btn" disabled={authBusy}>
              {authBusy
                ? <ButtonLoader label={mode === "register" ? "Creating account..." : "Logging in..."} />
                : mode === "register"
                  ? "CREATE ACCOUNT"
                  : "LOGIN"}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={authBusy}
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setForm({});
                setMsg("");
              }}
            >
              {mode === "register"
                ? "I already have an account"
                : "Create an account"}
            </button>
          </form>
        )
      ) : (
        <section className="account">
          <header className="row">
            <div>
              <p className="eyebrow">B&amp;W CUSTOMER ID</p>
              <h1 className="customer-id">{user.customerId}</h1>
              <h2>{user.name}</h2>
              <p>@{user.username}</p>
            </div>
            <button className="btn ghost" onClick={logout}>
              LOGOUT
            </button>
          </header>
          <div className="stats">
            <div>
              <b>{data.total}</b>
              <span>Total appointments</span>
            </div>
            <div>
              <b>{data.upcoming.length}</b>
              <span>Upcoming</span>
            </div>
            <div>
              <b>{data.completed.length}</b>
              <span>Completed</span>
            </div>
          </div>
          <button className="btn" type="button" onClick={openProfile}>
            UPDATE PROFILE
          </button>
          {successMessage && (
            <SuccessAnimation compact title={successMessage} />
          )}
          {msg && !profileOpen && !reviewAppt && (
            <ErrorAnimation message={msg} />
          )}
          <div className="history">
            <div className="row">
              <h2>Appointment History</h2>
              <a className="btn sm" href="/book">
                Book Appointment
              </a>
            </div>
            <div className="history-filters" role="group" aria-label="Filter appointments">
              <button
                type="button"
                className={`btn sm ${historyFilter === "upcoming" ? "" : "ghost"}`}
                aria-pressed={historyFilter === "upcoming"}
                onClick={() => setHistoryFilter("upcoming")}
              >
                Pending &amp; Confirmed ({pendingConfirmedCount})
              </button>
              <button
                type="button"
                className={`btn sm ${historyFilter === "completed" ? "" : "ghost"}`}
                aria-pressed={historyFilter === "completed"}
                onClick={() => setHistoryFilter("completed")}
              >
                Completed ({data.completed.length})
              </button>
            </div>
            {historyAppointments.map((a) => {
              const review=reviews.find(r=>r.appointmentId?._id===a._id);
              return (
              <article key={a._id}>
                <div>
                  <b>{a.serviceName}</b>
                  {a.bookingId && <p>Booking ID: {a.bookingId}</p>}
                  <p>
                    {a.date} · {fmt(a.time)} · {inr(a.price)}
                  </p>
                  <span className={"tag " + a.status}>{a.status}</span>
                </div>
                {["pending", "confirmed"].includes(a.status) && (
                  <button
                    disabled={Boolean(cancellingId)}
                    onClick={() => cancel(a._id)}
                  >
                    {cancellingId === a._id
                      ? <ButtonLoader label="Cancelling..." />
                      : "Cancel"}
                  </button>
                )}
                {a.status === "completed" && <div className="review-action">{review && <span className="stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="star-empty">{"★".repeat(5-review.rating)}</span></span>}<button className="btn sm" onClick={() => openReview(a)}>{review ? "View Review" : "Write a Review"}</button></div>}
              </article>
              );
            })}
            {!historyAppointments.length && (
              <p>
                {historyFilter === "completed"
                  ? "No completed appointments yet."
                  : "No pending or confirmed appointments."}
              </p>
            )}
          </div>
          {profileOpen && (
            <div className="modal profile-modal" onClick={() => setProfileOpen(false)}>
              <form
                className="form profile-form pop"
                role="dialog"
                aria-modal="true"
                aria-labelledby="profile-title"
                onClick={(e) => e.stopPropagation()}
                onSubmit={update}
              >
                <button
                  className="review-close"
                  type="button"
                  aria-label="Close profile update"
                  onClick={() => setProfileOpen(false)}
                >
                  ×
                </button>
                <h2 id="profile-title">Update Profile</h2>
                <label>
                  Full Name
                  <input value={form.name ?? user.name} onChange={set("name")} />
                </label>
                {msg && <ErrorAnimation message={msg} />}
                <div className="row">
                  <button className="btn" disabled={updateBusy}>
                    {updateBusy
                      ? <ButtonLoader label="Updating..." />
                      : "SAVE CHANGES"}
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setProfileOpen(false)}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </div>
          )}
          {reviewAppt && <div className="review-overlay"><form className="review-modal" onSubmit={saveReview}><p>{reviewAppt.serviceName} · {reviewAppt.date} · {fmt(reviewAppt.time)} · {inr(reviewAppt.price)}</p><h2>Rate Your Experience at B&amp;W</h2><div className="rating-stars">{[1,2,3,4,5].map(n=><button type="button" key={n} className={n <= (hover || rating) ? "selected" : ""} onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)} onClick={()=>setRating(n)}>★</button>)}</div><p>{["","Poor","Fair","Good","Very Good","Excellent"][hover||rating]||"Select a rating"}</p><textarea rows="4" placeholder="Share your experience with B&amp;W The Men's Salon..." value={comment} onChange={e=>setComment(e.target.value)}/>{msg&&<ErrorAnimation message={msg}/>}<button className="btn" disabled={savingReview}>{savingReview?<ButtonLoader label="Submitting..."/>:"SUBMIT REVIEW"}</button><button type="button" className="btn ghost" disabled={savingReview} onClick={()=>setReviewAppt(null)}>CANCEL</button></form></div>}
        </section>
      )}
      {successFlow && (
        <div className="modal animation-modal">
          <section
            className="pop animation-card"
            role="dialog"
            aria-modal="true"
            aria-label={successFlow.type === "register" ? "Account created" : "Login successful"}
          >
            <SuccessAnimation
              kind="user"
              title={successFlow.type === "register"
                ? "ACCOUNT CREATED SUCCESSFULLY!"
                : "WELCOME BACK!"}
              description={successFlow.type === "register"
                ? `Your B&W Customer ID is ${user?.customerId}.`
                : `Signed in as ${user?.name}.`}
              onComplete={() => {
                if (successFlow.type === "login") {
                  location.assign(successFlow.destination);
                }
              }}
            >
              {successFlow.type === "register" ? (
                <>
                  <button
                    className="btn"
                    onClick={() => location.assign("/account")}
                  >
                    GO TO MY PROFILE
                  </button>
                  {successFlow.destination !== "/account" && (
                    <button
                      className="btn ghost"
                      onClick={() => location.assign(successFlow.destination)}
                    >
                      CONTINUE
                    </button>
                  )}
                </>
              ) : (
                <button
                  className="btn"
                  onClick={() => location.assign(successFlow.destination)}
                >
                  CONTINUE
                </button>
              )}
            </SuccessAnimation>
          </section>
        </div>
      )}
      {reviewThankYou && (
        <ReviewThankYouPopup onClose={closeReviewThankYou} />
      )}
    </main>
  );
}
