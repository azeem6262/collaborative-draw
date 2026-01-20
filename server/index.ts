import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Stroke } from '../shared/types.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// The "Truth": Completed strokes sent to all new users
let allStrokes: Stroke[] = [];

// Temporary storage for strokes currently being drawn
const activeStrokes = new Map<string, Stroke>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. Send existing history to the newcomer
  socket.emit('load-history', allStrokes);

  // 2. Start of a new real-time stroke
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

  // 3. Middle of a stroke (receiving new points)
  socket.on('stroke-update', (data: { strokeId: string; point: any }) => {
    const stroke = activeStrokes.get(data.strokeId);
    if (stroke) {
      stroke.points.push(data.point);
    }
    socket.broadcast.emit('stroke-update', data);
  });

  // 4. Completion of a stroke (moving from active to permanent)
  socket.on('stroke-end', (strokeId: string) => {
    const finishedStroke = activeStrokes.get(strokeId);
    if (finishedStroke) {
      allStrokes.push(finishedStroke);
      activeStrokes.delete(strokeId);
    }
    socket.broadcast.emit('stroke-end', strokeId);
  });

  // 5. Global Undo logic
  socket.on('undo-stroke', (strokeId: string) => {
    allStrokes = allStrokes.filter(s => s.id !== strokeId);
    // Use io.emit so EVERYONE (including the sender) updates their state
    io.emit('stroke-removed', strokeId);
  });

  // 6. Presence: Mouse movement broadcasting
  socket.on('mouse-move', (data: { userId: string; point: any; color: string }) => {
    socket.broadcast.emit('user-moved', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Tell everyone to remove this user's cursor
    io.emit('user-disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});