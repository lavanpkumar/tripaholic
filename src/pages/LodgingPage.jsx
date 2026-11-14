import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

const stays = [
  {
    photo: "/assets/palm-grove.png",
    badge: "AI TOP PICK · BOUTIQUE HOTEL",
    tone: "green",
    name: "Palm Grove Retreat",
    place: "Ubud · 1.2 km from the centre",
    perks: "Pool · Breakfast included · Free Wi-Fi",
    rating: "★ 4.9 (128)",
    price: "$118",
    total: "$826 total · 7 nights",
  },
  {
    photo: "/assets/sora-villa.png",
    badge: "AIRBNB-STYLE · ENTIRE VILLA",
    tone: "green",
    name: "Sora Private Pool Villa",
    place: "Sanur · Entire home · 1 bedroom",
    perks: "Private pool · Kitchen · Free Wi-Fi",
    rating: "★ 4.8 (86)",
    price: "$156",
    total: "$1,092 total · 7 nights",
  },
  {
    photo: "/assets/banyan.png",
    badge: "BEST VALUE · GUESTHOUSE",
    tone: "gold",
    name: "Banyan Garden Guesthouse",
    place: "Ubud · 2.4 km from the centre",
    perks: "Garden · Air conditioning · Free Wi-Fi",
    rating: "★ 4.7 (94)",
    price: "$72",
    total: "$504 total · 7 nights",
  },
];

export default function LodgingPage() {
  return (
    <Screen tall>
      <section className="detail-hero flights-hero">
        <Link className="crumb" to="/trip">
          <img src="/assets/back.svg" alt="" />
          Your trip / Lodging
        </Link>
        <h1>Find your stay in Bali</h1>
        <p className="lede">Hotels, villas, and a little room to unwind.</p>
        <div className="date-pill">
          <img src="/assets/calendar.svg" alt="" />
          Bali · 8–15 Feb 2027
        </div>
      </section>

      <form className="search-row lodging-search" onSubmit={(event) => event.preventDefault()}>
        <label className="field stay-dest">
          <span>DESTINATION</span>
          <strong>Bali, Indonesia</strong>
        </label>
        <label className="field stay-in">
          <span>CHECK-IN</span>
          <strong>8 Feb 2027</strong>
        </label>
        <label className="field stay-out">
          <span>CHECK-OUT</span>
          <strong>15 Feb 2027</strong>
        </label>
        <label className="field stay-guests">
          <span>GUESTS & ROOMS</span>
          <strong>1 adult · 1 room</strong>
        </label>
        <button className="search-ai stay-ai" type="button">
          <img src="/assets/sparkle-white.svg" alt="" />
          Search with AI
        </button>
      </form>

      <section className="results">
        <h2>Recommended stays</h2>
        <p className="results-meta stays-meta">3 stays · Best match first</p>
        {stays.map((stay) => (
          <article className="option-card stay-card" key={stay.name}>
            <img className="stay-photo" src={stay.photo} alt="" />
            <p className={`stay-badge ${stay.tone}`}>{stay.badge}</p>
            <h3 className="stay-name">{stay.name}</h3>
            <p className="stay-place">{stay.place}</p>
            <p className="stay-perks">{stay.perks}</p>
            <p className="stay-cancel">Free cancellation until 1 Feb</p>
            <p className="stay-rating">{stay.rating}</p>
            <div className="fare-rule" />
            <p className="stay-price">{stay.price}</p>
            <p className="stay-night">/ night</p>
            <p className="stay-total">{stay.total}</p>
            <p className="stay-action">Select stay</p>
            <img className="stay-radio" src="/assets/radio.svg" alt="" />
          </article>
        ))}
      </section>

      <aside className="assistant">
        <p className="assistant-label">YOUR TRAVEL ASSISTANT</p>
        <div className="assistant-card">
          <img className="assistant-spark" src="/assets/sparkle.svg" alt="" />
          <h2>Why this stay?</h2>
          <p className="assistant-lead">Palm Grove Retreat is my top pick.</p>
          <p className="assistant-body">
            Breakfast, a pool, and a central Ubud location for $118 a night. Less than the private villa,
            with more included than the budget guesthouse.
          </p>
          <div className="ask">
            <span>Ask AI for a different kind of stay…</span>
            <img src="/assets/send.svg" alt="" />
          </div>
        </div>
        <div className="empty-card stay-empty">
          <img src="/assets/choose-stay.svg" alt="" />
          <h3>Choose your stay</h3>
          <p>
            Select a hotel or entire home to see
            <br />
            your total and reveal the booking button.
          </p>
        </div>
      </aside>

      <footer className="disclaimer">
        <p>Example properties, ratings & prices · Illustrative photos · USD · 7-night totals include taxes & fees</p>
        <p>Review stay policies before booking</p>
      </footer>
    </Screen>
  );
}
