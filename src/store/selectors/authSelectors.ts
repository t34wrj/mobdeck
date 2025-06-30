import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { AuthState, AuthenticatedUser } from '../../types/auth';

export const selectAuth = (state: RootState): AuthState => state.auth;

export const selectIsAuthenticated = createSelector(
  selectAuth,
  (auth) => auth.isAuthenticated
);

export const selectCurrentUser = createSelector(
  selectAuth,
  (auth) => auth.user
);

export const selectAuthToken = createSelector(
  selectAuth,
  (auth) => auth.token
);

export const selectAuthLoading = createSelector(
  selectAuth,
  (auth) => auth.loading
);

export const selectAuthError = createSelector(
  selectAuth,
  (auth) => auth.error
);

export const selectLastTokenRefresh = createSelector(
  selectAuth,
  (auth) => auth.lastTokenRefresh
);

export const selectIsUserAuthenticated = createSelector(
  [selectIsAuthenticated, selectCurrentUser],
  (isAuthenticated, user) => isAuthenticated && user !== null
);

export const selectUserServerUrl = createSelector(
  selectCurrentUser,
  (user) => user?.serverUrl || null
);

export const selectUserUsername = createSelector(
  selectCurrentUser,
  (user) => user?.username || null
);

export const selectUserEmail = createSelector(
  selectCurrentUser,
  (user) => user?.email || null
);

export const selectIsTokenExpired = createSelector(
  selectCurrentUser,
  (user) => {
    if (!user || !user.tokenExpiresAt) return true;
    return new Date(user.tokenExpiresAt) <= new Date();
  }
);

export const selectTokenExpirationTime = createSelector(
  selectCurrentUser,
  (user) => {
    if (!user || !user.tokenExpiresAt) return null;
    const expirationTime = new Date(user.tokenExpiresAt);
    const currentTime = new Date();
    const msUntilExpiration = expirationTime.getTime() - currentTime.getTime();
    return msUntilExpiration > 0 ? Math.floor(msUntilExpiration / 1000) : 0;
  }
);

export const selectShouldRefreshToken = createSelector(
  [selectIsAuthenticated, selectTokenExpirationTime, selectLastTokenRefresh],
  (isAuthenticated, timeUntilExpiration, lastRefresh) => {
    if (!isAuthenticated || !timeUntilExpiration) return false;
    
    const REFRESH_THRESHOLD = 5 * 60; // 5 minutes before expiration
    const MIN_REFRESH_INTERVAL = 30 * 60; // Don't refresh more than once every 30 minutes
    
    if (timeUntilExpiration <= REFRESH_THRESHOLD) {
      if (!lastRefresh) return true;
      
      const timeSinceLastRefresh = (new Date().getTime() - new Date(lastRefresh).getTime()) / 1000;
      return timeSinceLastRefresh >= MIN_REFRESH_INTERVAL;
    }
    
    return false;
  }
);

export const selectAuthStatusSummary = createSelector(
  [
    selectIsAuthenticated,
    selectCurrentUser,
    selectAuthLoading,
    selectAuthError,
    selectIsTokenExpired,
    selectTokenExpirationTime,
  ],
  (isAuthenticated, user, loading, error, isTokenExpired, timeUntilExpiration) => ({
    isAuthenticated,
    hasUser: user !== null,
    loading,
    error,
    isTokenExpired,
    timeUntilExpiration,
    serverUrl: user?.serverUrl || null,
    username: user?.username || null,
  })
);