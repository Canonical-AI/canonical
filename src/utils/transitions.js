

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
