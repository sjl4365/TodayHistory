// app/(tabs)/settings/look-and-feels.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Image,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const STORAGE_KEY_FONT = '@app_font';
const STORAGE_KEY_FONT_SIZE = '@app_font_size';
const STORAGE_KEY_FONT_COLOR = '@app_font_color';
const STORAGE_KEY_BG_COLOR = '@app_bg_color';
const STORAGE_KEY_BG_IMAGE = '@app_bg_image';

export default function LookAndFeel() {
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(18);
  const [fontColor, setFontColor] = useState('black');
  const [backgroundColor, setBackgroundColor] = useState('white');
  const [backgroundImage, setBackgroundImage] = useState(null);
  
  const [showFontModal, setShowFontModal] = useState(false);

  const fonts = [
    'System',
    'Verdana', 
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
  ];

  // Font Color options (includes Brown)
  const fontcolorOptions = [
    // Basic colors (keeping black and white for contrast)
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    
    // Rainbow colors in order: ROYGBIV
    { name: 'Red', value: '#FF0000' },
    { name: 'Orange', value: '#FF8000' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Indigo', value: '#4B0082' },
    { name: 'Violet', value: '#8A2BE2' },
    
    // Additional rainbow variations
    { name: 'Pink', value: '#FF69B4' },
    { name: 'Cyan', value: '#00FFFF' },
    { name: 'Magenta', value: '#FF00FF' },
    { name: 'Lime', value: '#32CD32' },
    { name: 'Brown', value: '#8B4513' },
  ];

  // Background Color options (without Brown, has upload button instead)
  const backcolorOptions = [
    // Basic colors (keeping black and white for contrast)
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    
    // Rainbow colors in order: ROYGBIV
    { name: 'Red', value: '#FF0000' },
    { name: 'Orange', value: '#FF8000' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Indigo', value: '#4B0082' },
    { name: 'Violet', value: '#8A2BE2' },
    
    // Additional rainbow variations
    { name: 'Pink', value: '#FF69B4' },
    { name: 'Cyan', value: '#00FFFF' },
    { name: 'Magenta', value: '#FF00FF' },
    { name: 'Lime', value: '#32CD32' },
  ];


  // Font Dropdown Modal Component
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

  // Font Color Palette Component
  const FontColorPalette = ({ title, selectedColor, onColorChange }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.inlineColorContainer}>
        {fontcolorOptions.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.inlineColorOption,
              { backgroundColor: color.value },
              (color.value === '#FFFFFF' && selectedColor !== color.value) && styles.whiteColorBorder,
              selectedColor === color.value && styles.selectedInlineColorOption,
            ]}
            onPress={() => onColorChange(color.value)}
          >
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // Background Color Palette Component (with upload button)
  const BackColorPalette = ({ title, selectedColor, onColorChange }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.inlineColorContainer}>
        {backcolorOptions.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.inlineColorOption,
              { backgroundColor: color.value },
              (color.value === '#FFFFFF' && selectedColor !== color.value) && styles.whiteColorBorder,
              selectedColor === color.value && styles.selectedInlineColorOption,
            ]}
            onPress={() => {
              onColorChange(color.value);
              setBackgroundImage(null);
            }}
          >
          </TouchableOpacity>
        ))}
        
        {/* Upload Image Button */}
        <TouchableOpacity
          style={[
            styles.inlineColorOption,
            styles.uploadImageButton,
            backgroundImage && styles.selectedInlineColorOption,
          ]}
          onPress={pickImage}
        >
          <Text style={styles.uploadImageIcon}>📷</Text>
        </TouchableOpacity>
      </View>
      
      {/* Show selected image preview */}
      {backgroundImage && (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: backgroundImage }}
            style={styles.imagePreview}
          />
          <TouchableOpacity 
            style={styles.removeImageButton}
            onPress={removeBackgroundImage}
          >
            <Text style={styles.removeImageButtonText}>✕ Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.cancelled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        setBackgroundImage(imageUri);
        await AsyncStorage.setItem(STORAGE_KEY_BG_IMAGE, imageUri);
        // Clear color when image is set
        setBackgroundColor(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const removeBackgroundImage = async () => {
    setBackgroundImage(null);
    await AsyncStorage.removeItem(STORAGE_KEY_BG_IMAGE);
    setBackgroundColor('white');
  };
  
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedFont = await AsyncStorage.getItem(STORAGE_KEY_FONT);
      const savedSize = await AsyncStorage.getItem(STORAGE_KEY_FONT_SIZE);
      const savedFontColor = await AsyncStorage.getItem(STORAGE_KEY_FONT_COLOR);
      const savedBgColor = await AsyncStorage.getItem(STORAGE_KEY_BG_COLOR);
      const savedBgImage = await AsyncStorage.getItem(STORAGE_KEY_BG_IMAGE);
      
      if (savedFont) setSelectedFont(savedFont);
      if (savedSize) setFontSize(parseInt(savedSize));
      if (savedFontColor) setFontColor(savedFontColor);
      if (savedBgColor) setBackgroundColor(savedBgColor);
      if (savedBgImage) setBackgroundImage(savedBgImage);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Save whenever settings change
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_FONT, selectedFont).catch(() => {});
  }, [selectedFont]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_FONT_SIZE, fontSize.toString()).catch(() => {});
  }, [fontSize]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_FONT_COLOR, fontColor).catch(() => {});
  }, [fontColor]);

  useEffect(() => {
    if (backgroundColor) {
      AsyncStorage.setItem(STORAGE_KEY_BG_COLOR, backgroundColor).catch(() => {});
    }
  }, [backgroundColor]);

  return (
    <View style={styles.container}>

      {/* Preview Area - Thank you! message */}
      <View
        style={[
          styles.previewArea,
          backgroundImage ? { backgroundColor: 'transparent' } : { backgroundColor },
        ]}
      >
        {backgroundImage && (
          <Image
            source={{ uri: backgroundImage }}
            style={styles.previewImage}
          />
        )}
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
            />
            <Text style={styles.sizeLabel}>48</Text>
          </View>
          <Text style={styles.currentSize}>{Math.round(fontSize)}pt</Text>
        </View>

        {/* Font Color Palette */}
        <FontColorPalette 
          title="Font Color"
          selectedColor={fontColor}
          onColorChange={setFontColor}
        />

        {/* Background Color Palette with Image Upload */}
        <BackColorPalette 
          title="Background Color"
          selectedColor={backgroundImage ? null : backgroundColor}
          onColorChange={setBackgroundColor}
        />

      </ScrollView>

      {/* Font Modal */}
      <FontDropdownModal
        visible={showFontModal}
        onClose={() => setShowFontModal(false)}
        selectedFont={selectedFont}
        onFontSelect={setSelectedFont}
        fonts={fonts}
        getFontFamily={getFontFamily}
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
    overflow: 'hidden',
  },
  previewImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  previewText: {
    fontSize: 18,
    fontWeight: '500',
    zIndex: 1,
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

  inlineColorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  inlineColorOption: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    margin: 2,
  },
  selectedInlineColorOption: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  whiteColorBorder: {
    borderColor: '#ddd',
    borderWidth: 2,
  },
  uploadImageButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  uploadImageIcon: {
    fontSize: 18,
  },
  imagePreviewContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    height: 120,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeImageButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineCheckmark: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedColorText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
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

  // Modal styles (for font only)
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