import { useCallback, useEffect, useState } from "react";
import { api, inr, fmt, D0, dirUrl, assetUrl } from "./shared.js";
import {
  ButtonLoader,
  ErrorAnimation,
  SuccessAnimation,
} from "./Animation.jsx";
import useAdminNotifications from "./adminNotifications.js";
import {
  NewAppointmentPopup,
  NotificationHeader,
  NotificationSoundSettings,
} from "./AdminNotificationUI.jsx";
import { OffersManagement } from "./Offers.jsx";

const EMPTY_SERVICE = {
  name: "",
  description: "",
  price: "",
  duration: 30,
  active: true,
};

const displayDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";

const galleryErrorMessage = (error) =>
  error.message === "Request failed"
    ? "The gallery API is missing on the server. Restart or redeploy the API, then try again."
    : error.message;

export default function Admin() {
  const [token, setToken] = useState(localStorage.bwt || "");
  const [tab, setTab] = useState("appts");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginBusy, setLoginBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewError, setReviewError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersMatching, setCustomersMatching] = useState(0);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerRefresh, setCustomerRefresh] = useState(0);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [editingService, setEditingService] = useState(null);
  const [serviceFile, setServiceFile] = useState(null);
  const [serviceFilePreview, setServiceFilePreview] = useState("");
  const [settings, setSettings] = useState(D0);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  useEffect(() => {
    if (!serviceFile) {
      setServiceFilePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(serviceFile);
    setServiceFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [serviceFile]);

  const notificationState = useAdminNotifications(token);
  const logout = () => {
    localStorage.removeItem("bwt");
    setToken("");
  };
  const flash = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 3000);
  };
  const call = useCallback(
    (path, options) =>
      api(path, options, token).catch((error) => {
        if (error.message === "Unauthorized") logout();
        throw error;
      }),
    [token],
  );
  const load = useCallback(() => {
    if (!token) return;
    const query = new URLSearchParams();
    if (date) query.set("date", date);
    if (search.trim()) query.set("search", search.trim());
    call("/appointments" + (query.size ? "?" + query.toString() : ""))
      .then(setAppointments)
      .catch(() => {});
    call("/services/all").then(setServices).catch(() => {});
    call("/admin/reviews")
      .then((result) => {
        setReviews(result.reviews);
        setReviewError("");
      })
      .catch((error) => setReviewError(error.message));
  }, [token, date, search, call]);

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      setGalleryImages(await call("/admin/gallery"));
    } catch (error) {
      flash(galleryErrorMessage(error), "error");
    } finally {
      setGalleryLoading(false);
    }
  }, [call]);

  useEffect(() => {
    call("/settings").then((value) => {
      setSettings(value);
      setSettingsDirty(false);
    }).catch((error) => flash(error.message, "error"));
  }, [call]);

  const saveBusinessSettings = async () => {
    setBusyAction("settings");
    try {
      setSettings(await call("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }));
      setSettingsDirty(false);
      flash("Settings saved successfully.");
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!token || tab !== "users") return undefined;
    let active = true;
    const timeout = setTimeout(() => {
      setCustomersLoading(true);
      setCustomersError("");
      const query = new URLSearchParams();
      if (customerSearch.trim()) query.set("search", customerSearch.trim());
      call("/admin/customers" + (query.size ? "?" + query.toString() : ""))
        .then((result) => {
          if (!active) return;
          setCustomers(result.customers);
          setCustomersTotal(result.totalUsers);
          setCustomersMatching(result.matchingUsers);
        })
        .catch((error) => {
          if (active) setCustomersError(error.message);
        })
        .finally(() => {
          if (active) setCustomersLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [token, tab, customerSearch, customerRefresh, call]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleAppointments = appointments.filter(
    (appointment) =>
      !normalizedSearch ||
      [
        appointment.bookingId,
        appointment.customerId,
        appointment.name,
        appointment.serviceName,
        appointment.date,
        appointment.time,
        appointment.status,
        appointment.message,
        appointment._id,
      ].some((value) =>
        String(value || "").toLowerCase().includes(normalizedSearch),
      ),
  );
  const today = new Date().toISOString().slice(0, 10);
  const galleryActionBusy =
    busyAction === "gallery-upload" ||
    galleryImages.some((image) => busyAction === image._id);

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoginBusy(true);
    try {
      const result = await api("/login", {
        method: "POST",
        body: JSON.stringify(login),
      });
      localStorage.bwt = result.token;
      setToken(result.token);
    } catch (error) {
      flash(galleryErrorMessage(error), "error");
    } finally {
      setLoginBusy(false);
    }
  };

  const setAppointmentStatus = async (id, status) => {
    if (status === "rejected" && !confirm("Reject this booking?")) return;
    setBusyAction(id);
    try {
      await call("/appointments/" + id, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      notificationState.updateAppointment(id, status);
      flash(
        status === "confirmed"
          ? "Appointment confirmed successfully."
          : "Appointment updated successfully.",
      );
      load();
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  const viewNotification = (item) => {
    setTab("appts");
    setDate(item.date);
    setSearch(item.bookingId || item.customerId || "");
    notificationState.markRead(item._id);
    notificationState.dismissPopup();
  };

  const confirmNotification = async (item) => {
    setBusyAction(item.appointmentId);
    try {
      await call("/appointments/" + item.appointmentId, {
        method: "PATCH",
        body: JSON.stringify({ status: "confirmed" }),
      });
      notificationState.updateAppointment(item.appointmentId, "confirmed");
      notificationState.markRead(item._id);
      flash("Appointment confirmed successfully.");
      load();
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  const saveService = async (event) => {
    event.preventDefault();
    const body = new FormData();
    ["name", "description", "price", "duration", "active"].forEach((key) =>
      body.append(key, editingService[key]),
    );
    if (serviceFile) body.append("image", serviceFile);

    setBusyAction("service");
    try {
      await call("/services" + (editingService._id ? "/" + editingService._id : ""), {
        method: editingService._id ? "PUT" : "POST",
        body,
      });
      setEditingService(null);
      setServiceFile(null);
      flash("Service saved successfully.");
      load();
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  const openServiceEditor = (service) => {
    setServiceFile(null);
    setEditingService({ ...service });
  };

  const closeServiceEditor = () => {
    setEditingService(null);
    setServiceFile(null);
  };

  const uploadGalleryImages = async (event) => {
    event.preventDefault();
    if (!galleryFiles.length) {
      flash("Choose at least one image to upload.", "error");
      return;
    }

    const formElement = event.currentTarget;
    const body = new FormData();
    galleryFiles.forEach((file) => body.append("images", file));
    setBusyAction("gallery-upload");
    try {
      const uploaded = await call("/admin/gallery", { method: "POST", body });
      setGalleryImages((current) => [...uploaded, ...current]);
      setGalleryFiles([]);
      formElement.reset();
      flash("Gallery images uploaded successfully.");
    } catch (error) {
      flash(galleryErrorMessage(error), "error");
    } finally {
      setBusyAction("");
    }
  };

  const deleteGalleryImage = async (image) => {
    if (!confirm("Remove this image from the gallery?")) return;
    setBusyAction(image._id);
    try {
      await call("/admin/gallery/" + image._id, { method: "DELETE" });
      setGalleryImages((current) =>
        current.filter((item) => item._id !== image._id),
      );
      flash("Gallery image removed.");
    } catch (error) {
      flash(galleryErrorMessage(error), "error");
    } finally {
      setBusyAction("");
    }
  };

  const deleteService = async (service) => {
    if (!confirm(`Delete "${service.name}"? Past bookings keep their records.`)) {
      return;
    }
    try {
      await call("/services/" + service._id, { method: "DELETE" });
      flash("Service deleted successfully.");
      load();
    } catch (error) {
      flash(error.message, "error");
    }
  };

  const updateService = async (service, patch) => {
    const isPriceChange = Object.prototype.hasOwnProperty.call(patch, "price");
    const action = (isPriceChange ? "price-" : "service-") + service._id;
    const body = new FormData();
    Object.entries(patch).forEach(([key, value]) => body.append(key, value));
    setBusyAction(action);
    try {
      await call("/services/" + service._id, { method: "PUT", body });
      flash(
        isPriceChange
          ? "Service price updated successfully."
          : "Service updated successfully.",
      );
      load();
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusyAction("");
    }
  };

  if (!token) {
    return (
      <main className="bookpage">
        <form className="form" onSubmit={submitLogin}>
          <h1>Admin Login</h1>
          <label>
            Username
            <input
              value={login.username}
              onChange={(event) =>
                setLogin({ ...login, username: event.target.value })
              }
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={login.password}
              onChange={(event) =>
                setLogin({ ...login, password: event.target.value })
              }
            />
          </label>
          {message && <ErrorAnimation message={message} />}
          <button className="btn" disabled={loginBusy}>
            {loginBusy ? <ButtonLoader label="Logging in..." /> : "LOGIN"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <header>
        <h1 className="admin-brand">
          <img src="/admin-logo.png" alt="B&W" />
          <span>Admin</span>
        </h1>
        <NotificationHeader
          state={notificationState}
          onView={viewNotification}
        />
        <div className="tabs">
          {[
            ["appts", "Appointments"],
            ["users", "Users"],
            ["reviews", "Reviews"],
            ["offers", "Offers"],
            ["svc", "Services & Prices"],
            ["set", "Business Settings"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "on" : ""}
              onClick={() => setTab(key)}
            >
              {key === "reviews" ? `${label} (${reviews.length})` : label}
            </button>
          ))}
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      {message && (
        <div
          className={"toast " + messageType}
          role={messageType === "error" ? "alert" : "status"}
        >
          {messageType === "error" ? (
            <ErrorAnimation compact message={message} />
          ) : (
            <SuccessAnimation compact title={message} />
          )}
        </div>
      )}
      <NewAppointmentPopup
        item={notificationState.popup}
        onView={viewNotification}
        onConfirm={confirmNotification}
        onDismiss={notificationState.dismissPopup}
        confirmBusy={Boolean(
          notificationState.popup &&
            busyAction === notificationState.popup.appointmentId,
        )}
      />

      {tab === "appts" && (
        <>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setDate(today)}>
              Today
            </button>
            <button className="btn sm ghost" onClick={() => setDate("")}>
              All
            </button>
            <input
              type="date"
              aria-label="Filter appointments by date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <input
              type="search"
              aria-label="Search appointments"
              placeholder="Search booking ID, customer, or service"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleAppointments.map((appointment) => (
                  <tr key={appointment._id}>
                    <td>{appointment.date}</td>
                    <td>{fmt(appointment.time)}</td>
                    <td><b>{appointment.bookingId || "—"}</b></td>
                    <td>
                      {appointment.name}
                      <br />
                      <b>{appointment.customerId || "Legacy booking"}</b>
                      {appointment.message && <small><br />{appointment.message}</small>}
                    </td>
                    <td>{appointment.serviceName}</td>
                    <td>{inr(appointment.price)}</td>
                    <td><span className={"tag " + appointment.status}>{appointment.status}</span></td>
                    <td className="acts">
                      {appointment.status === "pending" && (
                        <>
                          <button
                            disabled={busyAction === appointment._id}
                            onClick={() => setAppointmentStatus(appointment._id, "confirmed")}
                          >
                            {busyAction === appointment._id
                              ? <ButtonLoader label="Updating..." />
                              : "Confirm"}
                          </button>
                          <button
                            disabled={busyAction === appointment._id}
                            onClick={() => setAppointmentStatus(appointment._id, "rejected")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {appointment.status === "confirmed" && (
                        <button
                          disabled={busyAction === appointment._id}
                          onClick={() => setAppointmentStatus(appointment._id, "completed")}
                        >
                          {busyAction === appointment._id
                            ? <ButtonLoader label="Updating..." />
                            : "Mark Completed"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!visibleAppointments.length && (
                  <tr>
                    <td colSpan="8">
                      {normalizedSearch
                        ? "No appointments match your search."
                        : "No appointments found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "users" && (
        <section className="admin-customers">
          <div className="admin-customers-heading">
            <div>
              <p className="eyebrow">CUSTOMER DIRECTORY</p>
              <h2>Users ({customersTotal})</h2>
              <p className="muted">
                Registered customer accounts and their appointment activity.
              </p>
            </div>
            <button
              className="btn sm ghost"
              type="button"
              disabled={customersLoading}
              onClick={() => setCustomerRefresh((value) => value + 1)}
            >
              {customersLoading
                ? <ButtonLoader label="Refreshing..." />
                : "Refresh"}
            </button>
          </div>
          <label className="admin-customer-search">
            Search users
            <input
              type="search"
              placeholder="Name, username, or customer ID"
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
          </label>
          <p className="muted">
            Showing {customersMatching} of {customersTotal} registered users.
          </p>
          {customersError && (
            <ErrorAnimation
              message={customersError}
              onRetry={() => setCustomerRefresh((value) => value + 1)}
            />
          )}
          {customersLoading && !customers.length ? (
            <div className="admin-customers-loading">
              <ButtonLoader label="Loading users..." />
            </div>
          ) : (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Customer ID</th>
                    <th>Joined</th>
                    <th>Appointments</th>
                    <th>Completed</th>
                    <th>Upcoming</th>
                    <th>Most Recent Appointment</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer._id}>
                      <td>
                        <b>{customer.name}</b>
                        <br />
                        <span className="muted">@{customer.username}</span>
                      </td>
                      <td><b>{customer.customerId}</b></td>
                      <td>{displayDate(customer.createdAt)}</td>
                      <td>{customer.appointmentCount}</td>
                      <td>{customer.completedCount}</td>
                      <td>{customer.upcomingCount}</td>
                      <td>
                        {customer.recentAppointment ? (
                          <>
                            <b>{customer.recentAppointment.serviceName}</b>
                            <br />
                            {customer.recentAppointment.bookingId || "Legacy booking"}
                            <br />
                            {customer.recentAppointment.date}
                            {customer.recentAppointment.time
                              ? ` · ${fmt(customer.recentAppointment.time)}`
                              : ""}
                            <br />
                            <span className={"tag " + customer.recentAppointment.status}>
                              {customer.recentAppointment.status}
                            </span>
                          </>
                        ) : (
                          "No appointments yet"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!customers.length && !customersError && (
                    <tr>
                      <td colSpan="7">
                        {customerSearch.trim()
                          ? "No users match your search."
                          : "No registered users yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "reviews" && (
        <>
          <h2>Customer Reviews</h2>
          {reviewError && (
            <p className="err">Could not load reviews: {reviewError}</p>
          )}
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th><th>Appointment</th><th>Rating</th>
                  <th>Review</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id}>
                    <td>
                      {review.customerId?.name || "Customer"}
                      <br />
                      <b>{review.customerId?.customerId || ""}</b>
                    </td>
                    <td>
                      {review.appointmentId?.serviceName || "Appointment"}
                      <br />
                      <small>
                        {review.appointmentId?.date || ""}
                        {review.appointmentId?.time
                          ? ` · ${fmt(review.appointmentId.time)}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      <span className="stars">
                        {"★".repeat(review.rating)}
                        <span className="star-empty">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                    </td>
                    <td>
                      {review.comment || <span className="muted">No comment</span>}
                    </td>
                    <td>{displayDate(review.createdAt)}</td>
                  </tr>
                ))}
                {!reviews.length && !reviewError && (
                  <tr><td colSpan="5">No reviews have been submitted.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "offers" && <OffersManagement call={call} flash={flash} />}

      {tab === "svc" && (
        <>
          <button className="btn sm" onClick={() => openServiceEditor(EMPTY_SERVICE)}>
            + Add Service
          </button>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Service</th><th>Price</th><th>Duration</th><th>Active</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service._id}>
                    <td>{service.name}</td>
                    <td>
                      <input
                        className="mini"
                        type="number"
                        defaultValue={service.price}
                        disabled={busyAction === "price-" + service._id}
                        onBlur={(event) => {
                          if (+event.target.value !== service.price) {
                            updateService(service, { price: event.target.value });
                          }
                        }}
                      />
                      {busyAction === "price-" + service._id && (
                        <ButtonLoader label="Updating..." />
                      )}
                    </td>
                    <td>{service.duration} min</td>
                    <td className="service-active-cell">
                      <label className="service-active-checkbox">
                        <input
                          type="checkbox"
                          checked={service.active}
                          aria-label={`Set ${service.name} ${service.active ? "inactive" : "active"}`}
                          disabled={busyAction === "service-" + service._id}
                          onChange={(event) =>
                            updateService(service, { active: event.target.checked })
                          }
                        />
                        <span className="service-active-checkbox-box" aria-hidden="true" />
                      </label>
                    </td>
                    <td className="acts">
                      <button disabled={Boolean(busyAction)} onClick={() => openServiceEditor(service)}>
                        Edit
                      </button>
                      <button disabled={Boolean(busyAction)} onClick={() => deleteService(service)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingService && (
        <div className="modal">
          <form className="pop form admin-service-form" onSubmit={saveService}>
            <h2>{editingService._id ? "Edit" : "Add"} Service</h2>
            {[
              ["name", "Name", "text"],
              ["price", "Price (₹)", "number"],
              ["duration", "Duration (min)", "number"],
            ].map(([key, label, type]) => (
              <label key={key}>
                {label}
                <input
                  type={type}
                  required
                  min={key === "price" ? "0" : key === "duration" ? "5" : undefined}
                  step={key === "price" ? "1" : undefined}
                  value={editingService[key] ?? ""}
                  onChange={(event) =>
                    setEditingService({
                      ...editingService,
                      [key]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
            <label>
              Description
              <textarea
                className="admin-service-description"
                rows="4"
                value={editingService.description || ""}
                onChange={(event) =>
                  setEditingService({
                    ...editingService,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Service image
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setServiceFile(event.target.files?.[0] || null)}
              />
              <span className="admin-service-image-help">
                Choose an image to preview it before saving.
              </span>
              {(serviceFilePreview || editingService.image) && (
                <img
                  className="admin-service-image-preview"
                  src={serviceFilePreview || assetUrl(editingService.image)}
                  alt={`${editingService.name || "Service"} preview`}
                />
              )}
            </label>
            <label className="service-active-checkbox form-service-toggle">
              <input
                type="checkbox"
                checked={editingService.active}
                aria-label={`Service is ${editingService.active ? "active" : "inactive"}`}
                onChange={(event) =>
                  setEditingService({
                    ...editingService,
                    active: event.target.checked,
                  })
                }
              />
              <span className="service-active-checkbox-box" aria-hidden="true" />
              <span className="service-active-checkbox-label">Service active</span>
            </label>
            <div className="row">
              <button className="btn sm" disabled={busyAction === "service"}>
                {busyAction === "service"
                  ? <ButtonLoader label="Saving..." />
                  : "Save"}
              </button>
              <button
                type="button"
                className="btn sm ghost"
                disabled={busyAction === "service"}
                onClick={closeServiceEditor}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "set" && (
        <section className="admin-settings-page">
          <div className="admin-settings-heading">
            <div>
              <p className="admin-settings-eyebrow">Salon profile</p>
              <h2>Business Settings</h2>
              <p>Manage the contact details and customer-facing gallery for your salon.</p>
            </div>
            <span className="admin-settings-status">Changes apply to the customer site</span>
          </div>
          <div className="admin-settings-layout">
            <form
              className="form admin-settings-form"
              onSubmit={async (event) => {
                event.preventDefault();
                await saveBusinessSettings();
              }}
            >
              <div className="admin-settings-card-heading">
                <h3>Contact information</h3>
                <p>Keep your address and contact numbers up to date.</p>
              </div>
              <label>
                Business address
                <textarea
                  rows="4"
                  autoComplete="street-address"
                  value={settings.address}
                  onChange={(event) => {
                    setSettings(current => ({ ...current, address: event.target.value }));
                    setSettingsDirty(true);
                  }}
                  required
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  autoComplete="tel"
                  value={settings.phone}
                  onChange={(event) => {
                    setSettings(current => ({ ...current, phone: event.target.value }));
                    setSettingsDirty(true);
                  }}
                  required
                />
              </label>
              <label>
                WhatsApp number (include country code)
                <input
                  type="tel"
                  autoComplete="tel"
                  value={settings.whatsapp}
                  onChange={(event) => {
                    setSettings(current => ({ ...current, whatsapp: event.target.value }));
                    setSettingsDirty(true);
                  }}
                />
              </label>
              <div className="admin-social-links">
                <div className="admin-social-links-heading">
                  <div>
                    <h3>Social media links</h3>
                    <p>These links appear beside WhatsApp on the home page.</p>
                  </div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={(settings.socialLinks || []).length >= 10}
                    onClick={() =>
                      {
                        setSettings(current => ({
                          ...current,
                          socialLinks: [...(current.socialLinks || []), {
                            name: "",
                            url: "",
                            localKey: crypto.randomUUID(),
                          }],
                        }));
                        setSettingsDirty(true);
                      }
                    }
                  >
                    Add link
                  </button>
                </div>
                {(settings.socialLinks || []).map((link) => (
                  <div className="admin-social-link-row" key={link._id || link.localKey}>
                    <label>
                      Link name
                      <input
                        value={link.name}
                        maxLength={40}
                        placeholder="Instagram"
                        onChange={(event) => {
                          setSettings(current => {
                            const socialLinks = [...(current.socialLinks || [])];
                            const linkIndex = socialLinks.findIndex(item =>
                              (item._id || item.localKey) === (link._id || link.localKey),
                            );
                            socialLinks[linkIndex] = { ...socialLinks[linkIndex], name: event.target.value };
                            return { ...current, socialLinks };
                          });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <label>
                      URL
                      <input
                        type="url"
                        value={link.url}
                        maxLength={500}
                        placeholder="https://instagram.com/your-salon"
                        onChange={(event) => {
                          setSettings(current => {
                            const socialLinks = [...(current.socialLinks || [])];
                            const linkIndex = socialLinks.findIndex(item =>
                              (item._id || item.localKey) === (link._id || link.localKey),
                            );
                            socialLinks[linkIndex] = { ...socialLinks[linkIndex], url: event.target.value };
                            return { ...current, socialLinks };
                          });
                          setSettingsDirty(true);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn sm ghost"
                      aria-label={`Remove ${link.name || "social media"} link`}
                      onClick={() => {
                        setSettings(current => ({
                          ...current,
                          socialLinks: (current.socialLinks || []).filter(item =>
                            (item._id || item.localKey) !== (link._id || link.localKey),
                          ),
                        }));
                        setSettingsDirty(true);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!(settings.socialLinks || []).length && (
                  <p className="admin-social-links-empty">No social media links added yet.</p>
                )}
                <div className="admin-social-links-save">
                  <button
                    type="button"
                    className="btn sm"
                    disabled={!settingsDirty || busyAction === "settings"}
                    onClick={saveBusinessSettings}
                  >
                    {busyAction === "settings"
                      ? <ButtonLoader label="Saving..." />
                      : "SAVE SOCIAL MEDIA LINKS"}
                  </button>
                  {settingsDirty && <span>Unsaved changes</span>}
                </div>
              </div>
              <a className="admin-settings-directions" href={dirUrl(settings)} target="_blank" rel="noreferrer">
                Preview directions <span aria-hidden="true">↗</span>
              </a>
              <button className="btn" disabled={busyAction === "settings"}>
                {busyAction === "settings"
                  ? <ButtonLoader label="Saving..." />
                  : "SAVE BUSINESS SETTINGS"}
              </button>
            </form>
            <div className="admin-settings-tools">
              <NotificationSoundSettings state={notificationState} />
              <section className="admin-gallery-editor">
                <div className="admin-gallery-heading">
                  <div>
                    <h3>Customer gallery</h3>
                    <p>Manage the photos shown on your public salon page.</p>
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    aria-expanded={galleryOpen}
                    onClick={() => {
                      const nextOpen = !galleryOpen;
                      setGalleryOpen(nextOpen);
                      if (nextOpen) loadGallery();
                    }}
                  >
                    {galleryOpen ? "Close gallery" : "Edit gallery"}
                  </button>
                </div>
                {galleryOpen && (
                  <div className="admin-gallery-content">
                    <p className="muted">
                      Upload JPG, PNG, WebP or GIF images, up to 3 MB each. You can
                      add up to 12 photos per upload.
                    </p>
                    <form className="admin-gallery-upload" onSubmit={uploadGalleryImages}>
                      <label>
                        Add gallery photos
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          onChange={(event) =>
                            setGalleryFiles(Array.from(event.target.files || []))
                          }
                        />
                      </label>
                      <button
                        className="btn sm"
                        disabled={galleryLoading || galleryActionBusy || !galleryFiles.length}
                      >
                        {busyAction === "gallery-upload"
                          ? <ButtonLoader label="Uploading..." />
                          : "UPLOAD PHOTOS"}
                      </button>
                    </form>
                    {galleryLoading ? (
                      <p className="muted">Loading gallery...</p>
                    ) : galleryImages.length ? (
                      <div className="admin-gallery-grid">
                        {galleryImages.map((image) => (
                          <article key={image._id}>
                            <img src={assetUrl(image.image)} alt="Salon gallery" />
                            <button
                              type="button"
                              disabled={galleryActionBusy}
                              onClick={() => deleteGalleryImage(image)}
                            >
                              {busyAction === image._id ? "Removing..." : "Remove"}
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">No custom gallery photos yet.</p>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
