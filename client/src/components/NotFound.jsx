import { navigate, ROUTES } from '../utils/router';

export default function NotFound() {
  return (
    <main className="nf">
      <div>
        <div className="nf-no" aria-hidden="true">404</div>
        <p className="m-label">Signal unavailable</p>
        <h1>Page not found.</h1>
        <p>The address does not map to an intelligence view.</p>
        <div className="nf-actions">
          <button type="button" className="btn btn-acc" onClick={() => navigate(ROUTES.HOME)}>
            Go home
          </button>
          <button type="button" className="btn" onClick={() => navigate(ROUTES.NEWS)}>
            Open intelligence
          </button>
        </div>
      </div>
    </main>
  );
}
