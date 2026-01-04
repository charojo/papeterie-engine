import '@testing-library/jest-dom';

/* eslint-disable no-undef */
// Global mocks for animation frame methods
global.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
