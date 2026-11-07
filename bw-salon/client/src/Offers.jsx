import { useCallback, useEffect, useState } from "react";
import { api, assetUrl } from "./shared.js";
import { ButtonLoader } from "./Animation.jsx";

const EMPTY_OFFER = {
  title: "",
  description: "",
  offerType: "TEXT",
  imageUrl: "",
  discountType: "SPECIAL_OFFER",
  discountValue: "",
  validFrom: "",
  validUntil: "",
  termsAndConditions: "",
  ctaText: "",
  ctaLink: "",
  isActive: true,
  isFeatured: false,
  displayFrequency: "SESSION",
  repeatDays: 7,
};
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "No end date";

const discountLabel = (offer) => {
  if (offer.discountType === "PERCENTAGE" && offer.discountValue !== "" && offer.discountValue !== null && offer.discountValue !== undefined) {
    return `${offer.discountValue}% OFF`;
  }
  if (offer.discountType === "FIXED_AMOUNT" && offer.discountValue !== "" && offer.discountValue !== null && offer.discountValue !== undefined) {
    return `₹${offer.discountValue} OFF`;
  }
  return offer.discountType === "SPECIAL_OFFER" ? "SPECIAL OFFER" : "";
};

function OfferPreview({ offer, image }) {
  return (
    <article className="offer-admin-preview">
      {offer.offerType === "IMAGE" && image && (
        <img src={assetUrl(image)} alt="Offer preview" />
      )}
      <div>
        <p className="offer-eyebrow">{offer.isFeatured ? "FEATURED OFFER" : "SPECIAL OFFER"}</p>
        <h3>{offer.title || "Your offer title"}</h3>
        {discountLabel(offer) && (
          <strong className="offer-discount">{discountLabel(offer)}</strong>
        )}
        <p>{offer.description || "Your offer description will appear here."}</p>
        {(offer.validFrom || offer.validUntil) && (
          <small>
            Valid {offer.validFrom ? `from ${formatDate(offer.validFrom)}` : ""}
            {offer.validFrom && offer.validUntil ? " " : ""}
            {offer.validUntil ? `until ${formatDate(offer.validUntil)}` : ""}
          </small>
        )}
        {offer.termsAndConditions && (
          <small className="offer-preview-terms">{offer.termsAndConditions}</small>
        )}
        {offer.ctaText && <span className="offer-preview-cta">{offer.ctaText}</span>}
      </div>
    </article>
  );
}

