/**
 * ConnectivityManager - React Native NetInfo integration
 * Handles network connectivity detection and management
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { logger } from './logger';
import { NetworkType } from '../types/sync';

export interface ConnectivityStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  networkType: NetworkType;
  isConnectionExpensive: boolean;
  details?: {
    ssid?: string;
    ipAddress?: string;
    subnet?: string;
    cellularGeneration?: string;
    isConnectionExpensive?: boolean;
  };
}

type ConnectivityListener = (status: ConnectivityStatus) => void;

class ConnectivityManager {
  private static instance: ConnectivityManager;
  private listeners: ConnectivityListener[] = [];
  private netInfoUnsubscribe: (() => void) | null = null;
  private isMonitoring = false;
  
  private currentStatus: ConnectivityStatus = {
    isConnected: false,
    isInternetReachable: false,
    networkType: NetworkType.NONE,
    isConnectionExpensive: false,
  };

  private constructor() {
    // Don't start monitoring until first listener is added
  }

  public static getInstance(): ConnectivityManager {
    if (!ConnectivityManager.instance) {
      ConnectivityManager.instance = new ConnectivityManager();
    }
    return ConnectivityManager.instance;
  }

  /**
   * Add a listener for connectivity status changes
   */
  public addListener(listener: ConnectivityListener): void {
    this.listeners.push(listener);
    
    // Start monitoring on first listener
    if (!this.isMonitoring && this.listeners.length === 1) {
      this.startMonitoring();
    }
  }

  /**
   * Remove a specific listener
   */
  public removeListener(listener: ConnectivityListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }

    // Stop monitoring if no listeners remain
    if (this.listeners.length === 0) {
      this.stopMonitoring();
    }
  }

  /**
   * Remove all listeners and stop monitoring
   */
  public removeAllListeners(): void {
    this.listeners = [];
    this.stopMonitoring();
  }

  /**
   * Get current connectivity status
   */
  public getStatus(): ConnectivityStatus {
    return { ...this.currentStatus };
  }

  /**
   * Refresh connectivity status
   */
  public async refresh(): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      this.handleNetworkStateChange(netInfo);
    } catch (error) {
      logger.error('[ConnectivityManager] Error refreshing connectivity:', error);
    }
  }

  /**
   * Wait for connection with timeout
   */
  public async waitForConnection(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      // If already connected, resolve immediately
      if (this.currentStatus.isConnected && this.currentStatus.isInternetReachable) {
        resolve(true);
        return;
      }

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.removeListener(connectionListener);
          resolve(false);
        }
      }, timeoutMs);

      const connectionListener = (status: ConnectivityStatus) => {
        if (!resolved && status.isConnected && status.isInternetReachable) {
          resolved = true;
          clearTimeout(timeout);
          this.removeListener(connectionListener);
          resolve(true);
        }
      };

      this.addListener(connectionListener);
    });
  }

  /**
   * Check if current connection is expensive (cellular)
   */
  public isConnectionExpensive(): boolean {
    return this.currentStatus.isConnectionExpensive;
  }

  /**
   * Check if connected via WiFi
   */
  public isWifi(): boolean {
    return this.currentStatus.networkType === NetworkType.WIFI;
  }

  /**
   * Check if connected via cellular
   */
  public isCellular(): boolean {
    return this.currentStatus.networkType === NetworkType.CELLULAR;
  }

  /**
   * Get human-readable connection type string
   */
  public getConnectionTypeString(): string {
    switch (this.currentStatus.networkType) {
      case NetworkType.WIFI:
        return 'WiFi';
      case NetworkType.CELLULAR:
        return 'Cellular';
      case NetworkType.ETHERNET:
        return 'Ethernet';
      case NetworkType.VPN:
        return 'VPN';
      case NetworkType.OTHER:
        return 'Other';
      case NetworkType.NONE:
        return 'None';
      default:
        return 'Unknown';
    }
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Add NetInfo listener
    this.netInfoUnsubscribe = NetInfo.addEventListener(this.handleNetworkStateChange.bind(this));
    
    // Initial fetch
    NetInfo.fetch().then(this.handleNetworkStateChange.bind(this)).catch((error) => {
      logger.error('[ConnectivityManager] Error during initial fetch:', error);
    });
  }

  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
  }

  private handleNetworkStateChange(state: NetInfoState | null): void {
    if (!state) {
      logger.warn('[ConnectivityManager] Received null network state');
      return;
    }

    try {
      const previousStatus = { ...this.currentStatus };
      
      // Update connectivity status
      this.currentStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        networkType: this.mapNetworkType(state.type),
        isConnectionExpensive: state.details?.isConnectionExpensive ?? false,
        details: state.details ? { ...state.details } : undefined,
      };

      // Log the change
      logger.debug('[ConnectivityManager] Network state changed:', {
        type: state.type,
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        isConnectionExpensive: state.details?.isConnectionExpensive,
      });

      // Notify listeners if status changed
      if (this.hasStatusChanged(previousStatus, this.currentStatus)) {
        this.notifyListeners();
      }
    } catch (error) {
      logger.error('[ConnectivityManager] Error handling network state change:', error);
    }
  }

  private mapNetworkType(netInfoType: NetInfoStateType): NetworkType {
    switch (netInfoType) {
      case 'wifi':
        return NetworkType.WIFI;
      case 'cellular':
        return NetworkType.CELLULAR;
      case 'ethernet':
        return NetworkType.ETHERNET;
      case 'vpn':
        return NetworkType.VPN;
      case 'bluetooth':
      case 'wimax':
      case 'other':
        return NetworkType.OTHER;
      case 'none':
        return NetworkType.NONE;
      case 'unknown':
      default:
        return NetworkType.OTHER;
    }
  }

  private hasStatusChanged(previous: ConnectivityStatus, current: ConnectivityStatus): boolean {
    return (
      previous.isConnected !== current.isConnected ||
      previous.isInternetReachable !== current.isInternetReachable ||
      previous.networkType !== current.networkType ||
      previous.isConnectionExpensive !== current.isConnectionExpensive
    );
  }

  private notifyListeners(): void {
    const status = { ...this.currentStatus };
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        logger.error('[ConnectivityManager] Error in listener callback:', error);
      }
    });
  }
}

export const connectivityManager = ConnectivityManager.getInstance();
export default connectivityManager;