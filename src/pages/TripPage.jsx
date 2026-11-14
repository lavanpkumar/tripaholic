import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";

const choices = [
  { to: "/trip/flights", icon: "/assets/flights.svg", label: "Travel" },
  { to: "/trip/lodging", icon: "/assets/lodging.svg", label: "Lodging" },
  { to: "/trip/itinerary", icon: "/assets/itinerary.svg", label: "Itinerary" },
];

export default function TripPage() {
  return (
    <Screen>
      <section className="hero">
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Your trip</h1>
        <p className="lede">Good plans. Great memories.</p>
      </section>
      <div className="choices">
        {choices.map((choice) => (
          <Link className="choice" to={choice.to} key={choice.label}>
            <span className="choice-icon">
              <img src={choice.icon} alt="" />
            </span>
            {choice.label}
          </Link>
        ))}
      </div>
    </Screen>
  );
}
