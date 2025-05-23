// helper functions

/**
 * format ms to mm:ss string.
 * @param {number} ms duration in milliseconds.
 * @returns {string} formatted duration (e.g., "03:45").
 */
function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) {
        return '00:00'; // handle invalid input
    }
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

module.exports = {
    formatDuration,
};