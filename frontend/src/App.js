import { useLocation } from "react-router-dom";
import Navbar from "./components/common/Navbar.js";
import AppRoutes from "./routes/AppRoutes.js";
import { ROUTES } from "./routes/routePaths.js";
import { ChatPanelProvider } from "./context/ChatPanelContext.js";
import ChatPanel from "./components/common/ChatPanel.js";
import "./App.css";

export default function App() {
  const location = useLocation();
  const hideNavbar = 
    location.pathname === ROUTES.LOGIN ||
    location.pathname === ROUTES.SIGNUP;

  return (
    <ChatPanelProvider>
    <div className="app-container">
      {!hideNavbar && <Navbar />}
      <main className="app-main">
        <AppRoutes />
      </main>
      <ChatPanel />
    </div>
    </ChatPanelProvider>
  );
}