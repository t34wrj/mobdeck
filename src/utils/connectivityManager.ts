import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { logger } from './logger';
import { readeckApiService } from '../services/ReadeckApiService';

export enum ConnectivityStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SERVER_UNREACHABLE = 'server_unreachable',
  CHECKING = 'checking',
}

interface ConnectivityState {
  networkConnected: boolean;
  serverReachable: boolean;
  status: ConnectivityStatus;
  lastCheckTime: Date;
  consecutiveFailures: number;
}

class ConnectivityManager {
  private static instance: ConnectivityManager;
  private listeners: { [event: string]: Function[] } = {};
  private state: ConnectivityState = {
    networkConnected: true,
    serverReachable: true,
    status: ConnectivityStatus.ONLINE,
    lastCheckTime: new Date(),
    consecutiveFailures: 0,
  };
  
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly QUICK_CHECK_TIMEOUT = 5000; // 5 seconds
  
  private constructor() {
    this.initializeNetworkListener();
  }
  
  static getInstance(): ConnectivityManager {
    if (!ConnectivityManager.instance) {
      ConnectivityManager.instance = new ConnectivityManager();
    }
    return ConnectivityManager.instance;
  }
  
  private initializeNetworkListener() {
    // Listen for network state changes
    NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkStateChange(state);
    });
    
    // Initial check
    this.checkConnectivity();
    
    // Start periodic checks
    this.startPeriodicChecks();
  }
  
  private handleNetworkStateChange(state: NetInfoState) {
    const wasConnected = this.state.networkConnected;
    this.state.networkConnected = state.isConnected ?? false;
    
    logger.debug('[ConnectivityManager] Network state changed:', {
      isConnected: state.isConnected,
      type: state.type,
      isInternetReachable: state.isInternetReachable,
    });
    
    if (!wasConnected && this.state.networkConnected) {
      // Network reconnected, check server immediately
      this.checkConnectivity();
    } else if (wasConnected && !this.state.networkConnected) {
      // Network disconnected
      this.updateStatus(ConnectivityStatus.OFFLINE);
    }
  }
  
  private startPeriodicChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(() => {
      if (this.state.networkConnected) {
        this.checkServerReachability();
      }
    }, this.CHECK_INTERVAL);
  }
  
  async checkConnectivity(): Promise<ConnectivityStatus> {
    console.log('[ConnectivityManager] Starting connectivity check...');
    this.updateStatus(ConnectivityStatus.CHECKING);
    
    // First check network connectivity
    const netInfo = await NetInfo.fetch();
    this.state.networkConnected = netInfo.isConnected ?? false;
    console.log('[ConnectivityManager] Network connected:', this.state.networkConnected);
    
    if (!this.state.networkConnected) {
      this.updateStatus(ConnectivityStatus.OFFLINE);
      return this.state.status;
    }
    
    // Then check server reachability
    await this.checkServerReachability();
    console.log('[ConnectivityManager] Final status:', this.state.status);
    return this.state.status;
  }
  
  private async checkServerReachability() {
    try {
      console.log('[ConnectivityManager] Checking server reachability...');
      // Use a lightweight endpoint for connectivity check
      const controller = new AbortController();
      
      // Set a short timeout for connectivity check
      const timeoutId = setTimeout(() => controller.abort(), this.QUICK_CHECK_TIMEOUT);
      
      try {
        // Try to validate token as a connectivity check with short timeout
        // This calls the /profile endpoint which is a good way to check server connectivity
        await readeckApiService.validateToken(this.QUICK_CHECK_TIMEOUT);
        clearTimeout(timeoutId);
        
        console.log('[ConnectivityManager] Server is reachable');
        this.state.serverReachable = true;
        this.state.consecutiveFailures = 0;
        this.updateStatus(ConnectivityStatus.ONLINE);
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        console.log('[ConnectivityManager] Server check failed:', { 
          code: error.code, 
          message: error.message, 
          name: error.name,
          status: error.status
        });
        
        // Handle different error types
        if (error.code === 'CONNECTION_ERROR' || 
            error.code === 'ECONNREFUSED' || 
            error.code === 'ECONNRESET' ||
            error.message?.includes('Network request failed') ||
            error.message?.includes('Connection refused') ||
            error.message?.includes('ECONNREFUSED') ||
            error.message?.includes('fetch failed') ||
            error.name === 'AbortError' ||
            error.name === 'TypeError') {
          this.handleServerUnreachable();
        } else if (error.status === 401 || error.code === 'AUTHENTICATION_ERROR') {
          // Authentication error means server is reachable but token is invalid
          console.log('[ConnectivityManager] Server reachable (auth error)');
          this.state.serverReachable = true;
          this.state.consecutiveFailures = 0;
          this.updateStatus(ConnectivityStatus.ONLINE);
        } else {
          // Other errors, treat as server issue
          console.log('[ConnectivityManager] Other error, treating as server unreachable');
          this.handleServerUnreachable();
        }
      }
    } catch (error) {
      console.error('[ConnectivityManager] Error checking server reachability:', error);
      this.handleServerUnreachable();
    }
  }
  
  private handleServerUnreachable() {
    this.state.serverReachable = false;
    this.state.consecutiveFailures++;
    
    // Always set status to SERVER_UNREACHABLE immediately when server is unreachable
    this.updateStatus(ConnectivityStatus.SERVER_UNREACHABLE);
  }
  
  private updateStatus(newStatus: ConnectivityStatus) {
    const oldStatus = this.state.status;
    this.state.status = newStatus;
    this.state.lastCheckTime = new Date();
    
    if (oldStatus !== newStatus) {
      logger.info(`[ConnectivityManager] Status changed: ${oldStatus} -> ${newStatus}`);
      this.emit('statusChanged', newStatus, oldStatus);
    }
  }
  
  getStatus(): ConnectivityStatus {
    return this.state.status;
  }
  
  isOnline(): boolean {
    return this.state.status === ConnectivityStatus.ONLINE;
  }
  
  isOffline(): boolean {
    return this.state.status === ConnectivityStatus.OFFLINE || 
           this.state.status === ConnectivityStatus.SERVER_UNREACHABLE;
  }
  
  getState(): Readonly<ConnectivityState> {
    return { ...this.state };
  }
  
  /**
   * Force an immediate connectivity check
   */
  async forceCheck(): Promise<ConnectivityStatus> {
    logger.debug('[ConnectivityManager] Forcing connectivity check');
    return this.checkConnectivity();
  }
  
  /**
   * Add event listener
   */
  on(event: string, listener: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: Function) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(listener => listener(...args));
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.listeners = {};
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.removeAllListeners();
  }
}

export const connectivityManager = ConnectivityManager.getInstance();