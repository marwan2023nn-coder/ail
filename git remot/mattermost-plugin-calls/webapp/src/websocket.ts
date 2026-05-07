// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {encode} from '@msgpack/msgpack/dist';
import {EventEmitter} from 'events';

import {logDebug, logErr, logInfo, logWarn} from './log';
import {pluginId} from './manifest';

const wsMinReconnectRetryTimeMs = 1000; // 1 second
const wsReconnectionTimeout = 30000; // 30 seconds
const wsReconnectTimeIncrement = 500; // 0.5 seconds
const wsPingIntervalMs = 5000; // 5 seconds

export enum WebSocketErrorType {
    Native,
    Join,
    ReconnectTimeout,
}

export class WebSocketError extends Error {
    public type: WebSocketErrorType;

    constructor(type: WebSocketErrorType, message: string) {
        super(message);

        this.type = type;

        // needed since we are extending a built-in class
        Object.setPrototypeOf(this, WebSocketError.prototype);
    }
}

export class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private wsBackend: WebSocket | null = null;
    private readonly wsURL: string;
    private readonly authToken: string;
    private readonly backendPort: string;
    private seqNo = 1;
    private serverSeqNo = 0;
    private connID = '';
    private originalConnID = '';
    private eventPrefix: string = 'custom_' + pluginId;
    private lastDisconnect = 0;
    private reconnectRetryTime = wsMinReconnectRetryTimeMs;
    private closed = false;
    private isReconnect = false;
    public isDesktop = false;
    private remoteControlPermissionPending = false;
    private remoteControlPermissionGranted = false;
    private pingInterval: ReturnType<typeof setInterval> | null = null;
    private waitingForPong = false;
    private expectedPongSeqNo = 0;

    constructor(wsURL: string, authToken?: string, backendPort?: string) {
        super();
        this.wsURL = wsURL;
        this.authToken = authToken || '';
        this.backendPort = backendPort || '9999';
        this.init(false);
    }

    private init(isReconnect: boolean) {
        if (this.closed) {
            logWarn('client is closed!');
            return;
        }

        this.ws = new WebSocket(`${this.wsURL}?connection_id=${this.connID}&sequence_number=${this.serverSeqNo}`);

        // Only connect to Go backend if Desktop App API is not available
        const desktopAPI = window.desktopAPI as Record<string, unknown>;
        if (!desktopAPI?.sendRemoteControlEvent) {
            this.reconnectBackend();
        }

        this.ws.onopen = () => {
            if (this.authToken) {
                this.ws?.send(JSON.stringify({
                    action: 'authentication_challenge',
                    seq: this.seqNo++,
                    data: {token: this.authToken},
                }));
            }
            if (isReconnect) {
                logDebug('ws: reconnected', this.originalConnID, this.connID);
                this.lastDisconnect = 0;
                this.reconnectRetryTime = wsMinReconnectRetryTimeMs;
                this.emit('open', this.originalConnID, this.connID, true);
            }

            // Start ping interval
            this.startPingInterval();

            // Send initial ping.
            this.ping();
        };

        this.ws.onerror = () => {
            this.emit('error', new WebSocketError(WebSocketErrorType.Native, 'websocket error'));
        };

        this.ws.onclose = this.closeHandler;

        this.ws.onmessage = ({data}) => {
            if (!data) {
                return;
            }
            let msg;
            try {
                msg = JSON.parse(data);
            } catch (err) {
                logErr('ws msg parse error', err);
                return;
            }

            // Handle pong response
            if (this.waitingForPong && msg?.seq_reply === this.expectedPongSeqNo) {
                this.waitingForPong = false;
                this.expectedPongSeqNo = 0;
                return;
            }

            if (msg) {
                this.serverSeqNo = msg.seq + 1;
            }

            if (!msg || !msg.event || !msg.data) {
                return;
            }

            if (msg.event === 'hello') {
                if (msg.data.connection_id !== this.connID) {
                    logDebug('ws: new conn id from server', msg.data.connection_id);
                    this.connID = msg.data.connection_id;
                    this.serverSeqNo = 0;
                    this.seqNo = 1;
                    if (this.originalConnID === '') {
                        logDebug('ws: setting original conn id', this.connID);
                        this.originalConnID = this.connID;
                    }

                    this.emit('event', msg);
                }
                if (!isReconnect) {
                    this.emit('open', this.originalConnID, this.connID, false);
                }
                return;
            } else if (!this.connID) {
                logWarn('ws message received while waiting for hello');
                return;
            }

            if (msg.event !== this.eventPrefix + '_user_mouseEvent') {
                this.emit('event', msg);

                if (msg.data.connID !== this.connID && msg.data.connID !== this.originalConnID) {
                    return;
                }
            }

            if (msg.event === this.eventPrefix + '_user_mouseEvent') {
                if (msg.data.connID !== this.connID) {
                    const rawEvent = msg.data.mouse_event;

                    // Convert to Desktop App format (x/y ratios 0-1, standard event types)
                    const desktopEvent: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(rawEvent)) {
                        desktopEvent[key] = value;
                    }

                    // Convert posx/posy percentages (0-100) to x/y ratios (0-1)
                    if (typeof rawEvent.posx !== 'undefined' && rawEvent.posx !== '') {
                        const parsed = parseFloat(rawEvent.posx);
                        if (!isNaN(parsed)) {
                            desktopEvent.x = parsed / 100;
                        }
                        delete desktopEvent.posx;
                    }
                    if (typeof rawEvent.posy !== 'undefined' && rawEvent.posy !== '') {
                        const parsed = parseFloat(rawEvent.posy);
                        if (!isNaN(parsed)) {
                            desktopEvent.y = parsed / 100;
                        }
                        delete desktopEvent.posy;
                    }

                    // Map custom event types to standard types for Desktop App
                    if (rawEvent.type === 'rightclick') {
                        desktopEvent.type = 'click';
                        desktopEvent.button = 2;
                    } else if (rawEvent.type === 'longpress') {
                        desktopEvent.type = 'mousedown';
                        desktopEvent.button = 0;
                    } else if (rawEvent.type === 'release') {
                        desktopEvent.type = 'mouseup';
                        desktopEvent.button = 0;
                    } else if (rawEvent.type === 'wheel') {
                        // Map wheel up/down to deltaY
                        if (rawEvent.posx === 'up') {
                            desktopEvent.deltaY = -100;
                        } else if (rawEvent.posx === 'down') {
                            desktopEvent.deltaY = 100;
                        }
                        delete desktopEvent.posx;
                        delete desktopEvent.posy;
                    }

                    // Set default button for mouse events if not set
                    if (['mousemove', 'mousedown', 'mouseup', 'click'].includes(desktopEvent.type as string)) {
                        if (typeof desktopEvent.button === 'undefined') {
                            desktopEvent.button = 0;
                        }
                    }

                    // Remove unused fields
                    delete desktopEvent.targetId;

                    // For keyboard events, clean up mouse-specific fields
                    if (['keydown', 'keyup'].includes(desktopEvent.type as string)) {
                        delete desktopEvent.posx;
                        delete desktopEvent.posy;
                        delete desktopEvent.x;
                        delete desktopEvent.y;
                        delete desktopEvent.button;
                    }

                    const desktop = window.desktopAPI as Record<string, unknown>;
                    if (desktop?.sendRemoteControlEvent) {
                        // Request remote control permission if not yet granted
                        if (!this.remoteControlPermissionGranted && !this.remoteControlPermissionPending) {
                            this.remoteControlPermissionPending = true;
                            (desktop.requestRemoteControlPermission as () => Promise<boolean>)().then((granted: boolean) => {
                                this.remoteControlPermissionGranted = granted;
                                this.remoteControlPermissionPending = false;
                                if (granted) {
                                    (desktop.sendRemoteControlEvent as (ev: unknown) => void)(desktopEvent);
                                }
                            }).catch(() => {
                                this.remoteControlPermissionPending = false;
                            });
                        } else if (this.remoteControlPermissionGranted) {
                            (desktop.sendRemoteControlEvent as (ev: unknown) => void)(desktopEvent);
                        }
                    } else if (this.wsBackend && this.wsBackend.readyState === WebSocket.OPEN) {
                        this.wsBackend.send(JSON.stringify(rawEvent));
                    } else {
                        logWarn('failed to send mouse event: no desktopAPI and no wsBackend', msg.data);
                        if (!this.isReconnect) {
                            this.reconnectBackend();
                            this.isReconnect = false;
                        }
                    }
                }
            }

            if (msg.event === this.eventPrefix + '_join') {
                this.emit('join');
            }

            if (msg.event === this.eventPrefix + '_error') {
                this.emit('error', new WebSocketError(WebSocketErrorType.Join, msg.data.data));
            }

            if (msg.event === this.eventPrefix + '_signal') {
                this.emit('message', msg.data);
            }
        };
    }

    private closeHandler = (ev: CloseEvent) => {
        this.stopPingInterval();
        this.emit('close', ev.code);
        if (!this.closed) {
            this.reconnect();
        }
    };

    send(action: string, data?: Record<string, unknown>, binary?: boolean) {
        const msg = {
            action: `${this.eventPrefix}_${action}`,
            seq: this.seqNo++,
            data,
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (binary) {
                this.ws.send(new Uint8Array(encode(msg)) as unknown as Blob);
            } else {
                this.ws.send(JSON.stringify(msg));
            }
        } else {
            logWarn('failed to send message, connection is not open', msg);
        }
    }

    private reconnectBackend() {
        this.isReconnect = true;
        if (this.wsBackend) {
            this.wsBackend.close();
            this.wsBackend = null;
        }

        this.wsBackend = new WebSocket(`ws://localhost:${this.backendPort}/ws`);
        this.wsBackend.onopen = () => {
            logDebug('wsBackend: connected');
            this.isDesktop = true;
        };
        this.wsBackend.onclose = () => logWarn('wsBackend: disconnected');
        this.wsBackend.onerror = () => logErr('wsBackend: connection error');
    }

    close() {
        this.closed = true;
        this.stopPingInterval();
        this.ws?.close();
        this.ws = null;
        this.wsBackend?.close();
        this.wsBackend = null;
        this.remoteControlPermissionGranted = false;
        this.remoteControlPermissionPending = false;
        this.seqNo = 1;
        this.serverSeqNo = 0;
        this.expectedPongSeqNo = 0;
        this.connID = '';
        this.originalConnID = '';

        this.removeAllListeners('open');
        this.removeAllListeners('event');
        this.removeAllListeners('join');
        this.removeAllListeners('close');
        this.removeAllListeners('error');
        this.removeAllListeners('message');
    }

    reconnect() {
        const now = Date.now();
        if (this.lastDisconnect === 0) {
            this.lastDisconnect = now;
        }

        if ((now - this.lastDisconnect) >= wsReconnectionTimeout) {
            this.closed = true;
            this.emit('error', new WebSocketError(WebSocketErrorType.ReconnectTimeout, 'max disconnected time reached'));
            return;
        }

        setTimeout(() => {
            if (!this.closed) {
                logInfo('ws: reconnecting', this.originalConnID);
                this.init(true);
            }
        }, this.reconnectRetryTime);

        this.reconnectRetryTime += wsReconnectTimeIncrement;
    }

    getOriginalConnID() {
        return this.originalConnID;
    }

    private startPingInterval() {
        if (this.pingInterval) {
            this.stopPingInterval();
        }

        logDebug('ws: starting ping interval', this.originalConnID);

        this.pingInterval = setInterval(() => {
            if (this.waitingForPong && this.ws) {
                logWarn('ws: ping timeout, reconnecting', this.originalConnID);

                // We call the close handler directly since through ws.close() it could execute after a significant delay.
                this.ws.onclose = null;
                this.ws.close();
                this.closeHandler(new CloseEvent('close', {
                    code: 4000,
                }));

                return;
            }

            this.ping();
        }, wsPingIntervalMs);
    }

    private stopPingInterval() {
        if (this.pingInterval) {
            logDebug('ws: stopping ping interval', this.originalConnID);
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            this.waitingForPong = false;
            this.expectedPongSeqNo = 0;
        }
    }

    private ping() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.waitingForPong = true;

            // This is used to track the expected pong response which should match the request's sequence number.
            this.expectedPongSeqNo = this.seqNo;

            this.ws.send(JSON.stringify({
                action: 'ping',
                seq: this.seqNo++,
            }));
        }
    }
}
