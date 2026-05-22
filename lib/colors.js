/**
 * CENTRALIZED COLOR TEMPLATE
 * Change colors here and they'll update everywhere in the app
 */

export const colors = {
  // Sentiment colors
  sentiment: {
    positive: "#36ADA3",
    negative: "#E63946",
    neutral: "#2F578A",
  },

  // UI Background colors
  background: {
    primary: "#E8F4F8",      // Card/section background
    secondary: "#F0F8FC",    // List/table background
    hover: "#D4E8F080",      // Hover state
  },

  // Text colors
  text: {
    primary: "#121358",      // Main text
    secondary: "#232F72",    // Secondary text
    muted: "#6B7AA1",        // Muted text
    label: "#2F578A",        // Label/badge text
  },

  // Border and accent colors
  border: {
    default: "#B8D4E8",      // Card/element borders
  },

  accent: {
    primary: "#36ADA3",      // Primary accent (headers, highlights)
  },

  // Chart-specific colors
  chart: {
    barPrimary: "#36ADA3",   // Bar chart primary color
  },

  // Button and state colors
  button: {
    primary: "#2F578A",      // Primary button
    primaryText: "#F0F8FC",  // Primary button text
    secondary: "#232F72",    // Secondary button
    negative: "#E63946",     // Negative/cancel button
  },

  // Error and feedback colors
  state: {
    errorBg: "#FFE5E5",      // Error background
    errorBorder: "#FFB3B3",  // Error border
    errorText: "#E63946",    // Error text
  },

  // Hover and interactive states
  interactive: {
    accentLight: "#36ADA315", // Accent with low opacity
    accentHover: "#36ADA330", // Accent hover
  },
};

/**
 * Helper function to get sentiment color
 * @param {string} sentiment - 'positive', 'negative', or 'neutral'
 * @returns {string} Hex color code
 */
export const getSentimentColor = (sentiment) => {
  return colors.sentiment[sentiment] || colors.sentiment.neutral;
};

/**
 * Helper function to generate bar chart colors with gradient
 * @param {number} index - Index in the bar chart
 * @param {number} total - Total bars in chart
 * @returns {string} RGBA color
 */
export const getBarChartColor = (index, total) => {
  const opacity = 1 - (index / total) * 0.55;
  return `rgba(75,101,135,${opacity})`;
};
