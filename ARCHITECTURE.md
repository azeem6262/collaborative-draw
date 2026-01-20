## ARCHITECTURE.md

### 1. Data Flow Diagram
Drawing events follow a "Capture -> Normalize -> Broadcast -> Reify" loop:
1. **Input:** User interacts with the `Draft Canvas`.
2. **Normalize:** Coordinates are converted from absolute pixels to a `0.0 - 1.0` range.
3. **Emit:** Points are streamed via WebSockets to the Node.js server.
4. **Relay:** Server broadcasts the event to all other connected clients.
5. **Render:** Clients receive the data, denormalize it based on their local screen size, and render it to their `Draft Canvas` (active) or `Main Canvas` (completed).



### 2. WebSocket Protocol
| Event | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `stroke-start` | Client -> Server | `{ strokeId, userId, color, lineWidth, point }` | Initializes a new stroke. |
| `stroke-update`| Client -> Server | `{ strokeId, point }` | Streams individual points as the mouse moves. |
| `stroke-end`  | Client -> Server | `{ strokeId }` | Finalizes the stroke and saves it to history. |
| `undo-stroke`  | Client -> Server | `{ strokeId }` | Requests the removal of a specific stroke. |
| `mouse-move`   | Client -> Server | `{ userId, point, color }` | Updates presence indicators (cursors). |

### 3. Undo/Redo Strategy
We utilize a **Global Authority** model.
* **Server as Source of Truth:** The server maintains an `allStrokes` array.
* **Targeted Removal:** When a user triggers "Undo," the client identifies the `ID` of their last stroke and sends it to the server.
* **State Synchronization:** The server removes the stroke and emits a `stroke-removed` event to all clients.
* **Idempotent Redraw:** Every client filters their local state and performs a full canvas redraw to ensure consistency.

### 4. Performance Decisions
* **Dual-Canvas Layering:** We use two `<canvas>` elements. The `Main` layer holds the static background, while the `Draft` layer handles high-frequency updates for active strokes.
* **Coordinate Normalization:** Storing points as percentages (0 to 1) allows for perfect synchronization across devices with different resolutions and aspect ratios.
* **DOM-based Cursors:** Other users' cursors are rendered as light-weight React components (DIVs) rather than drawn on the canvas, reducing the number of expensive canvas redraws.

### 5. Conflict Resolution
* **Additive Synchronization:** Since drawing is inherently additive, most operations do not conflict.
* **LIFO Ordering:** Strokes are stored in an array based on the time they reach the server. This ensures that even if two users draw in the same spot, the render order is identical for everyone.
* **Optimistic UI:** Local strokes are rendered instantly on the `Draft Canvas` to hide network latency.