import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, setUnreadNotifications, setUnreadMessages } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const client = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    client.on('connect', () => setConnected(true));
    client.on('disconnect', () => setConnected(false));

    if (user?._id) {
      client.on('notification:new', (notif) => {
        setUnreadNotifications((c) => c + 1);
        if (notif?.type !== 'new_message') {
          toastRef.current?.info(notif.body, notif.title);
        }
      });

      client.on('conversation:updated', () => {
        setUnreadMessages((c) => c + 1);
      });
    }

    setSocket(client);

    return () => {
      client.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user?._id, setUnreadNotifications, setUnreadMessages]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext) || { socket: null, connected: false };
}

