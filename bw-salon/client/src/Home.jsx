import { useEffect, useRef, useState } from "react";
import { useFetch, useReveal, inr, dirUrl, mapSrc, tel, D0, assetUrl } from "./shared.js";
const U = (i) =>
  `https://images.unsplash.com/${i}?auto=format&fit=crop&w=900&q=70`;
const REV = [
  ["Ravi K.", "Best haircut in Bhimavaram. Clean place and friendly staff."],
  [
    "Suresh P.",
    "Beard trim was perfect, and no long wait thanks to online booking.",
  ],
  ["Naveen M.", "Professional work at fair prices. Highly recommended."],
  ["Kiran T.", "The hair spa made a real difference. Will visit again."],
];
const NAV = ["home", "services", "catalogue", "about", "gallery", "reviews", "contact"];
const SERVICE_GUIDE = [
  {
    category: "Hair Styling Services",
    services: [
      {
        name: "Hair Styling",
        description: "Create a look for any occasion, from a casual day out to a formal event. A stylist consultation helps choose a cut, colour or style such as an updo or braid that suits your features and personal style. Professional products and tools help bring the look together.",
        details: [["Aftercare", "Use recommended styling products, avoid humidity, and protect styles overnight."], ["Type", "Hair Styling"], ["Hair length", "Suitable for all hair lengths."]],
      },
      {
        name: "Hair Cut",
        description: "Choose a classic or contemporary cut, or ask your stylist for advice on a fresh look. Optional shampooing, scalp massage and styling can make the visit more relaxing.",
        details: [["Aftercare", "Use recommended hair products and schedule regular trims every 6–8 weeks."], ["Type", "Hair Cut"], ["Hair length", "Suitable for all hair lengths."], ["Cut type", "Cuts can be tailored to customer requirements."]],
      },
      {
        name: "Hair Colour",
        description: "Refresh your look with a bold new hue, highlights or a subtle colour change. A consultation helps assess hair condition and choose a shade and maintenance approach. Colour options include permanent, semi-permanent and temporary.",
        details: [["Aftercare", "Use sulfate-free shampoo and deep condition regularly."], ["Type", "Hair Colour"], ["Hair length", "Suitable for all hair lengths."], ["Hair type", "Suitable for all hair types."]],
      },
      {
        name: "Hair Straightening",
        description: "Smooth curly or wavy hair for a sleek, polished look with reduced frizz. Straightening may use heat tools or chemical treatments, with results that can last for weeks or months.",
        details: [["Benefits", "Smooth, sleek hair with reduced frizz and long-lasting straightness."], ["Aftercare", "Avoid washing for 72 hours, use sulfate-free shampoo, and minimize heat styling."], ["Type", "Hair Straightening"], ["Hair type", "Suitable for all hair types."]],
      },
      {
        name: "Hair Blow Dry",
        description: "Add volume, shine and smoothness with a wash and conditioning treatment followed by a tailored blow-dry. Choose a sleek finish or bouncy waves; your stylist can also share tips for maintaining the style at home.",
        details: [["Equipment", "Blow dryer, round brush and hair clips."], ["Aftercare", "Avoid washing for 24 hours."], ["Type", "Hair Blow Dry"], ["Hair type", "Suitable for all hair types."]],
      },
      {
        name: "Hair Curling",
        description: "Get curls tailored to your hair type and the occasion, using professional curling techniques and tools. Your stylist can share tips to help maintain the look at home.",
        details: [["Aftercare", "Avoid washing for 24 hours and use heat protectant."], ["Type", "Hair Curling"], ["Hair length", "Suitable for all hair lengths."]],
      },
      {
        name: "Hair Rebonding",
        description: "A chemical treatment that rearranges hair bonds to create a straighter, smoother finish. The multi-step process uses a relaxant, neutralizer and heat; results are long-lasting and need careful aftercare.",
        details: [["Benefits", "Smooths hair, reduces frizz, adds shine and can make hair easier to manage."], ["Aftercare", "Avoid washing for 2–3 days after treatment and do not use heavy styling products."], ["Type", "Hair Rebonding"], ["Hair type", "Suitable for all hair types."]],
      },
    ],
  },
  {
    category: "Beard Grooming Services",
    services: [
      {
        name: "Beard Styling",
        description: "A personalized beard trim, shape or full grooming service to complement your facial features and preferred style, using clean, sanitized tools.",
        details: [["Aftercare", "Use beard oil, comb regularly, and avoid washing for 24 hours."], ["Type", "Beard Styling"]],
      },
      {
        name: "Beard Shaving",
        description: "Get a clean, precise shave with a traditional straight razor or a modern trimming style, tailored to your preference. Clean towels and sterilized razors help keep the service comfortable.",
        details: [["Aftercare", "Apply soothing balm, avoid sun exposure, and moisturize skin."], ["Type", "Beard Shave"]],
      },
      {
        name: "Beard Trimming",
        description: "Keep facial hair neat with a careful trim, shape and blend tailored to your preferences. Regular trimming can help manage growth and reduce discomfort.",
        details: [["Aftercare", "Apply beard oil, comb, and trim split ends regularly."], ["Type", "Beard Trim"]],
      },
    ],
  },
  {
    category: "Hair Care Services",
    services: [
      {
        name: "Hair Spa",
        description: "A relaxing hair and scalp treatment using nourishing products with ingredients such as essential oils, vitamins and nutrients to restore softness and vitality.",
        details: [["Benefits", "Nourishes the scalp, supports healthy-looking hair, and enhances shine."], ["Aftercare", "Use recommended hair products and avoid excessive heat styling."]],
      },
      {
        name: "Hair Wash",
        description: "A refreshing cleanse with shampoo and conditioner suited to your hair type, with a soothing scalp massage. Ideal before styling or whenever your hair needs a refresh.",
        details: [["Benefits", "Cleanses the scalp and hair and helps leave it feeling soft and manageable."], ["Aftercare", "Use recommended products for maintenance and avoid excessive heat styling."]],
      },
    ],
  },
  {
    category: "Face Care Services",
    services: [
      {
        name: "Face Bleach",
        description: "A professional treatment to lighten facial hair and brighten the appearance of the complexion, with product choice and application adapted to skin sensitivity.",
        details: [["Benefits", "Lightens facial hair and can help even the appearance of skin tone."], ["Aftercare", "Avoid sun exposure and apply sunscreen and moisturizer."], ["Type", "Face Bleach"]],
      },
      {
        name: "Face Clean Up",
        description: "A refreshing treatment that cleanses and exfoliates the skin, with masks or scrubs and gentle extractions when appropriate, followed by moisturizer.",
        details: [["Benefits", "Deep cleans, exfoliates and hydrates skin."], ["Aftercare", "Moisturize regularly and use sunscreen."], ["Type", "Face Clean Up"]],
      },
      {
        name: "Face D-Tan",
        description: "A gentle exfoliating treatment to refresh the complexion after time in the sun, leaving skin feeling smoother and hydrated.",
        details: [["Benefits", "Helps reduce the appearance of tan and improve skin texture."], ["Aftercare", "Apply soothing cream and sunscreen."], ["Type", "Face D-Tan"]],
      },
      {
        name: "Facial",
        description: "A relaxing skincare treatment tailored to your skin type. It may include cleansing, exfoliation, steam, masks and massage to leave skin feeling refreshed.",
        details: [["Skin type", "Suitable for all skin types."], ["Benefits", "Cleanses pores, hydrates skin and improves the feel and appearance of skin texture."], ["Aftercare", "Avoid makeup for 24 hours, use gentle products, and stay hydrated."], ["Type", "Facial"]],
      },
    ],
  },
  {
    category: "Other Grooming & Care Services",
    services: [
      {
        name: "Head Massage",
        description: "A relaxing scalp massage using slow, circular movements to ease tension and support a sense of calm. Essential oils can be added for a soothing experience.",
        details: [["Targeted area", "Head and scalp."], ["Purpose", "Relieves tension, supports relaxation and promotes circulation."], ["Aftercare", "Stay hydrated and avoid heavy hair products for the day."]],
      },
      {
        name: "Pedicure",
        description: "A pampering foot-care service that may include nail trimming, exfoliation, callus care and a hydrating massage, with optional polish.",
        details: [["Benefits", "Supports foot and nail care and relaxes the feet and lower legs."], ["Aftercare", "Avoid soaking feet for a few hours and keep them moisturized."], ["Type", "Pedicure"]],
      },
      {
        name: "Manicure",
        description: "Care for hands and nails, with options such as classic polish, gel finish or nail art, tailored to your preferences.",
        details: [["Benefits", "Enhances nail appearance and supports hand and nail care."], ["Aftercare", "Avoid soaking hands for a few hours and use gloves for cleaning tasks."], ["Type", "Manicure"]],
      },
      {
        name: "Keratin Treatment",
        description: "A customized smoothing treatment that can help reduce frizz, add shine and make hair easier to style. Your stylist can advise on an approach suited to your hair.",
        details: [["Benefits", "Smooths hair, reduces frizz, adds shine and can reduce styling time."], ["Aftercare", "Avoid washing for 72 hours, use sulfate-free products, and avoid chlorinated water." ]],
      },
      {
        name: "Makeup",
        description: "Professional makeup for weddings, special events and other occasions. The look is tailored to your preferences and skin tone, using clean tools and applicators.",
        details: [["Aftercare", "Avoid touching the face, remove makeup gently, and hydrate skin."], ["Hygiene", "Clean tools, a sanitized environment and new applicators."], ["Customizable", "Tailored to individual preferences and skin tone."]],
      },
    ],
  },
];
const Stars = () => (
  <span className="stars" aria-label="5 stars">
    ★★★★★
  </span>
);
const safeSocialUrl = value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
export default function Home() {
  const s = useFetch("/settings", D0),
    sv = useFetch("/services", []),
    gallery = useFetch("/gallery", []);
  const [open, setOpen] = useState(false),
    [act, setAct] = useState("home"),
    [pic, setPic] = useState(null),
    [ri, setRi] = useState(0),
    [serviceGuideOpen, setServiceGuideOpen] = useState(null);
  const serviceGuideCloseRef = useRef(null);
  const serviceGuideTriggerRef = useRef(null);
  useReveal();
  useEffect(() => {
    const f = () => {
      let c = "home";
      NAV.forEach((id) => {
        const e = document.getElementById(id);
        if (e && e.getBoundingClientRect().top < 120) c = id;
      });
      setAct(c);
    };
    f();
    addEventListener("scroll", f);
    return () => removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") {
        setPic(null);
        setServiceGuideOpen(null);
      }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (serviceGuideOpen === null) {
      serviceGuideTriggerRef.current?.focus();
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    serviceGuideCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [serviceGuideOpen]);
  const go = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <>
      <header className="nav">
        <a
          className="logo"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <img
            className="customer-brand-logo"
            src="/customer-logo.png"
            alt="B&W The Men's Salon home"
          />
        </a>
        <button
          className={"burger" + (open ? " x" : "")}
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <i />
          <i />
          <i />
        </button>
        <nav className={open ? "open" : ""}>
          {NAV.map((n) => (
            <a
              key={n}
              href={"#" + n}
              className={act === n ? "on" : ""}
              onClick={(e) => {
                e.preventDefault();
                go(n);
              }}
            >
              {n === "about" ? "About" : n[0].toUpperCase() + n.slice(1)}
            </a>
          ))}
          <a href="/account">My Account</a>
          <a className="btn sm" href="/book">
            Book Appointment
          </a>
        </nav>
      </header>
      <section id="home" className="hero">
        <div className="wrap">
          <a className="hero-logo-link" href="#home" aria-label="B&W home">
            {/* <img
              className="hero-customer-logo"
              src="/customer-logo.png"
              alt="B&W The Men's Salon"
            /> */}
          </a>
          <p className="eyebrow">Bhimavaram's Men's Grooming</p>
          <h1>
            Look Good. <span>Feel Great.</span>
          </h1>
          <p className="sub">
            Book your perfect salon experience in just a few clicks.
          </p>
          <div className="row">
            <a className="btn" href="/book">
              BOOK APPOINTMENT
            </a>
            <button className="btn ghost" onClick={() => go("services")}>
              EXPLORE SERVICES
            </button>
          </div>
        </div>
      </section>
      <section id="services" className="sec">
        <div className="wrap">
          <h2 className="fade">Our Services</h2>
          <div className="grid">
            {sv.map((x) => (
              <article key={x._id} className="card fade">
                <div className="im">
                  <img loading="lazy" src={assetUrl(x.image)} alt={x.name} />
                </div>
                <div className="cb">
                  <h3>{x.name}</h3>
                  <p>{x.description}</p>
                  <div className="meta">
                    <b>{inr(x.price)}</b>
                    <span>⏱ {x.duration} min</span>
                  </div>
                  <a className="btn sm" href={"/book?service=" + x._id}>
                    Book Now
                  </a>
                </div>
              </article>
            ))}
          </div>
          <div className="service-guide" id="catalogue">
            <h3 className="service-guide-title">Explore Our Service Catalogue</h3>
            <p className="service-guide-intro">
              Browse our grooming and care services for details and aftercare.
              This catalogue is for viewing; appointment booking is available
              for services listed in the book appointment menu.
            </p>
            <div className="service-guide-categories">
              {SERVICE_GUIDE.map((group, index) => (
                <button
                  className="service-guide-category"
                  key={group.category}
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={`Open ${group.category}`}
                  onClick={(event) => {
                    serviceGuideTriggerRef.current = event.currentTarget;
                    setServiceGuideOpen(index);
                  }}
                >
                  <span>{group.category}</span>
                  <span className="service-guide-category-count">
                    {group.services.length} services <span aria-hidden="true">↗</span>
                  </span>
                </button>
              ))}
            </div>
            {serviceGuideOpen !== null && (
              <div
                className="service-guide-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setServiceGuideOpen(null);
                }}
              >
                <section
                  aria-modal="true"
                  aria-labelledby="service-guide-dialog-title"
                  className="service-guide-dialog"
                  role="dialog"
                >
                  <div className="service-guide-dialog-heading">
                    <div>
                      <p className="service-guide-dialog-eyebrow">Service catalogue</p>
                      <h3 id="service-guide-dialog-title">
                        {SERVICE_GUIDE[serviceGuideOpen].category}
                      </h3>
                    </div>
                    <button
                      aria-label="Close service catalogue"
                      className="service-guide-close"
                      ref={serviceGuideCloseRef}
                      onClick={() => setServiceGuideOpen(null)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <div className="service-guide-tabs" aria-label="Service categories">
                    {SERVICE_GUIDE.map((group, index) => (
                      <button
                        aria-pressed={serviceGuideOpen === index}
                        className={serviceGuideOpen === index ? "active" : ""}
                        key={group.category}
                        onClick={() => setServiceGuideOpen(index)}
                        type="button"
                      >
                        {group.category}
                      </button>
                    ))}
                  </div>
                  <div className="service-guide-dialog-services" key={serviceGuideOpen}>
                    {SERVICE_GUIDE[serviceGuideOpen].services.map((service) => (
                      <details className="service-guide-item" key={service.name}>
                        <summary>{service.name}</summary>
                        <div className="service-guide-content">
                          <p>{service.description}</p>
                          <dl>
                            {service.details.map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </section>
      <section id="about" className="sec dark">
        <div className="wrap two">
          <div className="fade">
            <h2>About Us</h2>
            <p>
              B&amp;W The Men's Salon is Bhimavaram's destination for sharp,
              comfortable and professional men's grooming.
            </p>
            <ul className="ticks">
              <li>Experienced, skilled barbers and stylists</li>
              <li>Quality products and hygienic tools</li>
              <li>Transparent pricing, no surprises</li>
              <li>Hundreds of happy regulars</li>
            </ul>
          </div>
          <img
            className="fade round"
            src={U("photo-1599351431202-1e0f0137899a")}
            alt="Barber at work"
            loading="lazy"
          />
        </div>
      </section>
      <section id="gallery" className="sec">
        <div className="wrap">
          <h2 className="fade">Gallery</h2>
          {gallery.length ? (
            <div className="gal">
              {gallery.map((image) => (
                <button
                  key={image._id}
                  onClick={() => setPic(assetUrl(image.image))}
                  aria-label="Open image"
                >
                  <img loading="lazy" src={assetUrl(image.image)} alt="Salon gallery" />
                </button>
              ))}
            </div>
          ) : (
            <p className="gallery-coming-soon">Gallery is coming soon.</p>
          )}
        </div>
      </section>
      {pic && (
        <div className="modal" onClick={() => setPic(null)}>
          <button className="close" aria-label="Close">
            ×
          </button>
          <img src={pic} alt="Salon gallery preview" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      <section id="reviews" className="sec dark">
        <div className="wrap center">
          <h2 className="fade">Customer Reviews</h2>
          <p className="rate">
            <Stars /> <b>4.8</b> on Google · 200+ reviews{" "}
            <small>(update with your real numbers)</small>
          </p>
          <div className="rev">
            <button
              aria-label="Previous"
              onClick={() => setRi((ri + REV.length - 1) % REV.length)}
            >
              ‹
            </button>
            <blockquote key={ri}>
              <Stars />
              <p>“{REV[ri][1]}”</p>
              <cite>— {REV[ri][0]}</cite>
            </blockquote>
            <button
              aria-label="Next"
              onClick={() => setRi((ri + 1) % REV.length)}
            >
              ›
            </button>
          </div>
        </div>
      </section>
      <section id="contact" className="sec">
        <div className="wrap">
          <h2 className="fade">VISIT OUR SALON</h2>
          <p className="sub2 fade">
            Find us in Bhimavaram and experience professional men's grooming.
          </p>
          <div className="two">
            <iframe
              title="Salon location"
              className="map fade"
              loading="lazy"
              src={mapSrc(s)}
            />
            <div className="fade">
              <p>
                <b>B&amp;W THE MEN'S SALON</b>
                <br />
                {s.address}
              </p>
              <p>📞 {s.phone}</p>
              <p>🕙 Mon–Sun: 10:00 AM – 8:00 PM</p>
              <div className="row">
                <a
                  className="btn"
                  href={dirUrl(s)}
                  target="_blank"
                  rel="noreferrer"
                >
                  GET DIRECTIONS
                </a>
                <a className="btn ghost" href={tel(s)}>
                  CALL NOW
                </a>
                <a
                  className="btn ghost"
                  href={"https://wa.me/" + s.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                >
                  WHATSAPP
                </a>
                {(s.socialLinks || []).map((link, index) => {
                  const href = safeSocialUrl(link.url);
                  if (!href || !link.name?.trim()) return null;
                  return (
                    <a
                      className="btn ghost"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={`${href}-${index}`}
                    >
                      {link.name}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      <footer>
        © {new Date().getFullYear()} B&amp;W The Men's Salon, Bhimavaram
      </footer>
    </>
  );
}
