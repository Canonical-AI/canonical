import { computed } from 'vue';
import { useTheme } from 'vuetify';

export function useBackgroundEffects(options = {}) {
  const theme = useTheme();
  
  const {
    backgroundBlur = 15,
    backgroundBrightness = 0.6,
    backgroundContrast = 1.2,
    grainOpacity = 0.08
  } = options;

  const isLightMode = computed(() => {
    return !theme.global.current.value.dark;
  });

  const backgroundStyle = computed(() => {
    const baseFilter = `blur(${backgroundBlur}px) brightness(${backgroundBrightness}) contrast(${backgroundContrast})`;
    return {
      filter: isLightMode.value ? `${baseFilter} invert(1)` : baseFilter
    };
  });

  const grainStyle = computed(() => ({
    opacity: grainOpacity
  }));

  return {
    isLightMode,
    backgroundStyle,
    grainStyle,
    theme
  };
} 