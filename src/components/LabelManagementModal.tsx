import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SimpleText as Text } from './SimpleText';
import { SimpleButton as Button } from './SimpleButton';
import { theme } from './theme';
import { readeckApiService } from '../services/ReadeckApiService';
import { Label } from '../types/labels';

export interface LabelManagementModalProps {
  visible: boolean;
  onClose: () => void;
  articleId: string;
  articleTitle: string;
  currentLabels?: string[];
  onLabelsChanged?: (labelIds: string[]) => void;
}

export const LabelManagementModal: React.FC<LabelManagementModalProps> = ({
  visible,
  onClose,
  articleId,
  articleTitle,
  currentLabels = [],
  onLabelsChanged,
}) => {
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] =
    useState<string[]>(currentLabels);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(theme.colors.primary[500]);
  const [saving, setSaving] = useState(false);

  // Predefined colors for new labels - using theme colors
  const LABEL_COLORS = [
    theme.colors.primary[500], // Giants Orange
    theme.colors.secondary[500], // Xanthous Yellow
    theme.colors.accent[500], // Tiffany Blue
    theme.colors.success[600], // Castleton Green
    theme.colors.error[500], // Error Red
    theme.colors.dark[600], // Yale Blue (darker shade)
    theme.colors.warning[600], // Warning Orange
    theme.colors.info[600], // Info Cyan
  ];

  // Load available labels
  const loadLabels = useCallback(async () => {
    if (!visible) return;

    try {
      setLoading(true);
      const response = await readeckApiService.getLabels({
        limit: 100,
        searchQuery: searchQuery || undefined,
        sortBy: 'name',
        sortOrder: 'asc',
      });
      setAvailableLabels(response.items);
    } catch (error) {
      console.error('Failed to load labels:', error);
      const errorMessage =
        error?.message || 'Failed to load labels. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }, [visible, searchQuery]);

  // Load labels when modal opens or search changes
  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setCreateMode(false);
      setNewLabelName('');
      setNewLabelColor(theme.colors.primary[500]);
      setSelectedLabelIds(currentLabels);
    }
  }, [visible, currentLabels]);

  // Handle label selection toggle
  const handleLabelToggle = useCallback((labelId: string) => {
    setSelectedLabelIds(prev => {
      if (prev.includes(labelId)) {
        return prev.filter(id => id !== labelId);
      } else {
        return [...prev, labelId];
      }
    });
  }, []);

  // Handle creating a new label
  const handleCreateLabel = useCallback(async () => {
    if (!newLabelName.trim()) {
      Alert.alert('Error', 'Label name is required.');
      return;
    }

    try {
      setLoading(true);
      const newLabel = await readeckApiService.createLabel({
        name: newLabelName.trim(),
        color: newLabelColor,
      });

      // Add to available labels and select it
      setAvailableLabels(prev => [newLabel, ...prev]);
      setSelectedLabelIds(prev => [...prev, newLabel.id]);

      // Reset form
      setNewLabelName('');
      setCreateMode(false);

      Alert.alert('Success', `Label "${newLabel.name}" created successfully!`);
    } catch (error) {
      console.error('Failed to create label:', error);
      const errorMessage =
        error?.message || 'Failed to create label. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }, [newLabelName, newLabelColor]);

  // Handle saving changes
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);

      // Determine which labels to add and remove
      const labelsToAdd = selectedLabelIds.filter(
        id => !currentLabels.includes(id)
      );
      const labelsToRemove = currentLabels.filter(
        id => !selectedLabelIds.includes(id)
      );

      // Execute label assignments/removals
      const promises: Promise<void>[] = [];

      labelsToAdd.forEach(labelId => {
        promises.push(readeckApiService.assignLabel({ labelId, articleId }));
      });

      labelsToRemove.forEach(labelId => {
        promises.push(readeckApiService.removeLabel({ labelId, articleId }));
      });

      await Promise.all(promises);

      // Notify parent of changes
      onLabelsChanged?.(selectedLabelIds);

      Alert.alert('Success', 'Article labels updated successfully!', [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (error) {
      console.error('Failed to update labels:', error);
      const errorMessage =
        error?.message || 'Failed to update labels. Please try again.';
      Alert.alert('Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  }, [selectedLabelIds, currentLabels, articleId, onLabelsChanged, onClose]);

  // Render label item
  const renderLabelItem = useCallback(
    (label: Label) => {
      const isSelected = selectedLabelIds.includes(label.id);

      return (
        <TouchableOpacity
          key={label.id}
          style={[styles.labelItem, isSelected && styles.selectedLabelItem]}
          onPress={() => handleLabelToggle(label.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.labelColorIndicator,
              { backgroundColor: label.color || theme.colors.neutral[400] },
            ]}
          />
          <View style={styles.labelContent}>
            <Text
              variant='body'
              style={[styles.labelName, isSelected && styles.selectedLabelName]}
            >
              {label.name}
            </Text>
            <Text variant='caption' style={styles.labelCount}>
              {label.articleCount} articles
            </Text>
          </View>
          <View style={[styles.checkbox, isSelected && styles.checkedCheckbox]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedLabelIds, handleLabelToggle]
  );

  // Render color selector
  const renderColorSelector = () => (
    <View style={styles.colorSelectorContainer}>
      <Text variant='body' style={styles.colorSelectorLabel}>
        Color:
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.colorSelector}
      >
        {LABEL_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              newLabelColor === color && styles.selectedColorOption,
            ]}
            onPress={() => setNewLabelColor(color)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <StatusBar
        backgroundColor={theme.colors.neutral[100]}
        barStyle='dark-content'
      />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text variant='body' style={styles.closeButtonText}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text variant='h3' style={styles.headerTitle}>
            Manage Labels
          </Text>
          <Button
            variant='ghost'
            size='sm'
            onPress={handleSave}
            loading={saving}
            disabled={loading}
          >
            <Text>Save</Text>
          </Button>
        </View>

        {/* Article Info */}
        <View style={styles.articleInfo}>
          <Text variant='caption' style={styles.articleLabel}>
            Article:
          </Text>
          <Text
            variant='body'
            numberOfLines={2}
            ellipsizeMode='tail'
            style={styles.articleTitle}
          >
            {articleTitle}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder='Search labels...'
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.neutral[500]}
          />
        </View>

        {/* Create New Label Section */}
        {createMode ? (
          <View style={styles.createLabelSection}>
            <Text variant='h3' style={styles.createLabelTitle}>
              Create New Label
            </Text>
            <TextInput
              style={styles.newLabelInput}
              placeholder='Label name'
              value={newLabelName}
              onChangeText={setNewLabelName}
              placeholderTextColor={theme.colors.neutral[500]}
              maxLength={50}
            />
            {renderColorSelector()}
            <View style={styles.createLabelActions}>
              <Button
                variant='outline'
                size='sm'
                onPress={() => setCreateMode(false)}
                style={styles.createLabelButton}
              >
                <Text>Cancel</Text>
              </Button>
              <Button
                variant='primary'
                size='sm'
                onPress={handleCreateLabel}
                loading={loading}
                style={styles.createLabelButton}
              >
                <Text>Create</Text>
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.createButtonContainer}>
            <Button
              variant='outline'
              size='sm'
              onPress={() => setCreateMode(true)}
              style={styles.createNewButton}
            >
              <Text>+ Create New Label</Text>
            </Button>
          </View>
        )}

        {/* Labels List */}
        <ScrollView
          style={styles.labelsList}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size='large'
                color={theme.colors.primary[500]}
              />
              <Text variant='body' style={styles.loadingText}>
                Loading labels...
              </Text>
            </View>
          ) : availableLabels.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text variant='body' style={styles.emptyText}>
                {searchQuery ? 'No labels found' : 'No labels available'}
              </Text>
              <Text variant='caption' style={styles.emptySubtext}>
                {searchQuery
                  ? `No labels match "${searchQuery}"`
                  : 'Create your first label to get started'}
              </Text>
            </View>
          ) : (
            availableLabels.map(renderLabelItem)
          )}
        </ScrollView>

        {/* Selected Labels Summary */}
        {selectedLabelIds.length > 0 && (
          <View style={styles.summaryContainer}>
            <Text variant='caption' style={styles.summaryText}>
              {selectedLabelIds.length} label
              {selectedLabelIds.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[100],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  closeButton: {
    padding: theme.spacing[1],
  },
  closeButtonText: {
    color: theme.colors.primary[600],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.neutral[900],
  },
  articleInfo: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.info[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  articleLabel: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing[1],
  },
  articleTitle: {
    color: theme.colors.neutral[800],
  },
  searchContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    backgroundColor: theme.colors.neutral[100],
  },
  searchInput: {
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
  },
  createLabelSection: {
    padding: theme.spacing[4],
    backgroundColor: theme.colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[200],
  },
  createLabelTitle: {
    marginBottom: theme.spacing[3],
    color: theme.colors.primary[700],
  },
  newLabelInput: {
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    fontSize: theme.typography.fontSize.base,
    borderWidth: 1,
    borderColor: theme.colors.neutral[300],
    marginBottom: theme.spacing[3],
  },
  colorSelectorContainer: {
    marginBottom: theme.spacing[3],
  },
  colorSelectorLabel: {
    marginBottom: theme.spacing[2],
    color: theme.colors.neutral[700],
  },
  colorSelector: {
    flexDirection: 'row',
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing[2],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: theme.colors.neutral[900],
  },
  createLabelActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing[2],
  },
  createLabelButton: {
    minWidth: 80,
  },
  createButtonContainer: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
  },
  createNewButton: {
    alignSelf: 'flex-start',
  },
  labelsList: {
    flex: 1,
    paddingHorizontal: theme.spacing[4],
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    marginVertical: theme.spacing[1],
    backgroundColor: theme.colors.neutral[50],
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.neutral[200],
  },
  selectedLabelItem: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[300],
  },
  labelColorIndicator: {
    width: 12,
    height: 12,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing[3],
  },
  labelContent: {
    flex: 1,
  },
  labelName: {
    color: theme.colors.neutral[800],
    marginBottom: theme.spacing[1],
  },
  selectedLabelName: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  labelCount: {
    color: theme.colors.neutral[500],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: theme.colors.neutral[400],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.neutral[50],
  },
  checkedCheckbox: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  checkmark: {
    color: theme.colors.neutral[50],
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  loadingText: {
    marginTop: theme.spacing[2],
    color: theme.colors.neutral[600],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
  },
  emptyText: {
    color: theme.colors.neutral[600],
    marginBottom: theme.spacing[1],
  },
  emptySubtext: {
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
  summaryContainer: {
    padding: theme.spacing[3],
    backgroundColor: theme.colors.primary[50],
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[200],
    alignItems: 'center',
  },
  summaryText: {
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
});

export default LabelManagementModal;
