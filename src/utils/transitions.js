

// Tailwind-based transitions
export const fadeTransition = {
    enterFromClass: 'opacity-0',
    enterToClass: 'opacity-100',
    enterActiveClass: 'transition-opacity duration-500',
    leaveFromClass: 'opacity-100',
    leaveToClass: 'opacity-0',
    leaveActiveClass: 'transition-opacity duration-500',
}

export const slideFadeTransition = {
    enterFromClass: 'opacity-0 translate-y-full',
    enterToClass: 'opacity-100 translate-y-0',
    enterActiveClass: 'transition-opacity duration-500',
    leaveFromClass: 'opacity-100 translate-y-0',
    leaveToClass: 'opacity-0 translate-y-full',
    leaveActiveClass: 'transition-opacity duration-500',
}

// CSS-based transitions for Vue transition components
export const vueFadeTransition = {
    name: 'app-fade',
    mode: 'out-in'
}

export const vueSlideTransition = {
    name: 'app-slide',
    mode: 'out-in'
}

export const vueScaleTransition = {
    name: 'app-scale',
    mode: 'out-in'
}

// Animation timing constants
export const ANIMATION_TIMING = {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.5s',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design easing
    easingOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
    easingIn: 'cubic-bezier(0.4, 0, 1, 1)'
}

// Common hover effects
export const HOVER_EFFECTS = {
    scale: 'transform: scale(1.05); transition: transform 0.2s ease;',
    scaleSmall: 'transform: scale(1.02); transition: transform 0.2s ease;',
    scaleLarge: 'transform: scale(1.1); transition: transform 0.2s ease;',
    shadow: 'box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); transition: box-shadow 0.2s ease;',
    shadowSmall: 'box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); transition: box-shadow 0.2s ease;',
    lift: 'transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); transition: all 0.2s ease;'
}

// CSS animations as strings (to be injected into components)
export const CSS_ANIMATIONS = `
/* Vue transition classes */
.app-fade-enter-active,
.app-fade-leave-active {
    transition: all ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.app-fade-enter-from {
    opacity: 0;
    transform: scale(0.95) translateX(-10px);
}

.app-fade-leave-to {
    opacity: 0;
    transform: scale(0.95) translateX(10px);
}

.app-fade-enter-to,
.app-fade-leave-from {
    opacity: 1;
    transform: scale(1) translateX(0);
}

.app-slide-enter-active,
.app-slide-leave-active {
    transition: all ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.app-slide-enter-from {
    opacity: 0;
    transform: translateX(-20px);
}

.app-slide-leave-to {
    opacity: 0;
    transform: translateX(20px);
}

.app-slide-enter-to,
.app-slide-leave-from {
    opacity: 1;
    transform: translateX(0);
}

.app-scale-enter-active,
.app-scale-leave-active {
    transition: all ${ANIMATION_TIMING.fast} ${ANIMATION_TIMING.easing};
}

.app-scale-enter-from,
.app-scale-leave-to {
    opacity: 0;
    transform: scale(0.9);
}

.app-scale-enter-to,
.app-scale-leave-from {
    opacity: 1;
    transform: scale(1);
}

/* Keyframe animations */
@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-20px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(20px) scale(0.9);
    }
    to {
        opacity: 1;
        transform: translateX(0) scale(1);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.8;
        transform: scale(0.98);
    }
}

/* Utility classes for common animations */
.animate-slide-in-left {
    animation: slideInLeft ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.animate-slide-in-right {
    animation: slideInRight ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.animate-fade-in-up {
    animation: fadeInUp ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.animate-fade-in-down {
    animation: fadeInDown ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
}

.animate-pulse {
    animation: pulse 2s ${ANIMATION_TIMING.easing} infinite;
}

/* Staggered animation utilities */
.stagger-1 {
    animation-delay: 0.1s;
    animation-fill-mode: both;
}

.stagger-2 {
    animation-delay: 0.2s;
    animation-fill-mode: both;
}

.stagger-3 {
    animation-delay: 0.3s;
    animation-fill-mode: both;
}

.stagger-4 {
    animation-delay: 0.4s;
    animation-fill-mode: both;
}

/* Hover effect utilities */
.hover-scale {
    transition: transform ${ANIMATION_TIMING.fast} ease;
}

.hover-scale:hover {
    transform: scale(1.05);
}

.hover-scale-small {
    transition: transform ${ANIMATION_TIMING.fast} ease;
}

.hover-scale-small:hover {
    transform: scale(1.02);
}

.hover-lift {
    transition: all ${ANIMATION_TIMING.fast} ease;
}

.hover-lift:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.hover-shadow {
    transition: box-shadow ${ANIMATION_TIMING.fast} ease;
}

.hover-shadow:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
`

// Helper function to inject CSS animations into a component's style
export function injectAnimations() {
    const styleId = 'app-animations'
    
    // Check if styles are already injected
    if (document.getElementById(styleId)) {
        return
    }
    
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = CSS_ANIMATIONS
    document.head.appendChild(style)
}

// Animation presets for common use cases
export const ANIMATION_PRESETS = {
    pill: {
        base: `
            transition: all ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
            overflow: hidden;
            white-space: nowrap;
        `,
        hover: `
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        `
    },
    button: {
        base: `
            transition: all ${ANIMATION_TIMING.fast} ease;
        `,
        hover: `
            transform: scale(1.05);
        `
    },
    card: {
        base: `
            transition: all ${ANIMATION_TIMING.normal} ${ANIMATION_TIMING.easing};
        `,
        hover: `
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `
    }
}
