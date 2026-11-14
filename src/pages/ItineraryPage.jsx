import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

const days = [
  { dow: "MON", date: "8" },
  { dow: "TUE", date: "9" },
  { dow: "WED", date: "10" },
  { dow: "THU", date: "11" },
  { dow: "FRI", date: "12" },
  { dow: "SAT", date: "13", weekend: true },
  { dow: "SUN", date: "14", weekend: true },
  { dow: "MON", date: "15" },
];

const hours = [
  { label: "08:00", top: 68 },
  { label: "10:00", top: 148 },
  { label: "12:00", top: 228 },
  { label: "14:00", top: 308 },
  { label: "16:00", top: 388 },
  { label: "18:00", top: 468 },
  { label: "20:00", top: 528 },
];

const lines = [63, 103, 143, 183, 223, 263, 303, 343, 383, 423, 463, 503, 543];

const events = [
  { name: "Hotel check-in", time: "13:00–15:00", left: 59, top: 265, height: 76, bg: "#eee7f7", fg: "#675083" },
  { name: "Welcome dinner", time: "18:00–20:00", left: 59, top: 465, height: 76, bg: "#f8ecd9", fg: "#785a29" },
  { name: "Tegallalang rice terraces", time: "09:00–11:00", left: 177, top: 105, height: 76, bg: "#e2efe6", fg: "#295f46", selected: true },
  { name: "Ubud art market", time: "14:00–16:00", left: 177, top: 305, height: 76, bg: "#e4eef6", fg: "#355d7e" },
  { name: "Tirta Empul temple", time: "10:00–12:00", left: 295, top: 145, height: 76, bg: "#e4eef6", fg: "#355d7e" },
  { name: "Balinese cooking class", time: "16:00–18:00", left: 295, top: 385, height: 76, bg: "#f8ecd9", fg: "#785a29" },
  { name: "Transfer to Sanur", time: "09:00–11:00", left: 413, top: 105, height: 76, bg: "#eee7f7", fg: "#675083" },
  { name: "Sanur beach walk", time: "15:00–17:00", left: 413, top: 345, height: 76, bg: "#e2efe6", fg: "#295f46" },
  { name: "Snorkeling at Blue Lagoon", time: "09:00–12:00", left: 531, top: 105, height: 116, bg: "#e2efe6", fg: "#295f46" },
  { name: "Sunset by the sea", time: "17:00–19:00", left: 531, top: 425, height: 76, bg: "#f8ecd9", fg: "#785a29" },
  { name: "Uluwatu temple & coast", time: "10:00–13:00", left: 649, top: 145, height: 116, bg: "#e4eef6", fg: "#355d7e" },
  { name: "Jimbaran seafood", time: "17:00–19:00", left: 649, top: 425, height: 76, bg: "#f8ecd9", fg: "#785a29" },
  { name: "A slow beach morning", time: "10:00–12:00", left: 767, top: 145, height: 76, bg: "#e2efe6", fg: "#295f46" },
  { name: "Local shops & keepsakes", time: "15:00–17:00", left: 767, top: 345, height: 76, bg: "#e4eef6", fg: "#355d7e" },
  { name: "One last Bali breakfast", time: "09:00–11:00", left: 885, top: 105, height: 76, bg: "#f8ecd9", fg: "#785a29" },
  { name: "Airport transfer", time: "14:00–16:00", left: 885, top: 305, height: 76, bg: "#eee7f7", fg: "#675083" },
];

export default function ItineraryPage() {
  return (
    <Screen tall>
      <section className="detail-hero itinerary-hero">
        <Link className="crumb" to="/trip">
          <img src="/assets/back.svg" alt="" />
          Your trip / Itinerary
        </Link>
        <h1>Bali, Indonesia</h1>
        <p className="lede">8–15 February 2027&nbsp;&nbsp;·&nbsp;&nbsp;8 days&nbsp;&nbsp;·&nbsp;&nbsp;Local time (GMT+8)</p>
        <button className="regen" type="button">
          <img src="/assets/sparkle-regen.svg" alt="" />
          Regenerate with AI
        </button>
        <button className="create-event" type="button">
          <img src="/assets/add-event.svg" alt="" />
          Create event
        </button>
      </section>

      <div className="toolbar">
        <h2>Itinerary</h2>
        <span className="plan-badge">AI-suggested plan</span>
        <span className="legend nature">Nature</span>
        <span className="legend culture">Culture</span>
        <span className="legend food">Food & leisure</span>
        <span className="legend yours">Your events</span>
        <div className="view-select">
          <span>Full trip</span>
          <img src="/assets/dropdown.svg" alt="" />
        </div>
        <p>YOUR TRAVEL ASSISTANT</p>
      </div>

      <div className="calendar">
        <div className="cal-head" />
        {days.map((day, index) => (
          <div
            className={day.weekend ? "day weekend" : "day"}
            style={{ left: 55 + index * 118 }}
            key={`${day.dow}-${day.date}`}
          >
            <span>{day.dow}</span>
            <strong>{day.date}</strong>
          </div>
        ))}
        {days.map((day, index) => (
          <div className="day-line" style={{ left: 55 + index * 118 }} key={`line-${day.date}-${index}`} />
        ))}
        <p className="gmt">GMT+8</p>
        {lines.map((top) => (
          <div className="hour-line" style={{ top }} key={top} />
        ))}
        {hours.map((hour) => (
          <p className="hour" style={{ top: hour.top }} key={hour.label}>
            {hour.label}
          </p>
        ))}
        {events.map((event) => (
          <div
            className={event.selected ? "event selected" : "event"}
            key={event.name}
            style={{ left: event.left, top: event.top, height: event.height, background: event.bg, color: event.fg }}
          >
            <span className="accent" style={{ background: event.fg, height: event.height - 14 }} />
            <p className="when">{event.time}</p>
            <p className="name">{event.name}</p>
          </div>
        ))}
      </div>

      <aside className="plan-side">
        <div className="why-plan">
          <img src="/assets/sparkle-plan.svg" alt="" />
          <h2>Why this plan</h2>
          <p className="why-count">13 AI suggestions · 3 personal events</p>
          <h3>Less travel, more exploring</h3>
          <p>Ubud sights come first, followed by the coast, grouping nearby places together.</p>
          <h3 className="second">A little of everything</h3>
          <p>Temples, local food and ocean time, with breathing room between activities.</p>
          <div className="ask plan-ask">
            <span>Ask AI to adjust this plan…</span>
            <img src="/assets/send-plan.svg" alt="" />
          </div>
        </div>
        <div className="selected-event">
          <p className="selected-label">SELECTED EVENT</p>
          <img className="edit" src="/assets/edit.svg" alt="" />
          <h3>
            Tegallalang
            <br />
            rice terraces
          </h3>
          <p className="selected-date">Tuesday, 9 February 2027</p>
          <p className="selected-time">09:00–11:00 · Bali local time</p>
          <p className="selected-kind">Nature · AI suggestion</p>
          <button className="move" type="button">
            <img src="/assets/move.svg" alt="" />
            Move
          </button>
          <button className="delete" type="button">
            <img src="/assets/delete.svg" alt="" />
            Delete
          </button>
        </div>
      </aside>

      <footer className="guidance">
        <img src="/assets/drag.svg" alt="" />
        <p>Drag events to reschedule · Select an event to edit or delete · Click an empty slot to add your own</p>
        <p className="guidance-note">Suggestions only · Nothing booked</p>
      </footer>
    </Screen>
  );
}
