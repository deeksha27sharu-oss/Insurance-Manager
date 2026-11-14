import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";

export function useSocketEvent(eventName, callback) {
  const { socket } = useSocket();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket) return;
    
    const handler = (data) => {
      if (callbackRef.current) {
        callbackRef.current(data);
      }
    };
    
    socket.on(eventName, handler);
    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, eventName]); 
}