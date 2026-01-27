import { LocationProvider, Router, Route, lazy, ErrorBoundary } from "preact-iso";

const Home = lazy(() => import("./pages/Home"));
const Room = lazy(() => import("./pages/Room"));
const NotFound = lazy(() => import("./pages/NotFound"));

export function App() {
  return (
    <LocationProvider>
      <ErrorBoundary onError={(e) => console.error(e)}>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/room/:code" component={Room} />
          <Route default component={NotFound} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
