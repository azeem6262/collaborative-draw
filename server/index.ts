import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Stroke } from '../shared/types.js';

const app = express();
const httpServer = createServer(app);


const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://your-frontend-app.onrender.com' 
      : 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});


let allStrokes: Stroke[] = [];

// Temporary storage for strokes currently in-progress
const activeStrokes = new Map<string, Stroke>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Sync history to the new user
  socket.emit('load-history', allStrokes);

  // 2. Real-time Stroke Start
  socket.on('stroke-start', (data: { strokeId: string; userId: string; color: string; lineWidth: number; point: any }) => {
    const newStroke: Stroke = {
      id: data.strokeId,
      userId: data.userId,
      color: data.color,
      lineWidth: data.lineWidth,
      points: [data.point]
    };
    activeStrokes.set(data.strokeId, newStroke);
    socket.broadcast.emit('stroke-start', data);
  });

  // 3. Real-time Point Update
  socket.on('stroke-update', (data: { strokeId: string; point: any }) => {
    const stroke = activeStrokes.get(data.strokeId);
    if (stroke) {
      stroke.points.push(data.point);
    }
    socket.broadcast.emit('stroke-update', data);
  });

  // 4. Stroke Completion (Commit to history)
  socket.on('stroke-end', (strokeId: string) => {
    const finishedStroke = activeStrokes.get(strokeId);
    if (finishedStroke) {
      allStrokes.push(finishedStroke);
      activeStrokes.delete(strokeId);
    }
    socket.broadcast.emit('stroke-end', strokeId);
  });

  // 5. Global Undo Logic
  socket.on('undo-stroke', (strokeId: string) => {
    allStrokes = allStrokes.filter(s => s.id !== strokeId);
    // Notify all clients to remove this specific stroke
    io.emit('stroke-removed', strokeId);
  });

  // 6. Presence: Mouse movement broadcasting
  socket.on('mouse-move', (data: { userId: string; point: any; color: string }) => {
    socket.broadcast.emit('user-moved', data);
  });

  // 7. Cleanup on Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Broadcast disconnect so others can remove this user's cursor
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});