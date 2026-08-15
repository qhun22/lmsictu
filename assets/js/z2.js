document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Kích hoạt Lottie Animation (Vẽ chữ Hola đúng 1 lần)
  function initLottie() {
    const lottieContainer = document.querySelector('.hero_lottie');
    if (lottieContainer && typeof lottie !== 'undefined') {
      lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: false, // Chạy 1 lần rồi dừng hẳn
        autoplay: true,
        path: 'https://cdn.prod.website-files.com/662fb92f905585b61b12afd8/6663119e52bd5d7d95969d71_hola-pocoyo.json'
      });
    } else if (lottieContainer) {
      setTimeout(initLottie, 100);
    }
  }

  // 2. Kích hoạt Swiper Sliders (Hero Slider & Meet the Gang)
  function initSwipers() {
    if (typeof Swiper === 'undefined') {
      setTimeout(initSwipers, 100);
      return;
    }

    // Hero Main Slider
    new Swiper('.hero_component', {
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      pagination: {
        el: '.about_slider-dots',
        clickable: true,
      },
    });

    // Meet the Gang Slider
    new Swiper('[data-slider="slider-gang"]', {
      loop: false,
      keyboard: true,
      slidesPerView: 'auto',
      spaceBetween: 16,
      navigation: {
        nextEl: '.swiper-button-next-gang',
        prevEl: '.swiper-button-prev-gang',
      },
    });
  }

  initLottie();
  initSwipers();
});