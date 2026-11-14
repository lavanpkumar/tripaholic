import { Link } from "react-router-dom";

export default function Screen({ tall = false, children }) {
  return (
    <div className={tall ? "screen tall" : "screen"}>
      <div className="scene" aria-hidden="true">
        <img className="palm-right" src="/assets/right-palm.svg" alt="" />
        <img className="fronds-left" src="/assets/left-fronds.svg" alt="" />
        <img className="palm-island" src="/assets/island-palm.svg" alt="" />
        <img className="boarder" src="/assets/paddleboarder.svg" alt="" />
        <img className="ripples" src="/assets/sea-ripples.svg" alt="" />
      </div>
      <header className="topbar">
        <Link className="brand" to="/">
          <img src="/assets/compass.svg" alt="" />
          <span>Tripaholic</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link className="nav-trips" to="/">
            <img src="/assets/trips.svg" alt="" />
            Trips
          </Link>
          <span className="nav-profile">
            <img src="/assets/profile.svg" alt="" />
            Profile
          </span>
        </nav>
        <p className="edition">A LITTLE FURTHER.</p>
        <div className="divider" />
      </header>
      {children}
    </div>
  );
}
