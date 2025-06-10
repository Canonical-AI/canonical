// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi';


const paper = {
  dark: false,
  colors: {
    background: '#F6F4F7',
    surface: '#FFFFFF',
    'surface-bright': '#F0EDF2',
    'surface-light': '#E6E1E8',
    'surface-variant': '#DCD5DF',
    'on-surface-variant': '#4A3A4E',
    primary: '#5B7FA5',
    'primary-darken-1': '#4A6A8A',
    secondary: '#6BA396',
    'secondary-darken-1': '#578A7D',
    error: '#D45D5D',
    info: '#5B7FA5',
    success: '#6BA396',
    warning: '#D9A06F',
  },
  variables: {
    'border-color': '#4A3A4E',
    'border-opacity': 0.6,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.60,
    'disabled-opacity': 0.38,
    'idle-opacity': 0.04,
    'hover-opacity': 0.04,
    'focus-opacity': 0.12,
    'selected-opacity': 0.08,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.12,
    'dragged-opacity': 0.08,
    'theme-kbd': '#212529',
    'theme-on-kbd': '#FFFFFF',
    'theme-code': '#F5F5F5',
    'theme-on-code': '#000000',
  }
}

const auteur = {
  dark: true,
  colors: {      
    background: '#1A0F15', // Darker eggplant-black
    surface: '#24232A', // Darker eggplant-black
    'surface-bright': '#35303A', // Darker medium eggplant
    'surface-light': '#4A3B45', // Darker lighter eggplant
    'surface-variant': '#2A2228', // Darker shade of eggplant
    'on-surface-variant': '#C6B2B5', // Light beige (for text on dark surfaces)
    primary: '#4A7A9B', // Medium blue
    'primary-darken-1': '#3A6079', // Darker blue
    secondary: '#D1A181', // Light beige-orange
    'secondary-darken-1': '#B38A6D', // Darker beige-orange
    error: '#E74C3C', // Bright red (inspired by HAL 9000)
    info: '#3498DB', // Bright blue
    success: '#4B7D6F', // Green (not prominent in the film, but needed for UI)
    warning: '#F39C12' // Orange (from the sunrise scenes)
  },
  variables: {
    'border-color': '#A899AD',
    'border-opacity': 0.3,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.60,
    'disabled-opacity': 0.38,
    'idle-opacity': 0.04,
    'hover-opacity': 0.04,
    'focus-opacity': 0.12,
    'selected-opacity': 0.08,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.12,
    'dragged-opacity': 0.08,
    'theme-kbd': '#212529',
    'theme-on-kbd': '#FFFFFF',
    'theme-code': '#F5F5F5',
    'theme-on-code': '#000000',
  }
}

const hal2001 = {
  dark: true,
  colors: {
    background: '#0C0E12', // Dark blue-black
    surface: '#161A21', // Slightly lighter blue-black
    'surface-bright': '#1E242E', // Medium dark blue
    'surface-light': '#282F3B', // Lighter blue
    'surface-variant': '#1A1E25', // Another shade of dark blue
    'on-surface-variant': '#D6CFCB', // Light beige (for text on dark surfaces)
    primary: '#4A7A9B', // Medium blue
    'primary-darken-1': '#3A6079', // Darker blue
    secondary: '#D1A181', // Light beige-orange
    'secondary-darken-1': '#B38A6D', // Darker beige-orange
    error: '#E74C3C', // Bright red (inspired by HAL 9000)
    info: '#3498DB', // Bright blue
    success: '#4B7D6F', // Green (not prominent in the film, but needed for UI)
    warning: '#F39C12' // Orange (from the sunrise scenes)
  },
  variables: {
    'border-color': '#D6CFCB',
    'border-opacity': 0.3,
    'high-emphasis-opacity': 0.87,
    'medium-emphasis-opacity': 0.60,
    'disabled-opacity': 0.38,
    'idle-opacity': 0.04,
    'hover-opacity': 0.04,
    'focus-opacity': 0.12,
    'selected-opacity': 0.08,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.12,
    'dragged-opacity': 0.08,
    'theme-kbd': '#212529',
    'theme-on-kbd': '#FFFFFF',
    'theme-code': '#F5F5F5',
    'theme-on-code': '#000000',
  }
}

export default createVuetify({
  display: {
    mobileBreakpoint: 'lg',
    thresholds: {
      xs: 0,
      sm: 340,
      md: 540,
      lg: 800,
      xl: 1280,
    },
  },
  theme: {
    defaultTheme: 'hal2001',
    themes: { 
      hal2001,
      auteur,
      paper,
    }
  },
  defaults:{
    VTooltip: {
      openDelay: '300',
      closeDelay: '100',
      eager: false,
      openOnHover: true,
      openOnFocus: false
    }
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    }
  },
});


