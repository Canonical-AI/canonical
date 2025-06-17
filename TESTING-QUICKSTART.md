# Testing Quick Start

## 🚀 Run Tests

```bash
# Run tests once
npm run test:run

# Run tests in watch mode (reruns on file changes) 
npm run test

# Run tests with UI interface
npm run test:ui
```

## ✅ What's Already Tested

- **✅ Utility Functions** (`src/utils/uiHelpers.js`)
  - Alert system
  - Clipboard operations  
  - Debounce functionality
  - DOM manipulation

- **✅ Component Logic** (`src/components/LoginPrompt.vue`)
  - UI rendering
  - User interactions
  - Form validation
  - Store integration

- **✅ Store Management** (Vuex state)
  - User authentication flows
  - Alert system
  - Document management
  - State consistency

## 🎯 Adding New Tests

### For a New Utility Function
```javascript
// src/utils/__tests__/myNewUtil.test.js
import { describe, it, expect } from 'vitest'
import { myNewFunction } from '../myNewUtil.js'

describe('myNewFunction', () => {
  it('should do what it says', () => {
    expect(myNewFunction(input)).toBe(expectedOutput)
  })
})
```

### For a New Component
```javascript
// src/components/__tests__/MyComponent.test.js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  it('should render correctly', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.text()).toContain('Expected text')
  })
})
```

## 🛡️ Regression Prevention Strategy

Focus your testing on:

1. **Critical User Flows**
   - Login/logout
   - Document saving
   - Important UI interactions

2. **Business Logic**
   - Data transformations
   - Validation logic
   - API interactions

3. **Core Utilities**
   - Helper functions
   - State management
   - Error handling

## 💡 Development Workflow

1. **Before coding**: `npm run test:run` (ensure current state)
2. **While developing**: `npm run test` (watch mode for instant feedback)
3. **Before committing**: `npm run test:run` (final check)

This lightweight setup catches regressions without slowing you down! 