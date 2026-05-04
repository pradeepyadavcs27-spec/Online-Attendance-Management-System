/**
 * Form Validation
 * Simple validation functions for forms
 */

const Validator = {
    // Validate empty fields
    required: function(value, fieldName) {
        if (!value || value.trim() === '') {
            return fieldName + ' is required';
        }
        return null;
    },

    // Validate email format
    email: function(value) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
            return 'Please enter a valid email address';
        }
        return null;
    },

    // Validate minimum length
    minLength: function(value, length, fieldName) {
        if (value.length < length) {
            return fieldName + ' must be at least ' + length + ' characters';
        }
        return null;
    },

    // Validate roll number format (alphanumeric)
    rollNumber: function(value) {
        const pattern = /^[A-Za-z0-9]+$/;
        if (!pattern.test(value)) {
            return 'Roll number should contain only letters and numbers';
        }
        return null;
    },

    // Show error message
    showError: function(inputElement, message) {
        const formGroup = inputElement.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        
        inputElement.style.borderColor = '#dc3545';
    },

    // Clear error message
    clearError: function(inputElement) {
        const formGroup = inputElement.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message');
        
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        inputElement.style.borderColor = '#ddd';
    },

    // Clear all errors in a form
    clearAllErrors: function(form) {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => this.clearError(input));
    }
};