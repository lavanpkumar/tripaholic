import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

const flights = [
  {
    badge: "AI TOP PICK",
    tone: "green",
    airline: "Singapore Airlines",
    bag: "25 kg checked bag included",
    reason: "Best balance of price and comfort",
    price: "$328",
    legs: [
      ["08 FEB", "08:20", "SIN", "2h 50m · Nonstop", "11:10", "DPS"],
      ["15 FEB", "13:00", "DPS", "2h 50m · Nonstop", "15:50", "SIN"],
    ],
  },
  {
    badge: "NONSTOP ALTERNATIVE",
    tone: "green",
    airline: "Garuda Indonesia",
    bag: "20 kg checked bag included",
    reason: "Later departure, easy travel days",
    price: "$352",
    legs: [
      ["08 FEB", "10:00", "SIN", "2h 50m · Nonstop", "12:50", "DPS"],
      ["15 FEB", "16:00", "DPS", "2h 50m · Nonstop", "18:50", "SIN"],
    ],
  },
  {
    badge: "LOWEST FARE",
    tone: "gold",
    airline: "AirAsia",
    bag: "7 kg cabin bag · Checked bag extra",
    reason: "Lower price, longer journey",
    price: "$276",
    legs: [
      ["08 FEB", "07:00", "SIN", "6h 20m · 1 stop", "13:20", "DPS"],
      ["15 FEB", "14:10", "DPS", "6h 50m · 1 stop", "21:00", "SIN"],
    ],
  },
];

export default function FlightsPage() {
  return (
    <Screen tall>
      <section className="detail-hero flights-hero">
        <Link className="crumb" to="/trip">
          <img src="/assets/back.svg" alt="" />
          Your trip / Flights
        </Link>
        <h1>Find your way to Bali</h1>
        <p className="lede">A smarter search. A smoother start to your trip.</p>
        <div className="date-pill">
          <img src="/assets/calendar.svg" alt="" />
          Bali · 8–15 Feb 2027
        </div>
      </section>

      <form className="search-row flights-search" onSubmit={(event) => event.preventDefault()}>
        <label className="field from">
          <span>FROM</span>
          <strong>Singapore (SIN)</strong>
        </label>
        <label className="field to">
          <span>TO</span>
          <strong>Bali / Denpasar (DPS)</strong>
        </label>
        <label className="field depart">
          <span>DEPARTURE — RETURN</span>
          <strong>8 Feb – 15 Feb 2027</strong>
        </label>
        <label className="field travelers">
          <span>TRAVELERS & CABIN</span>
          <strong>1 adult · Economy</strong>
        </label>
        <button className="search-ai flights-ai" type="button">
          <img src="/assets/sparkle-white.svg" alt="" />
          Search with AI
        </button>
      </form>

      <section className="results">
        <h2>Recommended flights</h2>
        <p className="results-meta">3 options · Best match first</p>
        {flights.map((flight) => (
          <article className="option-card" key={flight.airline}>
            <p className={`option-badge ${flight.tone}`}>{flight.badge}</p>
            <h3>{flight.airline}</h3>
            <p className="option-line">Economy · Round trip</p>
            <p className="option-bag">{flight.bag}</p>
            <p className="option-reason">{flight.reason}</p>
            {flight.legs.map((leg, index) => (
              <div className={index === 0 ? "leg out" : "leg back"} key={leg[0] + leg[1]}>
                <span className="leg-date">{leg[0]}</span>
                <span className="leg-time">{leg[1]}</span>
                <span className="leg-code from-code">{leg[2]}</span>
                <span className="leg-duration">{leg[3]}</span>
                <span className="leg-path" />
                <span className="leg-time arrive">{leg[4]}</span>
                <span className="leg-code to-code">{leg[5]}</span>
              </div>
            ))}
            <div className="fare-rule" />
            <p className="fare">{flight.price}</p>
            <p className="fare-note">per adult</p>
            <p className="fare-action">Select flight</p>
            <img className="radio" src="/assets/radio.svg" alt="" />
          </article>
        ))}
      </section>

      <aside className="assistant">
        <p className="assistant-label">YOUR TRAVEL ASSISTANT</p>
        <div className="assistant-card">
          <img className="assistant-spark" src="/assets/sparkle.svg" alt="" />
          <h2>Why this flight?</h2>
          <p className="assistant-lead">Singapore Airlines is my top pick.</p>
          <p className="assistant-body">
            Nonstop both ways, a morning arrival in Bali, and a checked bag—at a lower fare than the
            other nonstop option.
          </p>
          <div className="ask">
            <span>Ask AI for a different flight…</span>
            <img src="/assets/send.svg" alt="" />
          </div>
        </div>
        <div className="empty-card">
          <img src="/assets/choose-flight.svg" alt="" />
          <h3>Choose your flight</h3>
          <p>
            Select an option to see your trip summary
            <br />
            and reveal the booking button.
          </p>
        </div>
      </aside>

      <footer className="disclaimer">
        <p>Example fares & schedules · USD · Round-trip prices for 1 adult, including taxes · All times local</p>
        <p>Review fare rules before booking</p>
      </footer>
    </Screen>
  );
}
