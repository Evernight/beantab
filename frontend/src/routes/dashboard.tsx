import { createRoute } from "@tanstack/react-router";
import Dashboard from "../components/Dashboard";
import { RootRoute } from "./__root";

export const DashboardRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/",
    component: Dashboard,
});
