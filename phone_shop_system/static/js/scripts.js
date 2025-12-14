// Phone Shop System - Common JavaScript Functions

// Initialize Select2 on page load
$(document).ready(function() {
    if ($.fn.select2) {
        $('.select2').select2({
            theme: 'bootstrap-5',
            placeholder: 'Select an option',
            allowClear: true
        });
    }
});

// Speech synthesis helper
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        speechSynthesis.speak(utterance);
    }
}

// Format currency
function formatCurrency(amount) {
    return '$' + parseFloat(amount).toFixed(2);
}

// Validate IMEI (basic Luhn check)
function validateIMEI(imei) {
    if (!/^\d{15}$/.test(imei)) {
        return false;
    }
    
    let sum = 0;
    for (let i = 0; i < 15; i++) {
        let digit = parseInt(imei[i]);
        if (i % 2 === 1) {
            digit *= 2;
            if (digit > 9) {
                digit = Math.floor(digit / 10) + (digit % 10);
            }
        }
        sum += digit;
    }
    return sum % 10 === 0;
}

// Show loading spinner
function showLoading(element) {
    $(element).html('<div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div>');
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = $(`
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `);
    
    $('body').append(toast);
    const bsToast = new bootstrap.Toast(toast[0]);
    bsToast.show();
    
    toast.on('hidden.bs.toast', function() {
        $(this).remove();
    });
}
