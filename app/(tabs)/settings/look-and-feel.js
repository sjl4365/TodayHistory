import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';

export default function LookAndFeel() {
  const [selectedFont, setSelectedFont] = useState('Verdana');
  const [fontSize, setFontSize] = useState(18);
  const [fontColor, setFontColor] = useState('black');
  const [backgroundColor, setBackgroundColor] = useState('white');

  const fonts = [
    'System',
    'Verdana', 
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
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

  const ColorPicker = ({ colors, selectedColor, onColorSelect, title }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.colorGrid}>
        {colors.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorButton,
              { backgroundColor: color },
              selectedColor === color && styles.selectedColor,
            ]}
            onPress={() => onColorSelect(color)}
          />
        ))}
      </View>
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
          <View style={styles.fontGrid}>
            {fonts.map((font) => (
              <TouchableOpacity
                key={font}
                style={[
                  styles.fontButton,
                  selectedFont === font && styles.selectedFont,
                ]}
                onPress={() => setSelectedFont(font)}
              >
                <Text
                  style={[
                    styles.fontButtonText,
                    selectedFont === font && styles.selectedFontText,
                  ]}
                >
                  {font}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
              thumbStyle={styles.sliderThumb}
            />
            <Text style={styles.sizeLabel}>48</Text>
          </View>
          <Text style={styles.currentSize}>{Math.round(fontSize)}pt</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    backgroundColor: 'grey',
    paddingVertical: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewArea: {
    height: 120,
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

  controlsContainer: {
    flex: 1,
    paddingHorizontal: 20,
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
  fontGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fontButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minWidth: 100,
    marginBottom: 8,
  },
  selectedFont: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  fontButtonText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  selectedFontText: {
    color: 'white',
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
});