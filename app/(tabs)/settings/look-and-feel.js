// app/(tabs)/settings/look-and-feels.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';

export default function LookAndFeel() {
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(18);
  const [fontColor, setFontColor] = useState('black');
  const [backgroundColor, setBackgroundColor] = useState('white');
  
  // Modal states
  const [showFontColorModal, setShowFontColorModal] = useState(false);
  const [showBackgroundColorModal, setShowBackgroundColorModal] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);

  const fonts = [
    'System',
    'Verdana', 
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
  ];

  // Font Dropdown Modal Component (add this with your other components)
const FontDropdownModal = ({ visible, onClose, selectedFont, onFontSelect, fonts, getFontFamily }) => (
  <Modal
    visible={visible}
    transparent={true}
    animationType="slide"
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Font</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.fontOptionsContainer}>
          {fonts.map((font) => (
            <TouchableOpacity
              key={font}
              style={[
                styles.fontDropdownOption,
                selectedFont === font && styles.selectedFontDropdownOption,
              ]}
              onPress={() => {
                onFontSelect(font);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.fontDropdownText,
                  { fontFamily: getFontFamily(font) },
                  selectedFont === font && styles.selectedFontDropdownText,
                ]}
              >
                {font}
              </Text>
              {selectedFont === font && (
                <Text style={styles.fontCheckmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

  // Color options
  const colorOptions = [
    { name: 'Black', value: 'black' },
    { name: 'Red', value: 'red' },
    { name: 'Green', value: 'green' },
    { name: 'Blue', value: 'blue' },
    { name: 'White', value: 'white' },
  ];

  const getFontFamily = (font) => {
    switch (font) {
      case 'System':
        return Platform.OS === 'ios' ? 'System' : 'Roboto';
      case 'Verdana':
        return Platform.OS === 'ios' ? 'Verdana' : 'sans-serif';
      case 'Arial':
        return Platform.OS === 'ios' ? 'Arial' : 'sans-serif';
      case 'Times New Roman':
        return Platform.OS === 'ios' ? 'Times New Roman' : 'serif';
      case 'Courier New':
        return Platform.OS === 'ios' ? 'Courier New' : 'monospace';
      case 'Georgia':
        return Platform.OS === 'ios' ? 'Georgia' : 'serif';
      default:
        return Platform.OS === 'ios' ? 'System' : 'Roboto';
    }
  };

  // Color picker modal component
  const ColorPickerModal = ({ visible, onClose, title, selectedColor, onColorSelect }) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.colorOptionsContainer}>
            {colorOptions.map((color) => (
              <TouchableOpacity
                key={color.value}
                style={[
                  styles.colorOption,
                  { backgroundColor: color.value },
                  selectedColor === color.value && styles.selectedColorOption,
                  color.value === 'white' && styles.whiteColorBorder,
                ]}
                onPress={() => {
                  onColorSelect(color.value);
                  onClose();
                }}
              >
                {selectedColor === color.value && (
                  <Text style={[
                    styles.checkmark,
                    { color: color.value === 'white' || color.value === 'yellow' ? 'black' : 'white' }
                  ]}>
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.selectedColorText}>
            Selected: {colorOptions.find(c => c.value === selectedColor)?.name || selectedColor}
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Color picker component
  const ColorPicker = ({ title, selectedColor, onColorChange }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.colorOptionsContainer}>
        {colorOptions.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.colorOption,
              { backgroundColor: color.value },
              selectedColor === color.value && styles.selectedColorOption,
              color.value === 'white' && styles.whiteColorBorder,
            ]}
            onPress={() => onColorChange(color.value)}
          >
            {selectedColor === color.value && (
              <Text style={[
                styles.checkmark,
                { color: color.value === 'white' || color.value === 'yellow' ? 'black' : 'white' }
              ]}>
                ✓
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.selectedColorText}>
        Selected: {colorOptions.find(c => c.value === selectedColor)?.name || selectedColor}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>

      {/* Preview Area - Thank you! message */}
      <View style={[styles.previewArea, { backgroundColor }]}>
        <Text
          style={[
            styles.previewText,
            {
              fontFamily: getFontFamily(selectedFont),
              fontSize: fontSize,
              color: fontColor,
            },
          ]}
        >
          Thank you!
        </Text>
      </View>

      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false}>
        {/* Font Selection */}
        <View style={styles.section}>
  <Text style={styles.sectionTitle}>Font</Text>
  <TouchableOpacity 
    style={styles.fontDropdownButton}
    onPress={() => setShowFontModal(true)}
  >
    <View style={styles.fontDropdownContent}>
      <Text
        style={[
          styles.fontDropdownButtonText,
          { fontFamily: getFontFamily(selectedFont) }
        ]}
      >
        {selectedFont}
      </Text>
      <Text style={styles.dropdownArrow}>▼</Text>
    </View>
  </TouchableOpacity>
</View>
<FontDropdownModal
  visible={showFontModal}
  onClose={() => setShowFontModal(false)}
  selectedFont={selectedFont}
  onFontSelect={setSelectedFont}
  fonts={fonts}
  getFontFamily={getFontFamily}
/>
        {/* Size Slider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Size</Text>
          <View style={styles.sliderContainer}>
            <Text style={styles.sizeLabel}>12</Text>
            <Slider
              style={styles.slider}
              minimumValue={12}
              maximumValue={48}
              value={fontSize}
              onValueChange={setFontSize}
              step={1}
              minimumTrackTintColor="#006AFF"
              maximumTrackTintColor="#D1D1D1"
              thumbStyle={styles.sliderThumb}
            />
            <Text style={styles.sizeLabel}>48</Text>
          </View>
          <Text style={styles.currentSize}>{Math.round(fontSize)}pt</Text>
        </View>

        {/* Color Selection - Side by Side */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colors</Text>
          <View style={styles.colorButtonRow}>
            {/* Font Color Button */}
            <View style={styles.colorButtonContainer}>
              <Text style={styles.colorSubTitle}>Font Color</Text>
              <TouchableOpacity 
                style={styles.colorButton}
                onPress={() => setShowFontColorModal(true)}
              >
                <View style={styles.colorButtonContent}>
                  <View style={[
                    styles.colorPreview, 
                    { backgroundColor: fontColor },
                    fontColor === 'white' && styles.whiteColorBorder,
                  ]} />
                  <Text style={styles.colorButtonText}>
                    {colorOptions.find(c => c.value === fontColor)?.name || fontColor}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Background Color Button */}
            <View style={styles.colorButtonContainer}>
              <Text style={styles.colorSubTitle}>Background Color</Text>
              <TouchableOpacity 
                style={styles.colorButton}
                onPress={() => setShowBackgroundColorModal(true)}
              >
                <View style={styles.colorButtonContent}>
                  <View style={[
                    styles.colorPreview, 
                    { backgroundColor: backgroundColor },
                    backgroundColor === 'white' && styles.whiteColorBorder,
                  ]} />
                  <Text style={styles.colorButtonText}>
                    {colorOptions.find(c => c.value === backgroundColor)?.name || backgroundColor}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Color Picker Modals */}
      <ColorPickerModal
        visible={showFontColorModal}
        onClose={() => setShowFontColorModal(false)}
        title="Select Font Color"
        selectedColor={fontColor}
        onColorSelect={setFontColor}
      />

      <ColorPickerModal
        visible={showBackgroundColorModal}
        onClose={() => setShowBackgroundColorModal(false)}
        title="Select Background Color"
        selectedColor={backgroundColor}
        onColorSelect={setBackgroundColor}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },

  previewArea: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  previewText: {
    fontSize: 18,
    fontWeight: '500',
  },
  controlsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 100, 
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sizeLabel: {
    fontSize: 12,
    color: 'black',
    minWidth: 20,
    textAlign: 'center',
  },
  currentSize: {
    fontSize: 12,
    color: 'black',
    textAlign: 'center',
    marginTop: 4,
  },

  // Color picker styles
  colorButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 8,
  },
  colorButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 30,
    height: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'grey',
  },
  colorButtonText: {
    fontSize: 16,
    color: 'black',
    fontWeight: '550',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },

  colorOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    justifyContent: 'center',
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  whiteColorBorder: {
    borderColor: '#ddd',
    borderWidth: 2,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  selectedColorText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  colorButtonRow: {
    flexDirection: 'row',
    gap: 20,
  },
  colorButtonContainer: {
    flex: 1,
  },
  colorSubTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  fontDropdownButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 8,
  },
  fontDropdownContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fontDropdownButtonText: {
    fontSize: 16,
    color: 'black',
    fontWeight: '500',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
  },
  fontOptionsContainer: {
    maxHeight: 300,
  },
  fontDropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedFontDropdownOption: {
    backgroundColor: '#f0f8ff',
  },
  fontDropdownText: {
    fontSize: 16,
    color: '#333',
  },
  selectedFontDropdownText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  fontCheckmark: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});