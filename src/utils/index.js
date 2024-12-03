
// src/utils.js
export function formatServerTimeStamp(date) {
    const timestamp = date.seconds * 1000 + date.nanoseconds / 1000000; // Convert to milliseconds
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(timestamp).toLocaleDateString(undefined, options);
  }
