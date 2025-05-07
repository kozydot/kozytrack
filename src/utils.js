// Utility functions

/**
 * Formats milliseconds into a MM:SS string.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted duration string (e.g., "03:45").
 */
function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
        return '00:00'; // Return a default or handle error appropriately
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

module.exports = {
    formatDuration,
};