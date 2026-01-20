import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type { Stroke } from '../shared/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const httpServer = createServer(app);

// --- Static File Serving Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PATH CORRECTION:
 * In production, this file is located at 'dist/server/index.js'.
 * To reach the project root, we must go UP two levels (../../).
 */
const clientDistPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../../client/dist')
  : path.join(__dirname, '../client/dist');

// Serve the static files from the React app
app.use(express.static(clientDistPath));

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://collaborative-draw-q2f9.onrender.com' 
      : 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

let allStrokes: Stroke[] = [];

const activeStrokes = new Map<string, Stroke>();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('load-history', allStrokes);

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

  socket.on('stroke-update', (data: { strokeId: string; point: any }) => {
    const stroke = activeStrokes.get(data.strokeId);
    if (stroke) {
      stroke.points.push(data.point);
    }
    socket.broadcast.emit('stroke-update', data);
  });

  socket.on('stroke-end', (strokeId: string) => {
    const finishedStroke = activeStrokes.get(strokeId);
    if (finishedStroke) {
      allStrokes.push(finishedStroke);
      activeStrokes.delete(strokeId);
    }
    socket.broadcast.emit('stroke-end', strokeId);
  });

  socket.on('undo-stroke', (strokeId: string) => {
    allStrokes = allStrokes.filter(s => s.id !== strokeId);
    io.emit('stroke-removed', strokeId);
  });

  socket.on('mouse-move', (data: { userId: string; point: any; color: string }) => {
    socket.broadcast.emit('user-moved', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('user-disconnected', socket.id);
  });
});

/**
 * CATCH-ALL ROUTE:
 * Must use the corrected clientDistPath to locate index.html
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});