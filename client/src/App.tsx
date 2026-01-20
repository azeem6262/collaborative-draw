import { useState, useEffect } from 'react'
import './App.css'
import Canvas from './components/Canvas'
import { socket } from './socket'

interface Cursor {
  x: number;
  y: number;
  color: string;
}

function App() {
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(5)
  // State to track other users' cursors
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})

  useEffect(() => {
    // 1. Listen for other users moving their mouse
    socket.on('user-moved', (data: { userId: string; point: { x: number, y: number }; color: string }) => {
      setCursors((prev) => ({
        ...prev,
        [data.userId]: {
          x: data.point.x,
          y: data.point.y,
          color: data.color,
        },
      }));
    });

    // 2. Listen for users leaving to remove their cursor
    socket.on('user-disconnected', (userId: string) => {
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
    });

    return () => {
      socket.off('user-moved');
      socket.off('user-disconnected');
    };
  }, []);

  return (
    <div className="app-container" style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Canvas color={color} brushSize={brushSize} />

      {/* 3. Render Remote Cursors */}
      {Object.entries(cursors).map(([id, cursor]) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: `${cursor.x * 100}%`,
            top: `${cursor.y * 100}%`,
            width: '15px',
            height: '15px',
            backgroundColor: cursor.color,
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            pointerEvents: 'none', // Critical: ensures cursors don't block drawing
            zIndex: 100,
            transition: 'all 0.1s linear',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            transform: 'rotate(45deg)',
            whiteSpace: 'nowrap'
          }}>
            User {id.slice(4, 8)}
          </div>
        </div>
      ))}

      <div className="toolbar">
        <label className="toolbar-item">
          <span>Color:</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <label className="toolbar-item">
          <span>Brush Size: {brushSize}px</span>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  )
}

export default App