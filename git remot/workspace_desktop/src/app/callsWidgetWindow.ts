// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IpcMainEvent, Rectangle, Event, IpcMainInvokeEvent} from 'electron';
import {BrowserWindow, desktopCapturer, dialog, ipcMain, systemPreferences, screen, shell} from 'electron';

import {mouse, Button, Point} from '@nut-tree-fork/nut-js';
import {uIOhook, UiohookKey} from 'uiohook-napi';

import MainWindow from 'app/mainWindow/mainWindow';
import NavigationManager from 'app/navigationManager';
import TabManager from 'app/tabs/tabManager';
import type {MattermostWebContentsView} from 'app/views/MattermostWebContentsView';
import webContentsEventManager from 'app/views/webContentEvents';
import WebContentsManager from 'app/views/webContentsManager';
import {
    BROWSER_HISTORY_PUSH,
    CALLS_ERROR,
    CALLS_JOIN_CALL,
    CALLS_JOIN_REQUEST,
    CALLS_JOINED_CALL,
    CALLS_LEAVE_CALL,
    CALLS_LINK_CLICK,
    CALLS_POPOUT_FOCUS,
    CALLS_WIDGET_RESIZE,
    CALLS_WIDGET_SHARE_SCREEN,
    CALLS_SEND_REMOTE_CONTROL_EVENT,
    CALLS_REMOTE_CONTROL_REQUEST_PERMISSION,
    CALLS_REMOTE_CONTROL_TERMINATE_SESSION,
    CALLS_WIDGET_OPEN_THREAD,
    CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL,
    CALLS_WIDGET_OPEN_USER_SETTINGS,
    DESKTOP_SOURCES_MODAL_REQUEST,
    GET_DESKTOP_SOURCES,
    UPDATE_SHORTCUT_MENU,
    VIEW_REMOVED,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {CALLS_PLUGIN_ID, MINIMUM_CALLS_WIDGET_HEIGHT, MINIMUM_CALLS_WIDGET_WIDTH} from 'common/utils/constants';
import {getFormattedPathName, isCallsPopOutURL, parseURL} from 'common/utils/url';
import Utils from 'common/utils/util';
import ViewManager from 'common/views/viewManager';
import ContextMenu from 'main/contextMenu';
import {localizeMessage} from 'main/i18nManager';
import performanceMonitor from 'main/performanceMonitor';
import PermissionsManager from 'main/security/permissionsManager';
import {
    composeUserAgent,
    getLocalPreload,
    openScreensharePermissionsSettingsMacOS,
    resetScreensharePermissionsMacOS,
} from 'main/utils';

import type {
    CallsJoinCallMessage,
    CallsWidgetWindowConfig,
} from 'types/calls';

const log = new Logger('CallsWidgetWindow');

const uioKeyMap: Record<string, number> = {
    Enter: UiohookKey.Enter,
    Escape: UiohookKey.Escape,
    Backspace: UiohookKey.Backspace,
    Tab: UiohookKey.Tab,
    Space: UiohookKey.Space,
    ArrowUp: UiohookKey.ArrowUp,
    ArrowDown: UiohookKey.ArrowDown,
    ArrowLeft: UiohookKey.ArrowLeft,
    ArrowRight: UiohookKey.ArrowRight,
    Control: UiohookKey.Ctrl,
    Shift: UiohookKey.Shift,
    Alt: UiohookKey.Alt,
    Meta: UiohookKey.Meta,
    Delete: UiohookKey.Delete,
    Home: UiohookKey.Home,
    End: UiohookKey.End,
    PageUp: UiohookKey.PageUp,
    PageDown: UiohookKey.PageDown,
    Insert: UiohookKey.Insert,
    CapsLock: UiohookKey.CapsLock,
    Semicolon: UiohookKey.Semicolon,
    Equal: UiohookKey.Equal,
    Comma: UiohookKey.Comma,
    Minus: UiohookKey.Minus,
    Period: UiohookKey.Period,
    Slash: UiohookKey.Slash,
    Backquote: UiohookKey.Backquote,
    BracketLeft: UiohookKey.BracketLeft,
    Backslash: UiohookKey.Backslash,
    BracketRight: UiohookKey.BracketRight,
    Quote: UiohookKey.Quote,
};

export class CallsWidgetWindow {
    private win?: BrowserWindow;
    private mainView?: MattermostWebContentsView;
    private options?: CallsWidgetWindowConfig;
    private missingScreensharePermissions?: boolean;
    private seenErrorMessage?: boolean;
    private sharedSourceID?: string;
    private sharedDisplayID?: number;
    private warnedWayland?: boolean;
    private remoteControlAllowedForSession?: boolean;
    private remoteControlEventQueue: any[] = [];
    private isProcessingQueue = false;
    private cachedTargetDisplay?: any;

    private popOut?: BrowserWindow;
    private boundsErr: Rectangle = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    };

    constructor() {
        mouse.config.autoDelayMs = 0;

        ipcMain.on(CALLS_WIDGET_RESIZE, this.handleResize);
        ipcMain.on(CALLS_WIDGET_SHARE_SCREEN, this.handleShareScreen);
        ipcMain.on(CALLS_POPOUT_FOCUS, this.handlePopOutFocus);
        ipcMain.on(CALLS_SEND_REMOTE_CONTROL_EVENT, this.handleSendRemoteControlEvent);
        ipcMain.handle(CALLS_REMOTE_CONTROL_REQUEST_PERMISSION, this.handleRemoteControlRequestPermission);
        ipcMain.on(CALLS_REMOTE_CONTROL_TERMINATE_SESSION, this.handleRemoteControlTerminateSession);
        ipcMain.handle(GET_DESKTOP_SOURCES, this.handleGetDesktopSources);
        ipcMain.handle(CALLS_JOIN_CALL, this.handleCreateCallsWidgetWindow);
        ipcMain.on(CALLS_LEAVE_CALL, this.handleCallsLeave);

        // forwards to the main app
        ipcMain.on(DESKTOP_SOURCES_MODAL_REQUEST, this.forwardToMainApp(DESKTOP_SOURCES_MODAL_REQUEST));
        ipcMain.on(CALLS_ERROR, this.forwardToMainApp(CALLS_ERROR));
        ipcMain.on(CALLS_LINK_CLICK, this.handleCallsLinkClick);
        ipcMain.on(CALLS_JOIN_REQUEST, this.forwardToMainApp(CALLS_JOIN_REQUEST));
        ipcMain.on(CALLS_WIDGET_OPEN_THREAD, this.handleCallsOpenThread);
        ipcMain.on(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL, this.handleCallsOpenStopRecordingModal);
        ipcMain.on(CALLS_WIDGET_OPEN_USER_SETTINGS, this.forwardToMainApp(CALLS_WIDGET_OPEN_USER_SETTINGS));

        ViewManager.on(VIEW_REMOVED, this.handleViewRemoved);
    }

    /**
     * Getters
     */

    get callID() {
        return this.options?.callID;
    }

    private get serverID() {
        return this.mainView?.serverId;
    }

    public isOpen() {
        return Boolean(this.win && !this.win.isDestroyed());
    }

    public isPopoutOpen() {
        return Boolean(this.popOut && !this.popOut.isDestroyed());
    }

    /**
     * Helper functions
     */

    public openDevTools = () => {
        this.win?.webContents.openDevTools({mode: 'detach'});
    };

    public openPopoutDevTools = () => {
        this.popOut?.webContents.openDevTools({mode: 'detach'});
    };

    public checkAccessibilityPermissions = () => {
        if (process.platform !== 'darwin') {
            return true;
        }
        return systemPreferences.isTrustedAccessibilityClient(false);
    };

    getViewURL = () => {
        return this.mainView && WebContentsManager.getServerURLByViewId(this.mainView.id);
    };

    isCallsWidget = (webContentsId: number) => {
        return webContentsId === this.win?.webContents.id || webContentsId === this.popOut?.webContents.id;
    };

    private getWidgetURL = () => {
        const serverURL = this.getViewURL();
        if (!serverURL) {
            return undefined;
        }
        const u = parseURL(new URL(serverURL)) as URL;

        u.pathname = getFormattedPathName(u.pathname);
        u.pathname += `plugins/${CALLS_PLUGIN_ID}/standalone/widget.html`;

        if (this.options?.callID) {
            u.searchParams.append('call_id', this.options.callID);
        }
        if (this.options?.title) {
            u.searchParams.append('title', this.options.title);
        }
        if (this.options?.rootID) {
            u.searchParams.append('root_id', this.options.rootID);
        }

        return u.toString();
    };

    private init = (view: MattermostWebContentsView, options: CallsWidgetWindowConfig) => {
        this.win = new BrowserWindow({
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
            title: 'Calls Widget',
            fullscreen: false,
            resizable: false,
            frame: false,
            transparent: true,
            show: false,
            alwaysOnTop: true,
            hasShadow: false,
            backgroundColor: '#00ffffff',
            webPreferences: {
                preload: getLocalPreload('externalAPI.js'),
            },
        });
        this.mainView = view;
        this.options = options;

        this.win.once('ready-to-show', () => this.win?.show());
        this.win.once('show', this.onShow);
        this.win.on('closed', this.onClosed);

        this.win.webContents.setWindowOpenHandler(this.onPopOutOpen);
        this.win.webContents.on('did-create-window', this.onPopOutCreate);

        // Calls widget window is not supposed to navigate anywhere else.
        this.win.webContents.on('will-navigate', this.onNavigate);
        this.win.webContents.on('did-start-navigation', this.onNavigate);

        const widgetURL = this.getWidgetURL();
        if (!widgetURL) {
            return;
        }
        performanceMonitor.registerView('CallsWidgetWindow', this.win.webContents);
        this.win?.loadURL(widgetURL, {
            userAgent: composeUserAgent(),
        }).then(() => {
            if (this.win) {
                this.injectSessionID(this.win.webContents);
            }
        }).catch((reason) => {
            log.error('failed to load', {reason});
        });
    };

    private close = async () => {
        log.debug('close');
        if (!this.win) {
            return Promise.resolve();
        }
        if (this.win.isDestroyed()) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            if (!this.win) {
                resolve();
                return;
            }
            this.win?.on('closed', resolve);
            performanceMonitor.unregisterView(this.win.webContents.id);
            this.win?.close();
        });
    };

    private setBounds(bounds: Rectangle) {
        if (!this.win) {
            return;
        }

        // NOTE: this hack is needed to fix positioning on certain systems where
        // BrowserWindow.setBounds() is not consistent.
        bounds.x += this.boundsErr.x;
        bounds.y += this.boundsErr.y;
        bounds.height += this.boundsErr.height;
        bounds.width += this.boundsErr.width;

        this.win.setBounds(bounds);
        this.boundsErr = Utils.boundsDiff(bounds, this.win.getBounds());
    }

    /**
     * BrowserWindow/WebContents handlers
     */

    private onClosed = () => {
        ipcMain.emit(UPDATE_SHORTCUT_MENU);
        delete this.win;
        delete this.mainView;
        delete this.options;
        delete this.sharedSourceID;
        delete this.sharedDisplayID;
        this.remoteControlAllowedForSession = false;
        this.remoteControlEventQueue = [];
        this.isProcessingQueue = false;
    };

    private onNavigate = (ev: Event, url: string) => {
        if (url === this.getWidgetURL()) {
            return;
        }
        log.warn('prevented widget window from navigating');
        ev.preventDefault();
    };

    private setWidgetWindowStacking = ({onTop}: { onTop: boolean }) => {
        log.debug('setWidgetWindowStacking', {onTop});

        if (!this.win) {
            return;
        }

        if (onTop) {
            this.win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen: true, skipTransformProcessType: true});
            this.win.setAlwaysOnTop(true, 'screen-saver');
            this.win.focus();
        } else {
            this.win.setAlwaysOnTop(false);
            this.win.setVisibleOnAllWorkspaces(false);
        }
    };

    private onShow = () => {
        log.debug('onShow');
        const mainWindow = MainWindow.window;
        if (!(this.win && mainWindow)) {
            return;
        }

        this.setWidgetWindowStacking({onTop: true});

        const bounds = this.win.getBounds();
        const mainBounds = mainWindow.getBounds();
        const initialBounds = {
            x: mainBounds.x + 12,
            y: (mainBounds.y + mainBounds.height) - bounds.height - 12,
            width: MINIMUM_CALLS_WIDGET_WIDTH,
            height: MINIMUM_CALLS_WIDGET_HEIGHT,
        };
        this.win.setMenuBarVisibility(false);

        if (process.env.MM_DEBUG_CALLS_WIDGET) {
            this.openDevTools();
        }

        ipcMain.emit(UPDATE_SHORTCUT_MENU);

        this.setBounds(initialBounds);
    };

    private onPopOutOpen = ({url}: { url: string }) => {
        if (!(this.mainView && this.options)) {
            return {action: 'deny' as const};
        }

        const parsedURL = parseURL(url);
        if (!parsedURL) {
            return {action: 'deny' as const};
        }
        const serverURL = this.getViewURL();
        if (!serverURL) {
            return {action: 'deny' as const};
        }
        if (isCallsPopOutURL(serverURL, parsedURL, this.options?.callID)) {
            return {
                action: 'allow' as const,
                overrideBrowserWindowOptions: {
                    autoHideMenuBar: true,
                    webPreferences: {
                        preload: getLocalPreload('externalAPI.js'),
                    },
                },
            };
        }

        log.warn('onPopOutOpen: prevented window open');
        return {action: 'deny' as const};
    };

    private onPopOutCreate = (win: BrowserWindow) => {
        this.popOut = win;

        this.setWidgetWindowStacking({onTop: false});

        // Let the webContentsEventManager handle links that try to open a new window.
        webContentsEventManager.addWebContentsEventListeners(this.popOut.webContents);

        // Need to capture and handle redirects for security.
        this.popOut.webContents.on('will-redirect', (event: Event) => {
            // There's no reason we would allow a redirect from the call's popout. Eventually we may, so revise then.
            // Note for the future: the code from https://github.com/mattermost/desktop/pull/2580 will not work for us.
            event.preventDefault();
        });

        const contextMenu = new ContextMenu({}, this.popOut);
        contextMenu.reload();

        // Update menu to show the developer tools option for this window.
        ipcMain.emit(UPDATE_SHORTCUT_MENU);

        this.popOut.on('closed', () => {
            ipcMain.emit(UPDATE_SHORTCUT_MENU);
            delete this.popOut;
            contextMenu.dispose();
            this.setWidgetWindowStacking({onTop: true});
        });

        // Set the userAgent so that the widget's popout is considered a desktop window in the webapp code.
        // 'did-frame-finish-load' is the earliest moment that allows us to call loadURL without throwing an error.
        // https://mattermost.atlassian.net/browse/MM-52756 is the proper fix for this.
        this.popOut.webContents.once('did-frame-finish-load', async () => {
            const url = this.popOut?.webContents.getURL() || '';
            if (!url) {
                return;
            }

            try {
                await this.popOut?.loadURL(url, {
                    userAgent: composeUserAgent(),
                });
                if (this.popOut) {
                    this.injectSessionID(this.popOut.webContents);
                }
            } catch (e) {
                log.error('did-frame-finish-load, failed to reload with correct userAgent', {e});
            }
        });
    };

    /************************
     * IPC HANDLERS
     ************************/

    private handleResize = (ev: IpcMainEvent, width: number, height: number) => {
        log.debug('handleResize', {width, height});

        if (!this.win) {
            return;
        }

        if (!this.isCallsWidget(ev.sender.id)) {
            log.debug('handleResize', 'Disallowed calls event');
            return;
        }

        const zoomFactor = this.win.webContents.getZoomFactor();
        const currBounds = this.win.getBounds();
        const newBounds = {
            x: currBounds.x,
            y: currBounds.y - (Math.ceil(height * zoomFactor) - currBounds.height),
            width: Math.ceil(width * zoomFactor),
            height: Math.ceil(height * zoomFactor),
        };

        this.setBounds(newBounds);
    };

    private handleShareScreen = async (ev: IpcMainEvent, sourceID: string, withAudio: boolean, screenIDFromWebapp?: string) => {
        log.debug('handleShareScreen: raw args', {sourceID, withAudio, screenIDFromWebapp});
        log.debug('handleShareScreen: all displays', screen.getAllDisplays().map((d: any) => ({id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor})));

        if (this.mainView?.webContentsId !== ev.sender.id) {
            log.debug('handleShareScreen', 'blocked on wrong webContentsId');
            return;
        }

        this.sharedSourceID = sourceID;

        // Determine which display the shared source is on
        this.sharedDisplayID = undefined;
        this.cachedTargetDisplay = undefined;
        this.remoteControlEventQueue = [];
        this.isProcessingQueue = false;
        const displays = screen.getAllDisplays();

        // First priority: use screenID passed from the webapp (computed at source selection time)
        if (screenIDFromWebapp) {
            const matchedDisplay = displays.find((d: any) => d.id.toString() === screenIDFromWebapp);
            if (matchedDisplay) {
                this.sharedDisplayID = matchedDisplay.id;
                log.debug('handleShareScreen: matched display from webapp screenID', {screenIDFromWebapp, displayID: matchedDisplay.id});
            } else {
                // Fallback: index-based matching for Linux
                const screenIndex = parseInt(screenIDFromWebapp, 10);
                if (!isNaN(screenIndex) && screenIndex >= 0 && screenIndex < displays.length) {
                    this.sharedDisplayID = displays[screenIndex].id;
                    log.debug('handleShareScreen: matched display by index from webapp screenID', {screenIDFromWebapp, screenIndex});
                }
            }
        }

        // Second priority: match from sourceID prefix for screen sources
        // On Windows, source IDs like "screen:0:0" or "screen:4:0" use GDI indices
        // that don't map to display indices. We use desktopCapturer to match properly.
        if (!this.sharedDisplayID && sourceID.startsWith('screen:')) {
            try {
                const sources = await desktopCapturer.getSources({
                    types: ['screen'],
                    thumbnailSize: {width: 1, height: 1}, // minimal size, we just need the source list
                });
                const matchedSource = sources.find((s) => s.id === sourceID);
                if (matchedSource) {
                    // Match source name to display: "Screen 1" = displays[displays.length - 1], "Screen 2" = displays[displays.length - 2]
                    const nameMatch = matchedSource.name.match(/(\d+)/);
                    if (nameMatch) {
                        const screenNum = parseInt(nameMatch[1], 10);
                        const displayIndex = displays.length - screenNum;
                        if (displayIndex >= 0 && displayIndex < displays.length) {
                            this.sharedDisplayID = displays[displayIndex].id;
                            log.debug('handleShareScreen: matched screen source by name (reversed)', {
                                sourceID,
                                sourceName: matchedSource.name,
                                displayIndex,
                                displayID: displays[displayIndex].id,
                            });
                        }
                    }
                }
            } catch (err) {
                log.warn('handleShareScreen: failed to get desktop sources for matching', err);
            }

            // Fallback: try GDI index as display index (unreliable on Windows)
            if (!this.sharedDisplayID) {
                const screenID = sourceID.split(':')[1];
                const matchedDisplay = displays.find((d: any) => d.id.toString() === screenID);
                if (matchedDisplay) {
                    this.sharedDisplayID = matchedDisplay.id;
                } else {
                    const screenIndex = parseInt(screenID, 10);
                    if (!isNaN(screenIndex) && screenIndex >= 0 && screenIndex < displays.length) {
                        this.sharedDisplayID = displays[screenIndex].id;
                    }
                }
            }
        }

        // Third priority: for window sources, use cursor position
        // When the user clicks "Share", the cursor is near the window they're sharing
        if (!this.sharedDisplayID && sourceID.startsWith('window:')) {
            const cursorPos = screen.getCursorScreenPoint();
            const cursorDisplay = screen.getDisplayNearestPoint(cursorPos);
            this.sharedDisplayID = cursorDisplay.id;
            log.debug('handleShareScreen: window sharing using cursor position', {
                sourceID,
                cursorX: cursorPos.x,
                cursorY: cursorPos.y,
                displayID: cursorDisplay.id,
                displayBounds: cursorDisplay.bounds,
            });
        }

        log.debug('handleShareScreen: final sharedDisplayID', {sourceID, sharedDisplayID: this.sharedDisplayID});

        this.win?.webContents.send(CALLS_WIDGET_SHARE_SCREEN, sourceID, withAudio);

        if (this.win) {
            this.injectSessionID(this.win.webContents);
        }
        if (this.popOut) {
            this.injectSessionID(this.popOut.webContents);
        }
        if (this.mainView) {
            const contents = typeof this.mainView.getWebContentsView === 'function' ? this.mainView.getWebContentsView().webContents : (this.mainView as any).webContents;
            if (contents) {
                this.injectSessionID(contents);
            }
        }
    };

    private handlePopOutFocus = () => {
        if (!this.popOut) {
            return;
        }
        if (this.popOut.isMinimized()) {
            this.popOut.restore();
        }
        this.popOut.focus();
    };

    private handleRemoteControlRequestPermission = async (ev: IpcMainInvokeEvent) => {
        log.debug('handleRemoteControlRequestPermission');

        if (this.mainView?.webContentsId !== ev.sender.id && !this.isCallsWidget(ev.sender.id)) {
            return false;
        }

        const serverURL = this.getViewURL();
        if (!serverURL) {
            return false;
        }

        const granted = await PermissionsManager.doPermissionRequest(
            ev.sender.id,
            'remoteControl',
            {requestingUrl: serverURL.toString(), isMainFrame: false} as any,
        );

        if (!granted) {
            return false;
        }

        if (this.remoteControlAllowedForSession) {
            return true;
        }

        const mainWindow = MainWindow.get();
        if (!mainWindow) {
            return false;
        }

        const {response} = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: localizeMessage('callsWidgetWindow.remoteControlApproval.title', 'Remote Control Request'),
            message: localizeMessage('callsWidgetWindow.remoteControlApproval.message', 'A participant is requesting to take control of your screen. Do you want to allow it?'),
            buttons: [
                localizeMessage('label.deny', 'Deny'),
                localizeMessage('label.allow', 'Allow'),
            ],
            defaultId: 1,
        });

        if (response === 1) {
            this.remoteControlAllowedForSession = true;
            return true;
        }

        return false;
    };

    private handleRemoteControlTerminateSession = () => {
        log.debug('handleRemoteControlTerminateSession');
        this.remoteControlAllowedForSession = false;
        this.remoteControlEventQueue = [];
    };

    private handleSendRemoteControlEvent = (ev: IpcMainEvent, remoteEvent: any) => {
        if (!this.mainView || this.mainView.isDestroyed()) {
            return;
        }

        if (this.mainView.webContentsId !== ev.sender.id && !this.isCallsWidget(ev.sender.id)) {
            log.warn('handleSendRemoteControlEvent: blocked on wrong webContentsId', ev.sender.id);
            return;
        }

        if (!this.remoteControlAllowedForSession) {
            log.warn('handleSendRemoteControlEvent: blocked because remote control is not allowed for this session');
            return;
        }

        if (typeof remoteEvent !== 'object' || remoteEvent === null) {
            return;
        }

        const type = (remoteEvent.type || remoteEvent.action || '').toLowerCase();
        if (type === 'mousemove' || type === 'move') {
            // Tail-coalescing: if last event in queue is mousemove, replace it.
            const lastIdx = this.remoteControlEventQueue.length - 1;
            if (lastIdx >= 0) {
                const lastEvent = this.remoteControlEventQueue[lastIdx];
                const lastType = (lastEvent.type || lastEvent.action || '').toLowerCase();
                if (lastType === 'mousemove' || lastType === 'move') {
                    this.remoteControlEventQueue[lastIdx] = remoteEvent;
                } else {
                    this.remoteControlEventQueue.push(remoteEvent);
                }
            } else {
                this.remoteControlEventQueue.push(remoteEvent);
            }
        } else {
            this.remoteControlEventQueue.push(remoteEvent);
        }

        if (this.isProcessingQueue) {
            return;
        }

        this.processRemoteControlQueue();
    };

    private processRemoteControlQueue = async () => {
        this.isProcessingQueue = true;

        while (this.remoteControlEventQueue.length > 0) {
            // Immediately stop processing if session was terminated.
            if (!this.remoteControlAllowedForSession) {
                this.remoteControlEventQueue = [];
                break;
            }

            const remoteEvent = this.remoteControlEventQueue.shift();
            if (!remoteEvent) {
                continue;
            }

            // eslint-disable-next-line no-await-in-loop
            await this.executeRemoteControlEvent(remoteEvent);

            // Yield to event loop between each operation.
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => {
                setImmediate(resolve);
            });
        }

        this.isProcessingQueue = false;
    };

    private executeRemoteControlEvent = async (remoteEvent: any) => {
        const {type, action, x, y, button, key, code, deltaX, deltaY, ctrlKey, shiftKey, altKey, metaKey} = remoteEvent;
        const eventType = type || action;
        if (typeof eventType !== 'string') {
            return;
        }

        const lowerType = eventType.toLowerCase();

        if (!this.warnedWayland && process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
            log.warn('handleSendRemoteControlEvent: Wayland detected. Mouse control might not work. X11 is recommended.');
            this.warnedWayland = true;
        }

        if (!this.checkAccessibilityPermissions()) {
            log.warn('handleSendRemoteControlEvent: missing accessibility permissions');
            if (process.platform === 'darwin') {
                // eslint-disable-next-line no-await-in-loop
                const {response} = await dialog.showMessageBox({
                    type: 'warning',
                    title: localizeMessage('callsWidgetWindow.accessibilityRequired.title', 'Accessibility Permission Required'),
                    message: localizeMessage('callsWidgetWindow.accessibilityRequired.message', 'Remote control requires Accessibility permissions to move the mouse and type. Would you like to open System Settings to grant them?'),
                    buttons: [
                        localizeMessage('label.cancel', 'Cancel'),
                        localizeMessage('label.openSettings', 'Open Settings'),
                    ],
                    defaultId: 1,
                });

                if (response === 1) {
                    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
                }
            }
            this.remoteControlEventQueue = [];
            return;
        }

        try {
            if (['mousedown', 'mouseup', 'mousemove', 'click', 'move'].includes(lowerType)) {
                // Immediately check session before native call
                if (!this.remoteControlAllowedForSession) {
                    return;
                }

                let targetDisplay = this.cachedTargetDisplay;
                if (!targetDisplay) {
                    targetDisplay = screen.getPrimaryDisplay();
                    if (this.sharedDisplayID) {
                        const displays = screen.getAllDisplays();
                        const matchedDisplay = displays.find((d: any) => d.id === this.sharedDisplayID);
                        if (matchedDisplay) {
                            targetDisplay = matchedDisplay;
                        }
                    } else if (this.sharedSourceID?.startsWith('screen:')) {
                        const screenID = this.sharedSourceID.split(':')[1];
                        const displays = screen.getAllDisplays();
                        let sharedDisplay = displays.find((d: any) => d.id.toString() === screenID);
                        if (!sharedDisplay) {
                            const screenIndex = parseInt(screenID, 10);
                            if (!isNaN(screenIndex) && screenIndex >= 0 && screenIndex < displays.length) {
                                sharedDisplay = displays[screenIndex];
                            }
                        }
                        if (sharedDisplay) {
                            targetDisplay = sharedDisplay;
                        }
                    }
                    this.cachedTargetDisplay = targetDisplay;
                }
                const {width, height, x: displayX, y: displayY} = targetDisplay.bounds;

                const hasValidCoords = (typeof x === 'number' && x >= 0) || (typeof y === 'number' && y >= 0);
                if (hasValidCoords) {
                    let targetX = Math.round(((x || 0) * width) + displayX);
                    let targetY = Math.round(((y || 0) * height) + displayY);

                    if (process.platform !== 'darwin') {
                        targetX *= targetDisplay.scaleFactor;
                        targetY *= targetDisplay.scaleFactor;
                    }

                    // Check session one last time before moving
                    if (!this.remoteControlAllowedForSession) {
                        return;
                    }

                    await mouse.setPosition(new Point(targetX, targetY));
                }

                if (lowerType === 'mousedown' || lowerType === 'mouseup' || lowerType === 'click') {
                    // Check session again
                    if (!this.remoteControlAllowedForSession) {
                        return;
                    }

                    const buttons: Record<string | number, Button> = {
                        0: Button.LEFT,
                        1: Button.MIDDLE,
                        2: Button.RIGHT,
                        left: Button.LEFT,
                        middle: Button.MIDDLE,
                        right: Button.RIGHT,
                    };
                    const btnKey = button ?? 0;
                    const nutButton = buttons[btnKey] ?? buttons[btnKey.toString().toLowerCase()] ?? Button.LEFT;

                    if (lowerType === 'click') {
                        await mouse.click(nutButton);
                    } else if (lowerType === 'mousedown') {
                        await mouse.pressButton(nutButton);
                    } else {
                        await mouse.releaseButton(nutButton);
                    }
                }
            } else if (['keydown', 'keyup', 'key'].includes(lowerType)) {
                // Check session before native keyboard call
                if (!this.remoteControlAllowedForSession) {
                    return;
                }

                const modifiers: number[] = [];
                if (ctrlKey) {
                    modifiers.push(UiohookKey.Ctrl);
                }
                if (shiftKey) {
                    modifiers.push(UiohookKey.Shift);
                }
                if (altKey) {
                    modifiers.push(UiohookKey.Alt);
                }
                if (metaKey) {
                    modifiers.push(UiohookKey.Meta);
                }

                let uioKey = uioKeyMap[key] || uioKeyMap[code] || (UiohookKey as any)[key] || (UiohookKey as any)[code?.replace('Key', '')];
                if (!uioKey && key && key.length === 1) {
                    uioKey = (UiohookKey as any)[key.toUpperCase()];
                }

                if (uioKey) {
                    const filteredModifiers = modifiers.filter((m) => m !== uioKey);
                    if (lowerType === 'keydown' || lowerType === 'key') {
                        for (const mod of filteredModifiers) {
                            uIOhook.keyToggle(mod, 'down');
                        }
                        uIOhook.keyToggle(uioKey, 'down');

                        if (lowerType === 'key') {
                            uIOhook.keyToggle(uioKey, 'up');
                            for (const mod of filteredModifiers) {
                                uIOhook.keyToggle(mod, 'up');
                            }
                        }
                    } else {
                        uIOhook.keyToggle(uioKey, 'up');
                        for (const mod of filteredModifiers) {
                            uIOhook.keyToggle(mod, 'up');
                        }
                    }
                }
            } else if (lowerType === 'wheel' || lowerType === 'scroll') {
                // Check session
                if (!this.remoteControlAllowedForSession) {
                    return;
                }

                if (deltaY > 0) {
                    await mouse.scrollDown(Math.abs(deltaY));
                } else if (deltaY < 0) {
                    await mouse.scrollUp(Math.abs(deltaY));
                }

                if (deltaX > 0) {
                    await mouse.scrollRight(Math.abs(deltaX));
                } else if (deltaX < 0) {
                    await mouse.scrollLeft(Math.abs(deltaX));
                }
            }
        } catch (e) {
            log.error('Failed to execute remote control event', e);
        }
    };

    private handleGetDesktopSources = async (event: IpcMainInvokeEvent, opts: Electron.SourcesOptions) => {
        log.debug('handleGetDesktopSources');

        // For Calls we make an extra check to ensure the event is coming from the expected window (main view).
        // Otherwise we want to allow for other plugins to ask for screen sharing sources.
        if (this.mainView && event.sender.id !== this.mainView.webContentsId) {
            throw new Error('handleGetDesktopSources: blocked on wrong webContentsId');
        }

        const view = WebContentsManager.getViewByWebContentsId(event.sender.id);
        if (!view) {
            throw new Error('handleGetDesktopSources: view not found');
        }

        if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'denied') {
            try {
                // If permissions are missing we reset them so that the system
                // prompt can be showed.
                await resetScreensharePermissionsMacOS();

                // We only open the system settings if permissions were already missing since
                // on the first attempt to get the sources the OS will correctly show a prompt.
                if (this.missingScreensharePermissions) {
                    await openScreensharePermissionsSettingsMacOS();
                }
                this.missingScreensharePermissions = true;
            } catch (err) {
                log.error('failed to reset screen sharing permissions', {err});
            }
        }

        const serverURL = this.getViewURL();

        // Only check permissions if serverURL is available (for Calls plugin)
        // For other plugins or standalone usage, skip the permission check
        if (serverURL) {
            if (!await PermissionsManager.doPermissionRequest(
                view.webContentsId,
                'screenShare',
                {requestingUrl: serverURL.toString(), isMainFrame: false},
            )) {
                throw new Error('permissions denied');
            }
        }

        const screenPermissionsErrArgs = ['screen-permissions', this.callID];

        return desktopCapturer.getSources(opts).then((sources) => {
            let hasScreenPermissions = true;
            if (systemPreferences.getMediaAccessStatus) {
                const screenPermissions = systemPreferences.getMediaAccessStatus('screen');
                log.debug('screenPermissions', {screenPermissions});
                if (screenPermissions === 'denied') {
                    log.info('no screen sharing permissions');
                    hasScreenPermissions = false;
                }
            }

            if (!hasScreenPermissions || !sources.length) {
                throw new Error('handleGetDesktopSources: permissions denied');
            }

            const allDisplays = screen.getAllDisplays();

            const message = sources.map((source) => {
                // For screen sources, match with the correct display
                // On Windows, source IDs like "screen:0:0" or "screen:4:0" use GDI indices
                // which don't map to display indices. We match by:
                // 1. Source name matching display label (e.g. "Screen 1" matches primary)
                // 2. Thumbnail aspect ratio matching display aspect ratio (fallback)
                let screenID = '';
                if (source.id.startsWith('screen:')) {
                    const thumbWidth = source.thumbnail.getSize().width;
                    const thumbHeight = source.thumbnail.getSize().height;
                    const thumbAspect = thumbWidth / thumbHeight;

                    let matchedDisplay: any = null;

                    // Try matching by name: "Primary Screen" or screen number
                    // On Windows, source.name is like "Screen 1", "Screen 2"
                    // On macOS, it's like "Built-in Retina Display"
                    const nameMatch = source.name.match(/(\d+)/);
                    if (nameMatch) {
                        const screenNum = parseInt(nameMatch[1], 10);

                        // Reversed mapping: desktopCapturer order differs from getAllDisplays
                        const displayIndex = allDisplays.length - screenNum;
                        if (displayIndex >= 0 && displayIndex < allDisplays.length) {
                            matchedDisplay = allDisplays[displayIndex];
                        }
                    }

                    // If no name match, try matching by thumbnail aspect ratio vs display aspect ratio
                    if (!matchedDisplay) {
                        let bestDiff = Infinity;
                        for (const display of allDisplays) {
                            const displayAspect = display.bounds.width / display.bounds.height;
                            const aspectDiff = Math.abs(thumbAspect - displayAspect);
                            if (aspectDiff < bestDiff) {
                                bestDiff = aspectDiff;
                                matchedDisplay = display;
                            }
                        }
                    }

                    if (matchedDisplay) {
                        screenID = matchedDisplay.id.toString();
                        log.debug('handleGetDesktopSources: matched screen source to display', {
                            sourceID: source.id,
                            sourceName: source.name,
                            thumbSize: {width: thumbWidth, height: thumbHeight},
                            matchedDisplayID: matchedDisplay.id,
                            matchedDisplayBounds: matchedDisplay.bounds,
                        });
                    } else {
                        // Fallback: use the GDI index (may not work on Windows)
                        screenID = source.id.split(':')[1];
                        log.warn('handleGetDesktopSources: no display match for screen source', source.id);
                    }
                }

                return {
                    id: source.id,
                    name: source.name,
                    thumbnailURL: source.thumbnail.toDataURL(),
                    screenID,
                };
            });

            return message;
        }).catch((err) => {
            // Only send calls error if this window has been initialized (i.e. we are in a call).
            // The rest of the logic is shared so that other plugins can request screen sharing sources.
            if (this.callID) {
                view.sendToRenderer(CALLS_ERROR, ...screenPermissionsErrArgs);
                this.win?.webContents.send(CALLS_ERROR, ...screenPermissionsErrArgs);
            }

            throw new Error(`handleGetDesktopSources: desktopCapturer.getSources failed: ${err}`);
        });
    };

    private handleCreateCallsWidgetWindow = async (event: IpcMainInvokeEvent, msg: CallsJoinCallMessage) => {
        log.debug('createCallsWidgetWindow', msg);

        if (this.mainView && (this.mainView.isDestroyed() || !this.isOpen())) {
            log.warn('handleCreateCallsWidgetWindow: stale mainView found, clearing');
            const staleView = this.mainView;
            delete this.mainView;
            delete this.options;

            if (!staleView.isDestroyed()) {
                staleView.sendToRenderer(CALLS_ERROR, 'stale-session', msg.callID);
            }
        }

        if (this.mainView && event.sender.id !== this.mainView.webContentsId) {
            WebContentsManager.getViewByWebContentsId(event.sender.id)?.sendToRenderer(CALLS_ERROR);

            // We only want to show the error message once to avoid spamming the user with dialog boxes
            if (!this.seenErrorMessage) {
                dialog.showErrorBox(
                    localizeMessage('callsWidgetWindow.cannotStartCall.title', 'Cannot Start Call'),
                    localizeMessage('callsWidgetWindow.cannotStartCall.message', 'There is an in-progress call on another server that must be ended before joining a new call.'),
                );
                this.seenErrorMessage = true;
            }
            return Promise.resolve();
        }

        // trying to join again the call we are already in should not be allowed.
        if (this.options?.callID === msg.callID) {
            return Promise.resolve();
        }

        // to switch from one call to another we need to wait for the existing
        // window to be fully closed.
        await this.close();

        const currentView = WebContentsManager.getViewByWebContentsId(event.sender.id);
        if (!currentView) {
            log.error('unable to create calls widget window: currentView is missing');
            return Promise.resolve();
        }
        const primaryView = ViewManager.getPrimaryView(currentView.serverId);
        if (!primaryView) {
            log.error('unable to create calls widget window: primaryView is missing');
            return Promise.resolve();
        }
        const primaryWebContentsView = WebContentsManager.getView(primaryView.id);
        if (!primaryWebContentsView) {
            log.error('unable to create calls widget window: primaryWebContentsView is missing');
            return Promise.resolve();
        }

        const promise = new Promise((resolve) => {
            const connected = (ev: IpcMainEvent, incomingCallId: string, incomingSessionId: string) => {
                log.debug('onJoinedCall', {incomingCallId});

                if (!this.isCallsWidget(ev.sender.id)) {
                    log.debug('onJoinedCall', 'blocked on wrong webContentsId');
                    return;
                }

                if (msg.callID !== incomingCallId) {
                    log.debug('onJoinedCall', 'blocked on wrong callId');
                    return;
                }

                ipcMain.off(CALLS_JOINED_CALL, connected);
                if (this.mainView) {
                    const contents = typeof this.mainView.getWebContentsView === 'function' ? this.mainView.getWebContentsView().webContents : (this.mainView as any).webContents;
                    if (contents) {
                        this.injectSessionID(contents);
                    }
                }
                resolve({callID: msg.callID, sessionID: incomingSessionId});
            };
            ipcMain.on(CALLS_JOINED_CALL, connected);
        });

        this.init(primaryWebContentsView, {
            callID: msg.callID,
            title: msg.title,
            rootID: msg.rootID,
            channelURL: msg.channelURL,
        });

        return promise;
    };

    private handleCallsLeave = () => {
        log.debug('handleCallsLeave');

        this.close();
    };

    private focusChannelView() {
        if (!this.serverID || !this.mainView) {
            return;
        }

        TabManager.switchToTab(this.mainView.id);
        ServerManager.updateCurrentServer(this.serverID);
        MainWindow.get()?.focus();
    }

    private forwardToMainApp = (channel: string) => {
        return (event: IpcMainEvent, ...args: any) => {
            log.debug('forwardToMainApp', channel, ...args);

            if (!this.isCallsWidget(event.sender.id)) {
                return;
            }

            if (!this.serverID) {
                return;
            }

            this.focusChannelView();
            this.mainView?.sendToRenderer(channel, ...args);
        };
    };

    private handleCallsOpenThread = (event: IpcMainEvent, threadID: string) => {
        this.forwardToMainApp(CALLS_WIDGET_OPEN_THREAD)(event, threadID);
    };

    private handleCallsOpenStopRecordingModal = (event: IpcMainEvent, channelID: string) => {
        this.forwardToMainApp(CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL)(event, channelID);
    };

    private handleCallsLinkClick = (event: IpcMainEvent, url: string) => {
        log.debug('handleCallsLinkClick');

        if (!this.isCallsWidget(event.sender.id)) {
            return;
        }

        if (!this.serverID) {
            return;
        }

        const parsedURL = parseURL(url);
        if (parsedURL) {
            NavigationManager.openLinkInNewTab(parsedURL);
            return;
        }

        // If parsing above fails it means it's a relative path (e.g.
        // pointing to a channel).

        this.focusChannelView();
        this.mainView?.sendToRenderer(BROWSER_HISTORY_PUSH, url);
    };

    private injectSessionID = (webContents: Electron.WebContents) => {
        if (!webContents || (typeof webContents.isDestroyed === 'function' && webContents.isDestroyed())) {
            return;
        }

        const sessionID = this.sharedSourceID || '';
        const stunURI = Config.data?.stunURI || '';
        const code = `
            window.screenSharingSessionIDForCurrentCall = '${sessionID}';
            window.stunURIForCurrentCall = '${stunURI}';
        `;
        if (typeof webContents.executeJavaScript === 'function') {
            webContents.executeJavaScript(code).catch((err) => {
                log.error('failed to inject session ID', err);
            });
        }
    };

    private handleViewRemoved = (viewId: string, serverId: string) => {
        if (viewId === this.mainView?.id) {
            const primaryView = ViewManager.getPrimaryView(serverId);
            if (primaryView) {
                const primaryWebContentsView = WebContentsManager.getView(primaryView.id);
                if (primaryWebContentsView) {
                    this.mainView = primaryWebContentsView;
                } else {
                    this.close();
                }
            } else {
                this.close();
            }
        }
    };
}

const callsWidgetWindow = new CallsWidgetWindow();
export default callsWidgetWindow;
