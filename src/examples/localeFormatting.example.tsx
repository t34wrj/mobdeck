/**
 * Example demonstrating locale-aware date formatting
 * Shows how the date format automatically adapts to device locale settings
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocaleDateFormatter } from '../hooks/useLocaleSettings';
import { dateFormatter, DateFormatPattern } from '../utils/dateFormatter';

export const LocaleFormattingExample: React.FC = () => {
  const { formatDate, locale, dateFormat } = useLocaleDateFormatter();
  
  // Example date
  const testDate = new Date('2025-07-10T14:30:00');
  
  // Format examples
  const examples = [
    {
      label: 'Default format',
      value: formatDate(testDate),
      description: 'Uses device locale automatically',
    },
    {
      label: 'Without year',
      value: formatDate(testDate, { includeYear: false }),
      description: 'Omits the year from display',
    },
    {
      label: 'With time',
      value: formatDate(testDate, { includeTime: true }),
      description: 'Includes time in the format',
    },
    {
      label: 'Relative format',
      value: dateFormatter.formatRelative(new Date()),
      description: 'Shows "Just now" for recent dates',
    },
  ];
  
  // Demonstrate different locale formats
  const localeExamples = [
    {
      locale: 'en-US',
      format: DateFormatPattern.US,
      example: '07/10/2025',
    },
    {
      locale: 'en-GB',
      format: DateFormatPattern.EU,
      example: '10/07/2025',
    },
    {
      locale: 'fr-FR',
      format: DateFormatPattern.EU,
      example: '10/07/2025',
    },
  ];
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Locale-Aware Date Formatting</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Device Settings</Text>
        <Text style={styles.info}>Locale: {locale}</Text>
        <Text style={styles.info}>Date Format: {dateFormat}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Formatting Examples</Text>
        {examples.map((example, index) => (
          <View key={index} style={styles.example}>
            <Text style={styles.label}>{example.label}:</Text>
            <Text style={styles.value}>{example.value}</Text>
            <Text style={styles.description}>{example.description}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Locale Format Patterns</Text>
        {localeExamples.map((item, index) => (
          <View key={index} style={styles.localeExample}>
            <Text style={styles.locale}>{item.locale}</Text>
            <Text style={styles.format}>{item.format}</Text>
            <Text style={styles.exampleDate}>{item.example}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.section}>
        <Text style={styles.note}>
          Note: The date format automatically adjusts based on your Android system 
          locale settings. US locales use MM/DD/YYYY format, while most other 
          locales use DD/MM/YYYY format.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#444',
  },
  info: {
    fontSize: 16,
    marginBottom: 5,
    color: '#666',
  },
  example: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 2,
  },
  description: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  localeExample: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locale: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  format: {
    flex: 1,
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  exampleDate: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'right',
  },
  note: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});