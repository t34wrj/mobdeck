import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from './theme';
import { StabilityMetrics as StabilityMetricsType, StabilityThresholds, PerformanceMetrics } from '../utils/stabilityMonitoring';

interface StabilityMetricsProps {
  metrics: StabilityMetricsType | null;
  performanceHistory: PerformanceMetrics[];
  thresholds: StabilityThresholds | null;
}

// const { width } = Dimensions.get('window');

export const StabilityMetrics: React.FC<StabilityMetricsProps> = ({
  metrics,
  performanceHistory,
  thresholds,
}) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return theme.colors.success[600];
    if (score >= 60) return theme.colors.warning[600];
    return theme.colors.error[600];
  };

  const getScoreBackground = (score: number): string => {
    if (score >= 80) return theme.colors.success[50];
    if (score >= 60) return theme.colors.warning[50];
    return theme.colors.error[50];
  };

  const renderMetricCard = (
    title: string,
    value: string,
    subtitle?: string,
    color?: string,
    backgroundColor?: string,
    isScore?: boolean
  ) => (
    <View style={[
      styles.metricCard,
      backgroundColor && { backgroundColor },
      isScore && styles.scoreCard,
    ]}>
      <Text style={[
        styles.metricValue,
        color && { color },
        isScore && styles.scoreValue,
      ]}>
        {value}
      </Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {subtitle && (
        <Text style={styles.metricSubtitle}>{subtitle}</Text>
      )}
    </View>
  );

  const renderPerformanceChart = () => {
    if (performanceHistory.length === 0) {
      return (
        <View style={styles.chartEmpty}>
          <Text style={styles.chartEmptyText}>No performance data available</Text>
        </View>
      );
    }

    const recent = performanceHistory.slice(-20);
    const maxMemory = Math.max(...recent.map(m => m.memoryUsage));
    // const maxCPU = Math.max(...recent.map(m => m.cpuUsage));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Performance History (Last 20 samples)</Text>
        <View style={styles.chart}>
          <View style={styles.chartYAxis}>
            <Text style={styles.chartYLabel}>100%</Text>
            <Text style={styles.chartYLabel}>50%</Text>
            <Text style={styles.chartYLabel}>0%</Text>
          </View>
          <View style={styles.chartArea}>
            {recent.map((sample, index) => (
              <View key={index} style={styles.chartBar}>
                <View style={[
                  styles.chartBarMemory,
                  { height: `${(sample.memoryUsage / maxMemory) * 100}%` }
                ]} />
                <View style={[
                  styles.chartBarCPU,
                  { height: `${sample.cpuUsage}%` }
                ]} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.colors.primary[500] }]} />
            <Text style={styles.legendText}>Memory</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: theme.colors.secondary[500] }]} />
            <Text style={styles.legendText}>CPU</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stability Scores</Text>
        <View style={styles.scoresContainer}>
          {metrics && (
            <>
              {renderMetricCard(
                'Stability Score',
                metrics.stabilityScore.toFixed(1),
                'Overall app stability',
                getScoreColor(metrics.stabilityScore),
                getScoreBackground(metrics.stabilityScore),
                true
              )}
              {renderMetricCard(
                'Performance Score',
                metrics.performanceScore.toFixed(1),
                'App performance rating',
                getScoreColor(metrics.performanceScore),
                getScoreBackground(metrics.performanceScore),
                true
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stability Metrics</Text>
        <View style={styles.metricsContainer}>
          {metrics && (
            <>
              {renderMetricCard(
                'Uptime',
                formatDuration(metrics.uptime),
                'Current session uptime'
              )}
              {renderMetricCard(
                'Session Duration',
                formatDuration(metrics.sessionDuration),
                'Current session length'
              )}
              {renderMetricCard(
                'Crash Frequency',
                metrics.crashFrequency.toString(),
                'Crashes in last 24h'
              )}
              {renderMetricCard(
                'Error Rate',
                `${(metrics.errorRate * 100).toFixed(2)}%`,
                'Errors per session'
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Performance</Text>
        {performanceHistory.length > 0 && (
          <View style={styles.performanceStats}>
            <Text style={styles.performanceStatsTitle}>Current Averages (Last 10 samples)</Text>
            {(() => {
              const recent = performanceHistory.slice(-10);
              const avgMemory = recent.reduce((sum, m) => sum + m.memoryUsage, 0) / recent.length;
              const avgCPU = recent.reduce((sum, m) => sum + m.cpuUsage, 0) / recent.length;
              const avgRender = recent.reduce((sum, m) => sum + m.renderTime, 0) / recent.length;
              const avgNetwork = recent.reduce((sum, m) => sum + m.networkLatency, 0) / recent.length;

              return (
                <View style={styles.performanceStatsGrid}>
                  {renderMetricCard('Memory', formatBytes(avgMemory), 'Average usage')}
                  {renderMetricCard('CPU', `${avgCPU.toFixed(1)}%`, 'Average usage')}
                  {renderMetricCard('Render', `${avgRender.toFixed(1)}ms`, 'Average time')}
                  {renderMetricCard('Network', `${avgNetwork.toFixed(0)}ms`, 'Average latency')}
                </View>
              );
            })()}
          </View>
        )}
        {renderPerformanceChart()}
      </View>

      {thresholds && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monitoring Thresholds</Text>
          <View style={styles.thresholdsContainer}>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Max Crash Frequency</Text>
              <Text style={styles.thresholdValue}>{thresholds.maxCrashFrequency}</Text>
            </View>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Max Error Rate</Text>
              <Text style={styles.thresholdValue}>{(thresholds.maxErrorRate * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Min Performance Score</Text>
              <Text style={styles.thresholdValue}>{thresholds.minPerformanceScore}</Text>
            </View>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Min Stability Score</Text>
              <Text style={styles.thresholdValue}>{thresholds.minStabilityScore}</Text>
            </View>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Max Memory Usage</Text>
              <Text style={styles.thresholdValue}>{formatBytes(thresholds.maxMemoryUsage)}</Text>
            </View>
            <View style={styles.thresholdItem}>
              <Text style={styles.thresholdLabel}>Max Render Time</Text>
              <Text style={styles.thresholdValue}>{thresholds.maxRenderTime.toFixed(1)}ms</Text>
            </View>
          </View>
        </View>
      )}
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
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[900],
    marginBottom: theme.spacing[3],
  },
  scoresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[2],
    alignItems: 'center',
    width: '48%',
  },
  scoreCard: {
    width: '48%',
    padding: theme.spacing[4],
  },
  metricValue: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing[1],
  },
  scoreValue: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
  },
  metricTitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
    textAlign: 'center',
    fontWeight: theme.typography.fontWeight.semibold,
  },
  metricSubtitle: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[500],
    textAlign: 'center',
    marginTop: theme.spacing[1],
  },
  performanceStats: {
    marginBottom: theme.spacing[4],
  },
  performanceStatsTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing[2],
  },
  performanceStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chartContainer: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing[2],
  },
  chartTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing[2],
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    height: 120,
    marginBottom: theme.spacing[2],
  },
  chartYAxis: {
    width: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: theme.spacing[2],
  },
  chartYLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing[1],
  },
  chartBar: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartBarMemory: {
    flex: 1,
    backgroundColor: theme.colors.primary[500],
    marginRight: 1,
    borderRadius: 2,
    minHeight: 2,
  },
  chartBarCPU: {
    flex: 1,
    backgroundColor: theme.colors.secondary[500],
    borderRadius: 2,
    minHeight: 2,
  },
  chartEmpty: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  chartEmptyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[600],
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing[2],
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: theme.spacing[1],
  },
  legendText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.neutral[600],
  },
  thresholdsContainer: {
    backgroundColor: theme.colors.neutral[100],
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.md,
  },
  thresholdItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  thresholdLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[700],
    flex: 1,
  },
  thresholdValue: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.neutral[900],
    fontWeight: theme.typography.fontWeight.semibold,
  },
});