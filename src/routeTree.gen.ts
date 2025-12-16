import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import Home from "./pages/Home";
import Room from "./pages/Room";
import NotFound from "./pages/NotFound";

// Root route
const rootRoute = createRootRoute({
  notFoundComponent: NotFound,
});

// Home route
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

// Room route
const roomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/room/$code",
  component: Room,
});

// Route tree
const routeTree = rootRoute.addChildren([indexRoute, roomRoute]);

// Router
export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound,
});

// Type declaration
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
