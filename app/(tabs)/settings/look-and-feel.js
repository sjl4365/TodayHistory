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
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { StrokeText } from "@charmy.tech/react-native-stroke-text";
import { useTranslation } from '../../../lib/translations';
import { useNavigation } from 'expo-router';

const STORAGE_KEY_FONT = '@app_font';
const STORAGE_KEY_FONT_SIZE = '@app_font_size';
const STORAGE_KEY_FONT_COLOR = '@app_font_color';
const STORAGE_KEY_BG_COLOR = '@app_bg_color';
const STORAGE_KEY_BG_IMAGE = '@app_bg_image';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function LookAndFeel() {
  const { scale } = useUIScale();
  const { t, currentLanguage } = useTranslation();
  const navigation = useNavigation();
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(18);
  const [fontColor, setFontColor] = useState('#000000');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [showFontModal, setShowFontModal] = useState(false);

  // Update header title when language changes
  useEffect(() => {
    navigation.setOptions({
      title: t('lookAndFeel'),
    });
  }, [currentLanguage, navigation, t]);

  const fonts = [
    'System',
    'Verdana', 
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
  ];

  const fontcolorOptions = [
    { name: 'Black', value: '#000000', useStroke: true, strokeColor: '#FFFFFF', strokeWidth: 3},
    { name: 'White', value: '#FFFFFF', useStroke: true, strokeColor: '#000000', strokeWidth: 3},
    { name: 'Red', value: '#FF0000' },
    { name: 'Orange', value: '#FF8000' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Indigo', value: '#4B0082' },
    { name: 'Violet', value: '#8A2BE2' },
    { name: 'Pink', value: '#FF69B4' },
    { name: 'Cyan', value: '#00FFFF' },
    { name: 'Magenta', value: '#FF00FF' },
    { name: 'Lime', value: '#32CD32' },
    { name: 'Brown', value: '#8B4513' },
  ];

  const backcolorOptions = [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#FFFFFF' },
    { name: 'Red', value: '#FF0000' },
    { name: 'Orange', value: '#FF8000' },
    { name: 'Yellow', value: '#FFFF00' },
    { name: 'Green', value: '#00FF00' },
    { name: 'Blue', value: '#0000FF' },
    { name: 'Indigo', value: '#4B0082' },
    { name: 'Violet', value: '#8A2BE2' },
    { name: 'Pink', value: '#FF69B4' },
    { name: 'Cyan', value: '#00FFFF' },
    { name: 'Magenta', value: '#FF00FF' },
    { name: 'Lime', value: '#32CD32' },
  ];

  const getCurrentFontColorOption = () => {
    return fontcolorOptions.find(option => option.value === fontColor) || fontcolorOptions[1];
  };

  const renderPreviewText = (text) => {
    const currentOption = getCurrentFontColorOption();
    if (currentOption.useStroke && backgroundImage) {
      return (
        <StrokeText
          text={text}
          fontSize={fontSize}
          color={currentOption.value}
          strokeColor={currentOption.strokeColor}
          strokeWidth={currentOption.strokeWidth}
          fontFamily={getFontFamily(selectedFont)}
          align="center"
        />
      );
    }
    return (
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
        {text}
      </Text>
    );
  };

  // Font Dropdown Modal Component
  const FontDropdownModal = ({ visible, onClose, selectedFont, onFontSelect, fonts, getFontFamily }) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent,{padding: scale(20),borderRadius: scale(16),}]}>
          <View style={[
            styles.modalHeader,
            { marginBottom: scale(20) }
          ]}>
            <Text style={[styles.modalTitle, { fontSize: scale(18) }]}>
              {t('selectFont')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { fontSize: scale(20) }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.fontOptionsContainer}>
            {fonts.map((font) => (
              <TouchableOpacity
                key={font}
                style={[
                  styles.fontDropdownOption,
                  { padding: scale(16) },
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
                    { fontSize: scale(16) },
                    { fontFamily: getFontFamily(font) },
                    selectedFont === font && styles.selectedFontDropdownText,
                  ]}
                >
                  {font}
                </Text>
                {selectedFont === font && (
                  <Text style={[styles.fontCheckmark, { fontSize: scale(16) }]}>
                    ✓
                  </Text>
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
    <View style={[styles.section, { marginBottom: scale(24) }]}>
      <Text style={[styles.sectionTitle, { fontSize: scale(14), marginBottom: scale(12) }]}>
        {title}
      </Text>
      <View style={styles.inlineColorContainer}>
        {fontcolorOptions.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.inlineColorOption,
              {
                width: scale(40),
                height: scale(40),
                borderRadius: scale(20),
                marginHorizontal: scale(4),
                marginVertical: scale(4),
              },
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
    <View style={[styles.section, { marginBottom: scale(24) }]}>
      <Text style={[styles.sectionTitle, { fontSize: scale(14), marginBottom: scale(12) }]}>
        {title}
      </Text>
      <View style={styles.inlineColorContainer}>
        {backcolorOptions.map((color) => (
          <TouchableOpacity
            key={color.value}
            style={[
              styles.inlineColorOption,
              {
                width: scale(40),
                height: scale(40),
                borderRadius: scale(20),
                marginHorizontal: scale(4),
                marginVertical: scale(4),
              },
              { backgroundColor: color.value },
              (color.value === '#FFFFFF' && selectedColor !== color.value) && styles.whiteColorBorder,
              selectedColor === color.value && styles.selectedInlineColorOption,
            ]}
            onPress={() => {
              onColorChange(color.value);
              setBackgroundImage(null);
              AsyncStorage.removeItem(STORAGE_KEY_BG_IMAGE);
            }}
          >
          </TouchableOpacity>
        ))}
        
        {/* Upload Image Button */}
        <TouchableOpacity
          style={[
            styles.inlineColorOption,
            styles.uploadImageButton,
            {
              width: scale(40),
              height: scale(40),
              borderRadius: scale(20),
              marginHorizontal: scale(4),
              marginVertical: scale(4),
            },
            backgroundImage && styles.selectedInlineColorOption,
          ]}
          onPress={pickImage}
        >
          <Text style={[styles.uploadImageIcon, { fontSize: scale(18) }]}>
            📷
          </Text>
        </TouchableOpacity>
      </View>
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
        setBackgroundColor(null);
        await AsyncStorage.removeItem(STORAGE_KEY_BG_COLOR);
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
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
      
      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading settings:', error);
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY_FONT, selectedFont).catch(() => {});
    }
  }, [selectedFont, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY_FONT_SIZE, fontSize.toString()).catch(() => {});
    }
  }, [fontSize, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY_FONT_COLOR, fontColor).catch(() => {});
    }
  }, [fontColor, isLoaded]);

  useEffect(() => {
    if (isLoaded && backgroundColor) {
      AsyncStorage.setItem(STORAGE_KEY_BG_COLOR, backgroundColor).catch(() => {});
    }
  }, [backgroundColor, isLoaded]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.previewArea,
          {
            height: scale(100),
            marginHorizontal: scale(20),
            marginVertical: scale(16),
            borderRadius: scale(8),
          },
          backgroundImage ? { backgroundColor: 'transparent' } : { backgroundColor },
        ]}
      >
        {backgroundImage && (
          <Image
            source={{ uri: backgroundImage }}
            style={[styles.previewImage, { borderRadius: scale(8) }]}
          />
        )}
        {renderPreviewText('Thank you!')}
      </View>

      <ScrollView 
        style={[
          styles.controlsContainer,
          {
            paddingHorizontal: scale(20),
            paddingBottom: scale(100),
          }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Font Selection */}
        <View style={[styles.section, { marginBottom: scale(24) }]}>
          <Text style={[styles.sectionTitle, { fontSize: scale(14), marginBottom: scale(12) }]}>
            {t('font')}
          </Text>
          <TouchableOpacity 
            style={[
              styles.fontDropdownButton,
              {
                borderRadius: scale(8),
                padding: scale(16),
                marginBottom: scale(8),
              }
            ]}
            onPress={() => setShowFontModal(true)}
          >
            <View style={styles.fontDropdownContent}>
              <Text
                style={[
                  styles.fontDropdownButtonText,
                  { fontSize: scale(16) },
                  { fontFamily: getFontFamily(selectedFont) }
                ]}
              >
                {selectedFont}
              </Text>
              <Text style={[styles.dropdownArrow, { fontSize: scale(12) }]}>
                ▼
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.fontNote, { fontSize: scale(12), marginTop: scale(8) }]}>
            {t('fontAppliedNote')}
          </Text>
        </View>

        {/* Size Slider */}
        <View style={[styles.section, { marginBottom: scale(24) }]}>
          <Text style={[styles.sectionTitle, { fontSize: scale(14), marginBottom: scale(12) }]}>
            {t('fontSize')}
          </Text>
          <View style={[styles.sliderContainer, { gap: scale(12) }]}>
            <Text style={[styles.sizeLabel, { fontSize: scale(12) }]}>
              12
            </Text>
            <Slider
              style={[styles.slider, { height: scale(40) }]}
              minimumValue={12}
              maximumValue={48}
              value={fontSize}
              onValueChange={setFontSize}
              step={1}
              minimumTrackTintColor="#006AFF"
              maximumTrackTintColor="#D1D1D1"
            />
            <Text style={[styles.sizeLabel, { fontSize: scale(12) }]}>
              48
            </Text>
          </View>
          <Text style={[styles.currentSize, { fontSize: scale(12), marginTop: scale(4) }]}>
            {Math.round(fontSize)}pt
          </Text>
        </View>

        {/* Font Color Palette */}
        <FontColorPalette 
          title={t('fontColor')}
          selectedColor={fontColor}
          onColorChange={setFontColor}
        />

        {/* Background Color Palette with Image Upload */}
        <BackColorPalette 
          title={t('backgroundColor')}
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
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  previewText: {
    fontWeight: '500',
    zIndex: 1,
  },
  controlsContainer: {
    flex: 1,
  },
  section: {},
  sectionTitle: {
    fontWeight: '600',
    color: '#333',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
  },
  sizeLabel: {
    color: 'black',
    minWidth: 20,
    textAlign: 'center',
  },
  currentSize: {
    color: 'black',
    textAlign: 'center',
  },
  fontNote: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  inlineColorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineColorOption: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
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
  uploadImageIcon: {},
  fontDropdownButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fontDropdownContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fontDropdownButtonText: {
    color: 'black',
    fontWeight: '500',
  },
  dropdownArrow: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    width: '85%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
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
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedFontDropdownOption: {
    backgroundColor: '#f0f8ff',
  },
  fontDropdownText: {
    color: '#333',
  },
  selectedFontDropdownText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  fontCheckmark: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
});