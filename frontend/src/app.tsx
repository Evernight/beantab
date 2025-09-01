import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { router } from "./router";

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

const storedThemeSetting = document.documentElement.style.colorScheme;
const isDarkMode =
    storedThemeSetting == "dark" ||
    (window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches &&
        storedThemeSetting != "light");

const theme = createTheme({
    cssVariables: true,
    palette: {
        mode: isDarkMode ? "dark" : "light",
    },
    typography: {
        fontFamily: "", // use default Fava font instead of MUI font
    },
});

export function renderApp(container: Element) {
    const root = createRoot(container);
    root.render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
