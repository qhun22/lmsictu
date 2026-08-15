/**
 * ACCOUNT AUTHENTICATION - SHARED JAVASCRIPT
 * --------------------------------------------------------------------------
 * File JS dùng chung cho 3 trang: login.php, register.php, forgot-password.php
 *
 * Chức năng:
 *  - Validate form phía client
 *  - Show/hide mật khẩu (nút toggle mắt)
 *  - Submit form qua AJAX (fetch API) - dễ tích hợp backend sau
 *  - Hiển thị thông báo lỗi / thành công
 *  - Xử lý tab navigation (nếu cần mở rộng)
 *
 * Quy ước: code sạch, không phụ thuộc thư viện ngoài (vanilla JS thuần).
 */

(function () {
  'use strict';

  /* ============================================================
     1. CẤU HÌNH CHUNG
     ============================================================ */
  const CONFIG = {
    /** Các selector có thể truy vấn ngay khi DOM load xong */
    selectors: {
      forms: '.js-auth-form',
      togglePassword: '.js-toggle-password',
      passwordInput: '.js-password-input',
      errorMessage: '.js-field-error',
      alertBox: '.js-auth-alert',
      authRemember: '.js-remember-checkbox'
    },
    /** Đường dẫn backend xử lý từng loại form (clean URLs) */
    endpoints: {
      login: (window.APP_BASE_URL || '') + '/login/',
      register: (window.APP_BASE_URL || '') + '/register/',
      forgot: (window.APP_BASE_URL || '') + '/forgot-password/'
    },
    /** Timeout cho AJAX request (ms) */
    ajaxTimeout: 15000
  };

  /* ============================================================
     2. HELPER FUNCTIONS (TIỆN ÍCH)
     ============================================================ */

  /**
   * Lấy phần tử DOM an toàn (bỏ qua null)
   * @param {string} selector - CSS selector
   * @param {Element} [context=document] - Phạm vi tìm kiếm
   * @returns {Element|null}
   */
  function $(selector, context) {
    return (context || document).querySelector(selector);
  }

  /**
   * Lấy tất cả phần tử DOM khớp selector
   * @param {string} selector - CSS selector
   * @param {Element} [context=document]
   * @returns {Element[]}
   */
  function $$(selector, context) {
    return Array.from((context || document).querySelectorAll(selector));
  }

  /**
   * Hiển thị thông báo lỗi của 1 field
   * @param {Element} input - input cần hiển thị lỗi
   * @param {string} message - Nội dung lỗi (rỗng thì ẩn)
   */
  function showFieldError(input, message) {
    if (!input) return;
    input.classList.toggle('auth__input--error', Boolean(message));
    const errorEl = input.closest('.auth__field')?.querySelector(CONFIG.selectors.errorMessage);
    if (errorEl) {
      errorEl.textContent = message || '';
    }
  }

  /**
   * Xoá tất cả lỗi trong 1 form
   * @param {Element} form
   */
  function clearFormErrors(form) {
    if (!form) return;
    $$('.auth__input--error', form).forEach((el) => el.classList.remove('auth__input--error'));
    $$(CONFIG.selectors.errorMessage, form).forEach((el) => {
      el.textContent = '';
    });
    hideAlert(form);
  }

  /**
   * Hiển thị alert box (thành công/lỗi) trong form
   * @param {Element} form
   * @param {string} message
   * @param {string} type - 'success' | 'error'
   */
  function showAlert(form, message, type) {
    if (!form) return;
    const alertEl = $(CONFIG.selectors.alertBox, form);
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.classList.remove('auth__alert--success', 'auth__alert--error');
    alertEl.classList.add('auth__alert--visible', `auth__alert--${type}`);
  }

  /**
   * Ẩn alert box trong form
   * @param {Element} form
   */
  function hideAlert(form) {
    if (!form) return;
    const alertEl = $(CONFIG.selectors.alertBox, form);
    if (!alertEl) return;
    alertEl.classList.remove('auth__alert--visible', 'auth__alert--success', 'auth__alert--error');
    alertEl.textContent = '';
  }

  /**
   * Validate email đơn giản
   * @param {string} email
   * @returns {boolean}
   */
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  /* ============================================================
     3. VALIDATION (KIỂM TRA FORM)
     ============================================================ */

  /**
   * Validate form theo loại (login | register | forgot)
   * Trả về: { valid: boolean, data: object }
   * @param {Element} form
   * @returns {{valid: boolean, data: Object}}
   */
  function validateForm(form) {
    const formType = form.dataset.authType || form.id;
    const data = {};
    let valid = true;

    // Lấy tất cả input có name
    const inputs = $$('input[name]', form);

    inputs.forEach((input) => {
      const value = input.value.trim();
      const name = input.name;

      // Bỏ qua checkbox remember (xử lý riêng)
      if (input.type === 'checkbox') {
        data[name] = input.checked;
        return;
      }

      data[name] = value;

      // Nếu không required và rỗng -> bỏ qua validate chi tiết
      if (!input.required && !value) {
        showFieldError(input, '');
        return;
      }

      // Validate theo từng trường hợp
      switch (name) {
        case 'username':
          if (!value) {
            showFieldError(input, 'Vui lòng nhập tên đăng nhập');
            valid = false;
          } else if (value.length < 3) {
            showFieldError(input, 'Tên đăng nhập phải có ít nhất 3 ký tự');
            valid = false;
          } else if (value.length > 30) {
            showFieldError(input, 'Tên đăng nhập không quá 30 ký tự');
            valid = false;
          } else {
            showFieldError(input, '');
          }
          break;

        case 'email':
          if (!value) {
            showFieldError(input, 'Vui lòng nhập email');
            valid = false;
          } else if (!isValidEmail(value)) {
            showFieldError(input, 'Email không hợp lệ');
            valid = false;
          } else {
            showFieldError(input, '');
          }
          break;

        case 'identifier': // forgot-password (email hoặc username)
          if (!value) {
            showFieldError(input, 'Vui lòng nhập email hoặc tên đăng nhập');
            valid = false;
          } else {
            showFieldError(input, '');
          }
          break;

        case 'password':
          if (!value) {
            showFieldError(input, 'Vui lòng nhập mật khẩu');
            valid = false;
          } else if (formType === 'register' && value.length < 8) {
            showFieldError(input, 'Mật khẩu phải có ít nhất 8 ký tự');
            valid = false;
          } else {
            showFieldError(input, '');
          }
          break;

        case 'password_confirm':
          if (!value) {
            showFieldError(input, 'Vui lòng nhập lại mật khẩu');
            valid = false;
          } else if (value !== (data.password || '')) {
            showFieldError(input, 'Mật khẩu nhập lại không khớp');
            valid = false;
          } else {
            showFieldError(input, '');
          }
          break;

        default:
          showFieldError(input, '');
      }
    });

    return { valid, data };
  }

  /* ============================================================
     4. TOGGLE PASSWORD (HIỂN THỊ / ẨN MẬT KHẨU)
     ============================================================ */

  /**
   * Khởi tạo chức năng toggle password cho tất cả input có selector phù hợp
   */
  function initPasswordToggles() {
    $$(CONFIG.selectors.togglePassword).forEach((button) => {
      button.addEventListener('click', () => {
        // Lấy ID input đích (data-target="...") hoặc input kế cận
        let targetInput = null;
        const targetId = button.dataset.target;
        if (targetId) {
          targetInput = document.getElementById(targetId);
        } else {
          const wrapper = button.closest('.auth__input-wrapper');
          targetInput = wrapper ? wrapper.querySelector('input') : null;
        }
        if (!targetInput) return;

        // Đổi type của input
        const isPassword = targetInput.type === 'password';
        targetInput.type = isPassword ? 'text' : 'password';

        // Đổi icon và nhãn aria
        button.setAttribute('aria-pressed', String(isPassword));
        const label = isPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
        button.setAttribute('aria-label', label);
        button.title = label;
        button.classList.toggle('is-active', isPassword);

        const eyeIcon = button.querySelector('[data-icon="eye"]');
        const eyeOffIcon = button.querySelector('[data-icon="eye-off"]');
        if (eyeIcon) eyeIcon.style.display = isPassword ? 'none' : '';
        if (eyeOffIcon) eyeOffIcon.style.display = isPassword ? '' : 'none';
      });
    });
  }

  /* ============================================================
     5. AJAX SUBMIT (GỬI FORM QUA FETCH API)
     ============================================================ */

  /**
   * Gửi form qua AJAX với fetch API
   * @param {Element} form
   * @param {Object} data - Dữ liệu đã validate
   * @returns {Promise<void>}
   */
  async function submitAjax(form, data) {
    const submitBtn = form.querySelector('[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    const formType = form.dataset.authType || '';
    const endpoint = CONFIG.endpoints[formType] || form.action || window.location.href;

    // Khóa nút submit khi đang xử lý
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xử lý...';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.ajaxTimeout);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Thử parse JSON; nếu thất bại thì trả về thông báo mặc định
      let result;
      try {
        result = await response.json();
      } catch (err) {
        result = { success: response.ok, message: response.ok ? 'Thành công!' : 'Có lỗi xảy ra. Vui lòng thử lại.' };
      }

      if (result.success) {
        showAlert(form, result.message || 'Thành công!', 'success');
        form.reset();

        // Nếu backend trả về redirect URL, chuyển hướng
        if (result.redirect) {
          setTimeout(() => {
            window.location.href = result.redirect;
          }, 800);
        }
      } else {
        showAlert(form, result.message || 'Thao tác thất bại. Vui lòng thử lại.', 'error');
      }
    } catch (error) {
      // Lỗi mạng hoặc request bị huỷ
      const message = error.name === 'AbortError'
        ? 'Yêu cầu bị timeout. Vui lòng thử lại.'
        : 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.';
      showAlert(form, message, 'error');
    } finally {
      // Mở lại nút submit
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  /* ============================================================
     6. SUBMIT HANDLER (XỬ LÝ KHI GỬI FORM)
     ============================================================ */

  /**
   * Hàm xử lý submit cho từng form auth
   * - Ngăn chặn submit mặc định
   * - Validate phía client
   * - Gửi qua AJAX (nếu có data-auth-ajax="true" hoặc mặc định)
   * @param {Event} event
   */
  function handleFormSubmit(event) {
    const form = event.target.closest(CONFIG.selectors.forms);
    if (!form) return;

    event.preventDefault();
    clearFormErrors(form);

    const { valid, data } = validateForm(form);

    if (!valid) {
      // Focus vào input lỗi đầu tiên
      const firstError = $('.auth__input--error', form);
      if (firstError) firstError.focus();
      showAlert(form, 'Vui lòng kiểm tra lại các trường thông tin.', 'error');
      return;
    }

    // Gửi qua AJAX (mặc định). Nếu muốn submit HTML thường -> set data-auth-ajax="false"
    const useAjax = form.dataset.authAjax !== 'false';
    if (useAjax) {
      submitAjax(form, data);
    } else {
      // Submit HTML thường - bỏ qua, để form chạy action mặc định
      // (Tuy nhiên vì đã preventDefault, ta phải submit lại thủ công)
      form.submit();
    }
  }

  /* ============================================================
     7. REAL-TIME VALIDATION (VALIDATE KHI GÕ)
     ============================================================ */

  /**
   * Nghe sự kiện input/blur để xoá lỗi real-time
   */
  function initRealTimeValidation() {
    $$(CONFIG.selectors.forms).forEach((form) => {
      $$('input', form).forEach((input) => {
        // Khi người dùng bắt đầu gõ -> xoá lỗi của field đó
        input.addEventListener('input', () => {
          if (input.classList.contains('auth__input--error')) {
            showFieldError(input, '');
          }
        });

        // Khi blur -> validate nhẹ (chỉ field đó)
        input.addEventListener('blur', () => {
          if (!input.value.trim() && !input.required) return;
          const wrapper = input.closest('.auth__field');
          if (!wrapper) return;

          // Validate đơn giản cho field hiện tại
          const name = input.name;
          const value = input.value.trim();

          if (name === 'email' && value && !isValidEmail(value)) {
            showFieldError(input, 'Email không hợp lệ');
          } else if (name === 'password_confirm' && value) {
            const passwordInput = $('input[name="password"]', form);
            if (passwordInput && value !== passwordInput.value) {
              showFieldError(input, 'Mật khẩu nhập lại không khớp');
            } else {
              showFieldError(input, '');
            }
          }
        });
      });
    });
  }

  /* ============================================================
     8. KEYBOARD NAVIGATION (PHÍM TẮT)
     ============================================================ */

  /**
   * Thêm phím tắt: Enter để submit form, ESC để xoá input focus
   */
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // ESC -> blur input hiện tại
      if (event.key === 'Escape' && document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
        hideAlert(document.activeElement.closest(CONFIG.selectors.forms));
      }
    });
  }

  /* ============================================================
     9. KHỞI TẠO (INIT)
     ============================================================ */

  function init() {
    // Chỉ chạy nếu trang có form auth
    const forms = $$(CONFIG.selectors.forms);
    if (!forms.length) return;

    // Đăng ký các sự kiện
    document.addEventListener('submit', handleFormSubmit);
    initPasswordToggles();
    initRealTimeValidation();
    initKeyboardShortcuts();

    // Log nhỏ khi dev mode (chỉ console)
    if (window.console && console.info) {
      console.info('[account.js] Đã khởi tạo xong authentication module.');
    }
  }

  // Khởi chạy khi DOM sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();



