import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

const planned = [
  { month: "FEB", day: "08", name: "Bali, Indonesia", dates: "8–15 Feb 2027", detail: "8 days" },
  { month: "APR", day: "21", name: "Palawan, Philippines", dates: "21–26 Apr 2027", detail: "6 days" },
];

export default function TripsPage() {
  return (
    <Screen>
      <section className="hero">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>My trips</h1>
        <p className="lede">Good plans. Great memories.</p>
        <Link className="plan-btn" to="/trip">
          <img src="/assets/plus.svg" alt="" />
          Plan a trip
        </Link>
      </section>

      <div className="columns">
        <section className="column">
          <header className="section-head">
            <h2>Planned Trips</h2>
            <span className="count">2</span>
          </header>
          <div className="stack">
            {planned.map((trip) => (
              <Link className="trip-card" to="/trip" key={trip.name}>
                <div className="date-chip">
                  <span>{trip.month}</span>
                  <strong>{trip.day}</strong>
                </div>
                <div className="trip-copy">
                  <h3>{trip.name}</h3>
                  <p>{trip.dates}</p>
                  <p className="sub">{trip.detail}</p>
                </div>
                <img className="chevron" src="/assets/chevron.svg" alt="" />
              </Link>
            ))}
          </div>
        </section>

        <section className="column">
          <header className="section-head">
            <h2>In-progress Trips</h2>
            <span className="count">1</span>
          </header>
          <Link className="live-card" to="/trip">
            <img className="live-dot" src="/assets/live-dot.svg" alt="" />
            <p className="live-kicker">HAPPENING NOW</p>
            <h3>South coast, Sri Lanka</h3>
            <p className="live-dates">12–18 Nov 2026</p>
            <p className="live-day">Day 3 of 7</p>
            <span className="live-view">View trip</span>
            <img className="live-arrow" src="/assets/arrow.svg" alt="" />
            <div className="track">
              <div className="fill" />
            </div>
          </Link>
          <p className="column-note">Trips move here automatically on their start date.</p>
        </section>

        <section className="column">
          <header className="section-head">
            <h2>Archived Trips</h2>
            <span className="count">1</span>
          </header>
          <Link className="trip-card archived" to="/trip">
            <div className="archive-mark">
              <img src="/assets/sunset.svg" alt="" />
            </div>
            <div className="trip-copy">
              <h3>Langkawi, Malaysia</h3>
              <p className="archive-dates">10–14 Aug 2026&nbsp;&nbsp;·&nbsp;&nbsp;5 days</p>
              <p className="sub">A little sunshine, saved.</p>
            </div>
            <img className="chevron" src="/assets/chevron.svg" alt="" />
          </Link>
        </section>
      </div>
    </Screen>
  );
}
