# Testing Setup for Canonical

This is a lightweight testing setup designed to prevent regressions while keeping overhead minimal.

## Quick Start

1. **Install new dependencies:**
```bash
npm install
```

2. **Run tests:**
```bash
# Run all tests
npm run test

# Run tests in watch mode (reruns on file changes)
npm run test

# Run tests once (for CI/CD)
npm run test:run

# Run tests with UI (visual test runner)
npm run test:ui
```

## What's Included

### 🔧 **Testing Stack**
- **Vitest**: Lightning-fast test runner that works seamlessly with Vite
- **Vue Test Utils**: Official testing utilities for Vue components
- **jsdom**: Browser environment simulation for component testing

### 📁 **Test Structure**
```
src/
├── utils/__tests__/
│   └── uiHelpers.test.js          # Unit tests for utilities
├── components/__tests__/
│   └── LoginPrompt.test.js        # Component tests
├── __tests__/
│   └── integration/
│       └── app.integration.test.js # Integration tests
└── test/
    └── setup.js                   # Global test configuration
```

### ✅ **Test Types**

1. **Unit Tests** (`src/utils/__tests__/`)
   - Test individual functions and utilities
   - Fast execution, focused scope
   - Example: `uiHelpers.test.js`

2. **Component Tests** (`src/components/__tests__/`)
   - Test Vue components in isolation
   - Mock external dependencies
   - Example: `LoginPrompt.test.js`

3. **Integration Tests** (`src/__tests__/integration/`)
   - Test component interactions and user flows
   - Ensure critical paths work end-to-end
   - Example: `app.integration.test.js`

## Writing Tests

### Unit Test Example
```javascript
import { describe, it, expect } from 'vitest'
import { getRandomItem } from '../uiHelpers.js'

describe('getRandomItem', () => {
  it('should return an item from the array', () => {
    const array = ['a', 'b', 'c']
    const result = getRandomItem(array)
    expect(array).toContain(result)
  })
})
```

### Component Test Example
```javascript
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

## Test Coverage Focus

To prevent regressions effectively while staying lightweight, focus tests on:

1. **Critical Business Logic**
   - User authentication flows
   - Document saving/loading
   - Data transformations

2. **Core Utilities**
   - Helper functions in `/utils`
   - Store mutations and actions
   - API integrations

3. **Key User Interactions**
   - Login/logout flows
   - Document creation/editing
   - Navigation between routes

## Best Practices

1. **Keep Tests Simple**: Focus on behavior, not implementation details
2. **Mock External Dependencies**: Firebase, APIs, complex libraries
3. **Test User Scenarios**: What would break the user experience?
4. **Run Tests Frequently**: Use watch mode during development
5. **Fix Failing Tests Immediately**: Don't let them accumulate

## Development Workflow

1. **Before making changes**: Run `npm run test` to ensure current state
2. **While developing**: Use `npm run test` (watch mode) for instant feedback
3. **Before committing**: Run `npm run test:run` to ensure all tests pass
4. **Add tests for new features**: Especially critical business logic

## Common Testing Patterns

### Mocking Firebase
```javascript
vi.mock('../firebase.js', () => ({
  auth: {},
  db: {},
  analytics: {}
}))
```

### Testing Vuex Store
```javascript
const store = createStore({
  state: { user: null },
  getters: { isLoggedIn: state => !!state.user }
})
```

### Testing Component Props/Events
```javascript
const wrapper = mount(Component, {
  props: { title: 'Test Title' }
})
await wrapper.find('button').trigger('click')
expect(wrapper.emitted()).toHaveProperty('click')
```

## Configuration Files

- `vitest.config.js`: Main test configuration
- `src/test/setup.js`: Global test setup and mocks
- Automatic test discovery in `__tests__` folders and `.test.js` files

This lightweight setup gives you confidence in your changes without slowing down development! 