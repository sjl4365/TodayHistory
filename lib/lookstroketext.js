// lib/lookstroketext.js
import React from 'react';
import { Text, View } from 'react-native';
export default function StrokeText({
    text,
    strokeColor = 'black',
    strokeWidth = 2,
    color,
    fontSize,
    fontFamily,
    style = {},
  }) {
    // Extract fill color from either color prop or style
    const fillColor = color || style?.color || '#FFFFFF';
    
    const offsets = [];
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const angle = (Math.PI * 2 * i) / steps;
      offsets.push([
        Math.cos(angle) * strokeWidth,
        Math.sin(angle) * strokeWidth,
      ]);
    }
  
    const textStyle = {
      fontSize: fontSize || style?.fontSize || 18,
      fontFamily: fontFamily || style?.fontFamily,
      fontWeight: style?.fontWeight || '500',
      textAlign: style?.textAlign || 'center',
    };
  
    return (
      <View style={{ position: 'relative', alignItems: 'center' }}>
        {/* Render stroke layers */}
        {offsets.map(([dx, dy], i) => (
          <Text
            key={i}
            style={[
              textStyle,
              {
                color: strokeColor,
                position: 'absolute',
                left: dx,
                top: dy,
              },
            ]}
          >
            {text}
          </Text>
        ))}
        
        {/* Render fill text on top */}
        <Text style={[
          textStyle,
          {
            color: fillColor,
            position: 'relative',
          }
        ]}>
          {text}
        </Text>
      </View>
    );
  }