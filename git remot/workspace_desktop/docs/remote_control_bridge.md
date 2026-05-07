# Remote Control Bridge for Mattermost Calls

This document describes how to bridge RTC signals from the Mattermost Calls Webapp to the Electron Desktop App to enable Remote Control functionality.

## Webapp Implementation (React/TypeScript)

The following snippet should be integrated into the Calls Webapp component that handles the screen share view.

### 1. Handling RTC Messages

When the Webapp receives an RTC message of type `9` (Remote Control Signal) or `10` (Remote Control Toggle), it should forward it to the Desktop App via the `desktopAPI`.

```typescript
// Example RTC message handler in the Webapp
transport.on('rpc', (message) => {
    if (message.type === 9) { // Remote Control Event
        if (window.desktopAPI && typeof window.desktopAPI.sendRemoteControlEvent === 'function') {
            // Forward the payload directly to the Desktop App
            window.desktopAPI.sendRemoteControlEvent(message.data);
        }
    }
});
```

### 2. Sending Events from the Controller

The user who is controlling the remote screen needs to capture mouse/keyboard events and send them via RTC.

```typescript
const videoRef = useRef<HTMLVideoElement>(null);

const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRemoteControlEnabled || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();

    // Calculate relative coordinates (0.0 to 1.0)
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Send via Mattermost Calls Signaling
    transport.sendRTCMessage({
        type: 9,
        data: {
            action: 'mousemove', // or 'move'
            x,
            y
        }
    });
};

const handleMouseDown = (e: React.MouseEvent) => {
    if (!isRemoteControlEnabled) return;

    transport.sendRTCMessage({
        type: 9,
        data: {
            action: 'mousedown',
            button: 'left' // support 'left', 'middle', 'right' or 0, 1, 2
        }
    });
};

// ... similar handlers for mouseup, wheel, keydown, keyup
```

## Desktop App Implementation (Electron)

The Desktop App exposes `window.desktopAPI.sendRemoteControlEvent(event)` which forwards the payload to the Main Process.

### Supported Payload Format:
The payload (`event`) can use either `type` or `action` to specify the event.

- **Mouse Events**: `action`: 'mousedown', 'mouseup', 'mousemove', 'click', 'move'.
  - Required for move: `x`, `y` (relative 0.0 to 1.0).
  - Required for click/down/up: `button` (0, 1, 2 or 'left', 'middle', 'right').
- **Keyboard Events**: `action`: 'keydown', 'keyup', 'key'.
  - Required: `key`, `code`.
  - Optional: `ctrlKey`, `shiftKey`, `altKey`, `metaKey`.
- **Scroll Events**: `action`: 'wheel', 'scroll'.
  - Required: `deltaX`, `deltaY`.
