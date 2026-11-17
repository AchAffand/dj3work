import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { AppServicesProvider } from "./AppServices";
import { AppShell } from "./AppShell";
import { AppRoutes } from "./routes";
import { ToastProvider } from "./ToastProvider";

export function App() {
  return (
    <AuthProvider>
      <AppServicesProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
          <ProtectedRoute>
            <ToastProvider><AppShell><AppRoutes /></AppShell></ToastProvider>
          </ProtectedRoute>
        </BrowserRouter>
      </AppServicesProvider>
    </AuthProvider>
  );
}
