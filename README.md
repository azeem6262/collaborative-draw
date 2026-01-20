# Real-Time Collaborative Drawing Canvas

A multi-user drawing application allowing simultaneous collaboration with global undo/redo functionality and live user indicators.

## Setup Instructions

1. **Clone the repository** and navigate to the project root.
2. **Install Dependencies:**
   ```bash
   # From the root directory
   cd server && npm install
   cd ../client && npm install
Start the Server:

Bash
cd server
npm run dev
Start the Client:

Bash
cd client
npm run dev
The app will be available at http://localhost:5173.

How to Test with Multiple Users
Open http://localhost:5173 in your primary browser.

Open the same URL in an Incognito Window or a different browser (Firefox/Safari).

Draw in one window; you will see the stroke appear in real-time in the other.

Move your mouse in one window; a colored cursor with a unique ID will appear in the other.

Click Undo to see the last stroke created by that specific user disappear from all screens.

Known Limitations/Bugs
Redraw on Undo: For very large sessions (10,000+ strokes), the canvas clear-and-redraw strategy during an Undo event may cause a slight frame drop.

Touch Support: Primary focus was on mouse events; mobile touch-move events are not yet fully optimized for pressure sensitivity.

Time Spent
Total Time: ~8-10 hours

Breakdown: 3h (Canvas Engine & Normalization), 3h (Socket Protocol & Real-time streaming), 2h (Global Undo & UI), 1h (Documentation).