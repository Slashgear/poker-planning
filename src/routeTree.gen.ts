import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { lazy } from "react";

// Lazy load pages for code splitting
const Home = lazy(() => import("./pages/Home"));
const Room = lazy(() => import("./pages/Room"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
