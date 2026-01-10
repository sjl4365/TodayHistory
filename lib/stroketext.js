// lib/StrokeText.js
import React from 'react';
import {Text, View} from 'react-native';

export default function StrokeText({
  text,
  strokeColor = 'black',
  strokeWidth = 2,
  style = [],
}) {
  const styleArray = Array.isArray(style) ? style : [style];
  
  const fillColor = styleArray.reduce((color, s) => {
    if (s?.color) return s.color;
    return color;
  }, '#FFFFFF');
  
  const offsets = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    offsets.push([
      Math.cos(angle) * strokeWidth,
      Math.sin(angle) * strokeWidth,
    ]);
  }

  return (
    <View style={{
      position: 'relative',
      paddingHorizontal: strokeWidth + 2,
      paddingVertical: strokeWidth + 2,
    }}>
      {offsets.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[
            ...styleArray,
            {
              color: strokeColor,
              position: 'absolute',
              left: dx + strokeWidth + 2,
              top: dy + strokeWidth + 2,
            },
          ]}
        >
          {text}
        </Text>
      ))}
      <Text style={[
        ...styleArray,
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