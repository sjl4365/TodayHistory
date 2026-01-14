import React from 'react';
import { Text, View } from 'react-native';

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
    <View style={{ position: 'relative' }}>
      {offsets.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[
            ...styleArray,
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