export function OffersManagement({ call, flash }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState("");

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setOffers(await call("/offers/admin"));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const closeEditor = () => {
    if (busy === "save") return;
    setEditing(null);
    setImageFile(null);
    setShowPreview(false);
    setFormError("");
  };

  const openEditor = (offer) => {
    setEditing(offer ? { ...offer } : { ...EMPTY_OFFER });
    setImageFile(null);
    setShowPreview(false);
    setFormError("");
  };

  const changeField = (event) => {
    const { name, value, type, checked } = event.target;
    setEditing((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "offerType" && value === "TEXT" ? { imageUrl: "" } : {}),
    }));
    if (name === "offerType" && value === "TEXT") setImageFile(null);
    setFormError("");
  };

  const chooseImage = (event) => {
    const file = event.target.files?.[0] || null;
    setFormError("");
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setFormError("Choose a JPG, JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setFormError("The offer image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
  };

  const saveOffer = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (
      editing.offerType === "IMAGE" &&
      !imageFile &&
      !editing.imageUrl
    ) {
      setFormError("Upload an image for an image-based offer.");
      return;
    }
    if (
      editing.validFrom &&
      editing.validUntil &&
      editing.validUntil < editing.validFrom
    ) {
      setFormError("The end date must be on or after the start date.");
      return;
    }

    const body = new FormData();
    Object.entries(editing).forEach(([key, value]) => {
      if (key !== "_id" && key !== "imageUrl" && value != null) {
        body.append(key, value);
      }
    });
    if (imageFile) body.append("image", imageFile);
    const isUpdate = Boolean(editing._id);
    setBusy("save");
    setFormError("");
    try {
      await call(isUpdate ? `/offers/${editing._id}` : "/offers", {
        method: isUpdate ? "PUT" : "POST",
        body,
      });
      setEditing(null);
      setImageFile(null);
      setShowPreview(false);
      flash(isUpdate ? "Offer updated successfully." : "Offer created successfully.");
      await loadOffers();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy("");
    }
  };

  const changeStatus = async (offer) => {
    setBusy(offer._id);
    try {
      const updated = await call(`/offers/${offer._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      setOffers((current) =>
        current.map((item) => (item._id === updated._id ? updated : item)),
      );
      flash(`Offer ${updated.isActive ? "activated" : "deactivated"} successfully.`);
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusy("");
    }
  };

  const deleteOffer = async (offer) => {
    if (!window.confirm(`Delete "${offer.title}"? This cannot be undone.`)) return;
    setBusy(offer._id);
    try {
      await call(`/offers/${offer._id}`, { method: "DELETE" });
      setOffers((current) => current.filter((item) => item._id !== offer._id));
      flash("Offer deleted successfully.");
    } catch (error) {
      flash(error.message, "error");
    } finally {
      setBusy("");
    }
  };

  const draftImage = imagePreview || editing?.imageUrl;
  const hasActiveOffer = offers.some(
    (offer) =>
      offer.isActive &&
      (!offer.validFrom || offer.validFrom <= today()) &&
      (!offer.validUntil || offer.validUntil >= today()),
  );

  return (
    <section className="offers-management">
      <header className="offers-heading">
        <div>
          <h2>Offers &amp; Promotions</h2>
          <p>Create and manage promotional offers displayed on your salon website.</p>
        </div>
        <button className="btn" type="button" onClick={() => openEditor(null)}>
          + Add New Offer
        </button>
      </header>

      {loadError && (
        <div className="offers-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={loadOffers}>Retry</button>
        </div>
      )}
      {!loading && !loadError && offers.length > 0 && !hasActiveOffer && (
        <p className="offers-empty" role="status">
          No active promotions are currently displayed to customers.
        </p>
      )}
      {loading ? (
        <p className="offers-empty"><ButtonLoader label="Loading offers..." /></p>
      ) : offers.length ? (
        <div className="offers-admin-grid">
          {offers.map((offer) => (
            <article className="offers-admin-card" key={offer._id}>
              {offer.imageUrl ? (
                <img className="offers-admin-thumb" src={assetUrl(offer.imageUrl)} alt="" />
              ) : (
                <div className="offers-admin-thumb offers-admin-thumb-empty">TEXT OFFER</div>
              )}
              <div className="offers-admin-card-content">
                <div className="offers-admin-card-badges">
                  <span>{offer.offerType === "IMAGE" ? "Image offer" : "Text offer"}</span>
                  <span className={offer.isActive ? "offer-status-active" : "offer-status-inactive"}>
                    {offer.isActive ? "Active" : "Inactive"}
                  </span>
                  {offer.isFeatured && <span className="offer-featured-badge">Featured</span>}
                </div>
                <h3>{offer.title}</h3>
                <p>{offer.description}</p>
                <dl>
                  <div><dt>Valid</dt><dd>{offer.validFrom ? formatDate(offer.validFrom) : "Any date"} – {formatDate(offer.validUntil)}</dd></div>
                  <div><dt>Created</dt><dd>{new Date(offer.createdAt).toLocaleDateString()}</dd></div>
                </dl>
                <div className="offers-admin-actions">
                  <button type="button" onClick={() => changeStatus(offer)} disabled={Boolean(busy)}>
                    {busy === offer._id ? "Updating..." : offer.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" onClick={() => openEditor(offer)} disabled={Boolean(busy)}>Edit</button>
                  <button type="button" className="offer-delete" onClick={() => deleteOffer(offer)} disabled={Boolean(busy)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="offers-empty">
          <h3>No offers yet</h3>
          <p>Create an offer to promote it on your salon website.</p>
        </div>
      )}

      {editing && (
        <div
          className="modal offer-editor-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <form
            className="offer-editor"
            onSubmit={saveOffer}
            aria-labelledby="offer-editor-title"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="offer-editor-close"
              onClick={closeEditor}
              aria-label="Close offer editor"
            >
              ×
            </button>
            <h2 id="offer-editor-title">{editing._id ? "Edit Offer" : "Add New Offer"}</h2>
            <label>
              Offer type
              <select name="offerType" value={editing.offerType} onChange={changeField}>
                <option value="TEXT">Text-based offer</option>
                <option value="IMAGE">Image-based offer</option>
              </select>
            </label>
            {editing.offerType === "IMAGE" && (
              <label>
                Offer image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={chooseImage}
                />
                <span className="offer-field-help">JPG, JPEG, PNG, or WebP. Maximum 5 MB.</span>
                {draftImage && (
                  <img className="offer-image-preview" src={assetUrl(draftImage)} alt="Offer image preview" />
                )}
              </label>
            )}
            <label>
              Offer title
              <input name="title" value={editing.title} maxLength="100" required onChange={changeField} />
            </label>
            <label>
              Offer description
              <textarea name="description" rows="3" maxLength="1000" required value={editing.description} onChange={changeField} />
            </label>
            <div className="offer-editor-row">
              <label>
                Discount type
                <select name="discountType" value={editing.discountType} onChange={changeField}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed amount</option>
                  <option value="SPECIAL_OFFER">Special offer</option>
                </select>
              </label>
              {editing.discountType !== "SPECIAL_OFFER" && (
                <label>
                  Discount value (optional)
                  <input
                    name="discountValue"
                    type="number"
                    min="0.01"
                    max={editing.discountType === "PERCENTAGE" ? "100" : undefined}
                    step="any"
                    value={editing.discountValue ?? ""}
                    onChange={changeField}
                  />
                </label>
              )}
            </div>
            <div className="offer-editor-row">
              <label>
                Valid from
                <input type="date" name="validFrom" value={editing.validFrom || ""} onChange={changeField} />
              </label>
              <label>
                Valid until
                <input type="date" name="validUntil" value={editing.validUntil || ""} onChange={changeField} />
              </label>
            </div>
            <label>
              Terms and conditions (optional)
              <textarea name="termsAndConditions" rows="2" maxLength="1500" value={editing.termsAndConditions || ""} onChange={changeField} />
            </label>
            <div className="offer-editor-row">
              <label>
                CTA button text (optional)
                <input name="ctaText" maxLength="40" value={editing.ctaText || ""} onChange={changeField} placeholder="Book Now" />
              </label>
              <label>
                CTA destination (optional)
                <input name="ctaLink" maxLength="500" value={editing.ctaLink || ""} onChange={changeField} placeholder="/book or https://..." />
              </label>
            </div>
            <label>
              Popup frequency
              <select name="displayFrequency" value={editing.displayFrequency} onChange={changeField}>
                <option value="SESSION">Once per browser session</option>
                <option value="UNTIL_DISMISSED">Once per session until dismissed</option>
                <option value="AFTER_DAYS">Show again after a number of days</option>
              </select>
            </label>
            {editing.displayFrequency === "AFTER_DAYS" && (
              <label>
                Repeat after (days)
                <input name="repeatDays" type="number" min="1" max="365" required value={editing.repeatDays || 7} onChange={changeField} />
              </label>
            )}
            <div className="offer-editor-checks">
              <label><input name="isActive" type="checkbox" checked={Boolean(editing.isActive)} onChange={changeField} /> Offer is active</label>
              <label><input name="isFeatured" type="checkbox" checked={Boolean(editing.isFeatured)} onChange={changeField} /> Feature this offer</label>
            </div>

            {showPreview && (
              <div className="offer-preview-panel">
                <h3>Offer preview</h3>
                <OfferPreview offer={editing} image={draftImage} />
              </div>
            )}
            {formError && <p className="offers-error" role="alert">{formError}</p>}
            <div className="offer-editor-actions">
              <button type="button" className="btn ghost" onClick={() => setShowPreview((value) => !value)}>
                {showPreview ? "HIDE PREVIEW" : "PREVIEW"}
              </button>
              <button type="submit" className="btn" disabled={Boolean(busy)}>
                {busy === "save" ? <ButtonLoader label="Saving offer..." /> : editing._id ? "SAVE CHANGES" : "PUBLISH OFFER"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

const storageRead = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const storageWrite = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
};

const dismissedKey = (id) => `bw-offer-dismissed-${id}`;
const sessionKey = (id) => `bw-offer-session-${id}`;
const shownKey = (id) => `bw-offer-shown-${id}`;

const offerIsEligible = (offer, now = Date.now()) => {
  if (storageRead(localStorage, dismissedKey(offer._id))) return false;
  if (storageRead(sessionStorage, sessionKey(offer._id))) return false;
  if (offer.displayFrequency === "AFTER_DAYS") {
    const lastShown = Number(storageRead(localStorage, shownKey(offer._id)) || 0);
    const interval = Math.max(1, Number(offer.repeatDays) || 1) * 24 * 60 * 60 * 1000;
    if (lastShown && now - lastShown < interval) return false;
  }
  return true;
};

export function OffersPopup() {
  const [offers, setOffers] = useState([]);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const offer = offers[index];
  const closePopup = useCallback(() => {
    offers.forEach((item) =>
      storageWrite(sessionStorage, sessionKey(item._id), "1"),
    );
    setActive(false);
  }, [offers]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    api("/offers/active")
      .then((result) => {
        if (cancelled) return;
        const eligible = result.filter(offerIsEligible);
        if (!eligible.length) return;
        setOffers(eligible);
        timer = setTimeout(() => {
          if (!cancelled) setActive(true);
        }, 900);
      })
      .catch((error) => {
        console.error("Unable to load salon offers:", error);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!active || !offer) return undefined;
    storageWrite(sessionStorage, sessionKey(offer._id), "1");
    if (offer.displayFrequency === "AFTER_DAYS") {
      storageWrite(localStorage, shownKey(offer._id), String(Date.now()));
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, offer, closePopup]);

  if (!active || !offer) return null;

  const move = (offset) => {
    setIndex((current) => (current + offset + offers.length) % offers.length);
  };
  const dismissPermanently = () => {
    storageWrite(localStorage, dismissedKey(offer._id), String(Date.now()));
    const remaining = offers.filter((item) => item._id !== offer._id);
    setOffers(remaining);
    if (!remaining.length) {
      setActive(false);
      setIndex(0);
    } else {
      setIndex((currentIndex) => Math.min(currentIndex, remaining.length - 1));
    }
  };
  const validity = offer.validFrom || offer.validUntil
    ? `Valid ${offer.validFrom ? `from ${formatDate(offer.validFrom)}` : ""}${offer.validFrom && offer.validUntil ? " " : ""}${offer.validUntil ? `until ${formatDate(offer.validUntil)}` : ""}`
    : "Limited period only";
  const destination = offer.ctaLink || "/book";
  const external = !destination.startsWith("/") && !destination.startsWith("#");

  return (
    <div
      className="offer-popup-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePopup();
      }}
    >
      <section
        className="offer-popup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-offer-title"
      >
        <button className="offer-popup-close" type="button" aria-label="Close offer" onClick={closePopup} autoFocus>
          ×
        </button>
        <svg className="offer-popup-ornament" viewBox="0 0 120 50" aria-hidden="true">
          <path d="M3 42 21 9l18 33L60 9l21 33L99 9l18 33" />
          <circle cx="60" cy="25" r="22" />
        </svg>
        {offer.imageUrl && (
          <div className="offer-popup-image-wrap">
            <img className="offer-popup-image" src={assetUrl(offer.imageUrl)} alt={offer.title} />
          </div>
        )}
        <div className="offer-popup-content">
          <p className="offer-eyebrow">{offer.isFeatured ? "FEATURED OFFER" : "EXCLUSIVE SALON OFFER"}</p>
          {offers.length > 1 && <span className="offer-popup-count">{index + 1} of {offers.length}</span>}
          <h2 id="customer-offer-title">{offer.title}</h2>
          {discountLabel(offer) && <strong className="offer-discount">{discountLabel(offer)}</strong>}
          <p className="offer-popup-description">{offer.description}</p>
          {offer.termsAndConditions && <p className="offer-popup-terms">{offer.termsAndConditions}</p>}
          <p className="offer-popup-validity">{validity}</p>
          {offer.ctaText && (
            <a className="offer-popup-cta" href={destination} onClick={closePopup} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {offer.ctaText}
              <span aria-hidden="true"> →</span>
            </a>
          )}
        </div>
        {offers.length > 1 && (
          <div className="offer-popup-navigation">
            <button type="button" onClick={() => move(-1)} aria-label="Previous offer">‹</button>
            <div aria-hidden="true">{offers.map((item, itemIndex) => <span className={itemIndex === index ? "current" : ""} key={item._id} />)}</div>
            <button type="button" onClick={() => move(1)} aria-label="Next offer">›</button>
          </div>
        )}
        <button className="offer-popup-dismiss" type="button" onClick={dismissPermanently}>
          Don&apos;t Show Again
        </button>
      </section>
    </div>
  );
}
