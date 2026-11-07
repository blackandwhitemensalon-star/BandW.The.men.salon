import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home.jsx";
import Book from "./Book.jsx";
import Admin from "./Admin.jsx";
import Customer from "./Customer.jsx";
import { GlobalLoader } from "./Animation.jsx";
import { OffersPopup } from "./Offers.jsx";
import "./styles.css";

function App() {
  const [ready, setReady] = useState(false);
  const page = location.pathname.replace(/\/+$/, "") || "/";

  useEffect(() => setReady(true), []);

  if (!ready) return <GlobalLoader />;
  const isAdmin = page === "/admin";
  const isBooking = page === "/book";
  const isAccount = page === "/account";
  const isPublicPage = page === "/" || isAccount;
  const content = isAdmin
    ? <Admin />
    : isBooking
      ? <Book />
      : isAccount
        ? <Customer />
        : page === "/"
          ? <Home />
          : <main className="bookpage">
              <section className="form">
                <h1>Page not found</h1>
                <p>The page you requested does not exist.</p>
                <a className="btn" href="/">BACK TO HOME</a>
              </section>
            </main>;

  return (
    <>
      {content}
      {isPublicPage && <OffersPopup />}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
