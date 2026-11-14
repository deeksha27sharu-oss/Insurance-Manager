import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { isAuthenticated, role } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    if (!token || !isAuthenticated) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (socketRef.current) return;

    const SOCKET_URL =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5000"
        : window.location.origin;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("WebSocket Connected:", newSocket.id, "as", role);
      setIsConnected(true);
    });
    newSocket.on("disconnect", (reason) => {
      console.log("WebSocket Disconnected:", reason);
      setIsConnected(false);
    });
    newSocket.on("connect_error", (err) => {
      console.error("Socket Connect Error:", err.message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, role]);

  useEffect(() => {
    const onToken = () => {
      const token = sessionStorage.getItem("token");
      const s = socketRef.current;
      if (!s || !token) return;
      if (s.auth?.token === token) return;
      s.auth = { token };
      s.disconnect().connect();
    };
    window.addEventListener("auth:token-refreshed", onToken);
    return () => window.removeEventListener("auth:token-refreshed", onToken);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}