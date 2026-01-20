import { io } from "socket.io-client";


const isProd = import.meta.env.PROD;


const SOCKET_URL = isProd 
    ? 'https://your-app-name.onrender.com' 
    : 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
    autoConnect: true,
});