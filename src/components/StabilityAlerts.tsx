import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { theme } from './theme';
import { StabilityNotification } from '../store/slices/stabilitySlice';

interface StabilityAlertsProps {
  notifications: StabilityNotification[];
  onDismiss: (id: string) => void;
  onClearDismissed: () => void;
}

export const StabilityAlerts: React.FC<StabilityAlertsProps> = ({
  notifications,
  onDismiss,
  onClearDismissed,
}) => {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getNotificationStyle = (type: StabilityNotification['type']) => {
    switch (type) {
      case 'critical':
        return {
          backgroundColor: theme.colors.error[50],
          borderColor: theme.colors.error[300],
          iconColor: theme.colors.error[600],
          icon: '🚨',
        };
      case 'error':
        return {
          backgroundColor: theme.colors.error[50],
          borderColor: theme.colors.error[200],
          iconColor: theme.colors.error[500],
          icon: '❌',
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.warning[50],
          borderColor: theme.colors.warning[200],
          iconColor: theme.colors.warning[600],
          icon: '⚠️',
        };
      default:
        return {
          backgroundColor: theme.colors.neutral[50],
          borderColor: theme.colors.neutral[200],
          iconColor: theme.colors.neutral[600],
          icon: 'ℹ️',
        };
    }
  };

  const activeNotifications = notifications.filter(n => !n.dismissed);
  const dismissedNotifications = notifications.filter(n => n.dismissed);

  const renderNotification = (notification: StabilityNotification) => {
    const style = getNotificationStyle(notification.type);
    
    return (
      <View
        key={notification.id}
        style={[
          styles.notificationCard,
          {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
          },
          notification.dismissed && styles.dismissedNotification,
        ]}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <Text style={styles.notificationIconText}>{style.icon}</Text>
          </View>
          <View style={styles.notificationInfo}>
            <Text style={styles.notificationTime}>
              {formatTime(notification.timestamp)}
            </Text>
            <Text style={styles.notificationType}>
              {notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}
            </Text>
          </View>
          {!notification.dismissed && (
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => onDismiss(notification.id)}
            >
              <Text style={styles.dismissButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.notificationMessage}>
          {notification.message}
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>✅</Text>
      <Text style={styles.emptyStateTitle}>No Stability Issues</Text>
      <Text style={styles.emptyStateText}>
        Your app is running smoothly with no stability alerts.
      </Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          <Text style={styles.sectionBadge}>
            {activeNotifications.length}
          </Text>
        </View>
        
        {activeNotifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <View style={styles.notificationsList}>
            {activeNotifications.map(renderNotification)}
          </View>
        )}
      </View>

      {dismissedNotifications.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dismissed Alerts</Text>
            <View style={styles.sectionActions}>
              <Text style={styles.sectionBadge}>
                {dismissedNotifications.length}
              </Text>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={onClearDismissed}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.notificationsList}>
            {dismissedNotifications.map(renderNotification)}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Information</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Alert Types</Text>
          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🚨</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Critical</Text>
                <Text style={styles.infoDescription}>
                  Severe stability issues requiring immediate attention
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>❌</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Error</Text>
                <Text style={styles.infoDescription}>
                  Significant stability problems that need addressing
                </Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>⚠️</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Warning</Text>
                <Text style={styles.infoDescription}>
                  Minor stability issues worth monitoring
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
  },
  section: {
    padding: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing[3],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[900],
  },
  sectionBadge: {
    backgroundColor: theme.colors.primary[100],
    color: theme.colors.primary[700],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    minWidth: 24,
    textAlign: 'center',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: theme.colors.neutral[200],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing[2],
  },
  clearButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  notificationsList: {
    gap: theme.spacing[3],
  },
  notificationCard: {
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  dismissedNotification: {
    opacity: 0.6,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing[2],
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing[3],
  },
  notificationIconText: {
    fontSize: theme.typography.fontSize.md,
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  notificationType: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[800],
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: 'capitalize',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.neutral[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.neutral[600],
    fontWeight: theme.typography.fontWeight.bold,
  },
  notificationMessage: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[800],
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing[6],
    backgroundColor: theme.colors.success[50],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.success[200],
  },
  emptyStateIcon: {
    fontSize: theme.typography.fontSize['3xl'],
    marginBottom: theme.spacing[2],
  },
  emptyStateTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.success[800],
    marginBottom: theme.spacing[2],
  },
  emptyStateText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success[700],
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
  },
  infoTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[3],
  },
  infoList: {
    gap: theme.spacing[3],
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: theme.typography.fontSize.md,
    marginRight: theme.spacing[3],
    width: 24,
    textAlign: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[1],
  },
  infoDescription: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
    lineHeight: 16,
  },
});