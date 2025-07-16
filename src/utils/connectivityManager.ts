/**
 * Simple Connectivity Manager for Mobile App
 * Basic network status detection using NetInfo
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isWifi: boolean;
  isCellular: boolean;
}

export type ConnectivityStatus = NetworkStatus;

export type NetworkListener = (status: NetworkStatus) => void;

let currentStatus: NetworkStatus = {
  isConnected: false,
  isWifi: false,
  isCellular: false,
};

let listeners: NetworkListener[] = [];
let unsubscribe: (() => void) | null = null;

export function getCurrentNetworkStatus(): NetworkStatus {
  return currentStatus;
}

export function addNetworkListener(listener: NetworkListener): void {
  listeners.push(listener);

  if (!unsubscribe) {
    startMonitoring();
  }
}

export function removeNetworkListener(listener: NetworkListener): void {
  listeners = listeners.filter(l => l !== listener);

  if (listeners.length === 0 && unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

function startMonitoring(): void {
  unsubscribe = NetInfo.addEventListener(handleNetworkChange);
}

function handleNetworkChange(state: NetInfoState): void {
  const newStatus: NetworkStatus = {
    isConnected: state.isConnected ?? false,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
  };

  currentStatus = newStatus;
  listeners.forEach(listener => listener(newStatus));
}

export async function checkNetworkStatus(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();
  const status: NetworkStatus = {
    isConnected: state.isConnected ?? false,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
  };

  currentStatus = status;
  return status;
}

export function isOnline(): boolean {
  return currentStatus.isConnected;
}

// Default connectivity manager instance
export const connectivityManager = {
  getCurrentNetworkStatus,
  addNetworkListener,
  removeNetworkListener,
  checkNetworkStatus,
  isOnline,
};
