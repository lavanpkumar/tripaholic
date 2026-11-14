import { Route, Routes } from "react-router-dom";
import TripsPage from "./pages/TripsPage.jsx";
import TripPage from "./pages/TripPage.jsx";
import FlightsPage from "./pages/FlightsPage.jsx";
import LodgingPage from "./pages/LodgingPage.jsx";
import ItineraryPage from "./pages/ItineraryPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TripsPage />} />
      <Route path="/trip" element={<TripPage />} />
      <Route path="/trip/flights" element={<FlightsPage />} />
      <Route path="/trip/lodging" element={<LodgingPage />} />
      <Route path="/trip/itinerary" element={<ItineraryPage />} />
    </Routes>
  );
}
