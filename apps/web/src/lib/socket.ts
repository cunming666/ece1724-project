import { io } from "socket.io-client";
import { API_BASE_URL } from "./api";

export const socket = io(API_BASE_URL, {
  autoConnect: false,
  withCredentials: true,
});
