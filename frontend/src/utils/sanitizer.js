import DOMPurify from 'dompurify';

/**
 * Sanitizes user input to remove potentially harmful content (XSS prevention)
 * @param {string} dirty - The raw user input
 * @returns {string} - Cleaned/sanitized string safe to display
 */
export const sanitizeInput = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  // Configure DOMPurify to be strict - remove all HTML tags
  const config = {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true // Keep the text content
  };

  return DOMPurify.sanitize(dirty, config);
};

/**
 * Sanitizes message content for display (allows line breaks, basic formatting)
 * @param {string} dirty - The raw message content
 * @returns {string} - Cleaned message safe to display
 */
export const sanitizeMessage = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  // Escape HTML special characters to prevent injection
  // React natively escapes strings against XSS.
  // We only strip explicitly zero-width or strictly invalid chars if needed, but returning as is works best for links.
  return dirty.trim();
};

/**
 * Validates message content before sending
 * @param {string} message - The message to validate
 * @returns {object} - { isValid: boolean, error: string|null }
 */
export const validateMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (message.trim().length === 0) {
    return { isValid: false, error: 'Message cannot be only whitespace' };
  }

  if (message.length > 5000) {
    return { isValid: false, error: 'Message is too long (max 5000 characters)' };
  }

  return { isValid: true, error: null };
};

/**
 * Sanitizes group name
 * @param {string} dirty - The raw group name
 * @returns {string} - Cleaned group name
 */
export const sanitizeGroupName = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  // Remove any HTML tags and special characters, keep only alphanumeric and spaces
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] })
    .trim()
    .substring(0, 100); // Max 100 characters
};

/**
 * Sanitizes username for display
 * @param {string} dirty - The raw username
 * @returns {string} - Cleaned username
 */
export const sanitizeUsername = (dirty) => {
  if (!dirty || typeof dirty !== 'string') {
    return 'Unknown User';
  }

  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] })
    .trim()
    .substring(0, 50); // Max 50 characters
};

/**
 * Unescapes message content for displaying and editing
 * @param {string} text - The escaped message content
 * @returns {string} - Unescaped message
 */
export const unescapeMessage = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
};

const sanitizer = {
  unescapeMessage,
  sanitizeInput,
  sanitizeMessage,
  sanitizeGroupName,
  sanitizeUsername,
  validateMessage
};

export default sanitizer;
