import { Outlet, createRootRoute } from "@tanstack/react-router";

export const RootRoute = createRootRoute({
    component: Layout,
});

function Layout() {
    return <Outlet />;
}
