// components/AnimatedButton.js
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AnimatedButton = ({ onPress, title, style, textStyle, gradientColors = ['#6A11CB', '#2575FC'] }) => {
  const scale = useSharedValue(1);
  const isPressed = useSharedValue(0); // 0 for not pressed, 1 for pressed

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const animatedGradientStyle = useAnimatedStyle(() => {
     const backgroundColor = interpolateColor(
        isPressed.value, // Input value (0 or 1)
        [0, 1], // Input range
        [gradientColors[1], gradientColors[0]] // Output color range (swap on press)
     );
     return {
       // We animate the gradient colors directly if possible, or maybe opacity/overlay
       // For simplicity here, let's just animate scale
     };
  });


  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    isPressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
     isPressed.value = withTiming(0, { duration: 150 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, style, animatedStyle]}
    >
      <LinearGradient
        colors={gradientColors}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={[styles.text, textStyle]}>{title}</Text>
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 30,
    overflow: 'hidden', // Important for gradient border radius
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    // shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginVertical: 10,
  },
  gradient: {
    paddingVertical: 18,
    paddingHorizontal: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AnimatedButton;