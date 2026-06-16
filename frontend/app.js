/**
 * 城市·谛听 CityListen — 智慧城市声谱安防系统
 * 全功能交互前端应用
 * 零依赖 · 原生 JavaScript
 */
(function () {
  'use strict';

  // =========================================================================
  // App 命名空间
  // =========================================================================
  const App = {
    state: {
      // 事件存储 (id -> [等级, 标题, 描述, 颜色键, 时间字符串, 地点, 类型, 置信度, 持续时长, 联动动作])
      events: {},
      eventOrder: [],       // 事件ID顺序列表(新→旧)
      activeFilter: 'all',  // 当前筛选等级
      searchQuery: '',      // 搜索关键词
      activeStep: 1,        // 当前故事线步骤
      autoStepTimer: null,  // 自动推进定时器
      activeHourFilter: null, // 趋势图选中的时段
      mapZoom: 1,           // 地图缩放比例
      kpiIntervals: [],     // KPI定时器引用
      kpiValues: { online: 128, today: 43, latency: 0.68, accuracy: 94.3 },
      simRunning: false,    // 模拟器运行状态
      simSpeed: 1,          // 模拟速度: 1/2/5
      simTimer: null,       // 模拟器定时器
      eventCounter: 5,      // 事件ID计数器
      dispositionState: 'pending', // 当前事件处置状态
      currentEventId: 'E-240617-03', // 当前选中事件
      isPlayingWaveform: false,
      toastCount: 0,
      metricAnimated: false,
    },

    // =======================================================================
    // 工具函数
    // =======================================================================
    utils: {
      $(s, p) { return (p || document).querySelector(s); },
      $$(s, p) { return Array.from((p || document).querySelectorAll(s)); },

      debounce(fn, ms) {
        let t;
        return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
      },

      formatDate(dateStr) {
        return dateStr.replace('T', ' ');
      },

      formatRelativeTime(dateStr) {
        const d = new Date(dateStr.replace('T', 'T'));
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
        return Math.floor(diff / 86400) + ' 天前';
      },

      animateNumber(el, target, duration, suffix) {
        const start = parseFloat(el.textContent) || 0;
        const startTime = performance.now();
        const isInt = Number.isInteger(target);
        suffix = suffix || '';

        function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

        function frame(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutExpo(progress);
          const current = start + (target - start) * eased;
          el.textContent = (isInt ? Math.round(current) : current.toFixed(1)) + suffix;
          if (progress < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      },

      escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
      },

      randomBetween(min, max) { return min + Math.random() * (max - min); },
      randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
      pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

      clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

      generateId() {
        const d = new Date();
        const y = d.getFullYear().toString().slice(2);
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        App.state.eventCounter++;
        return 'E-' + y + m + day + '-' + String(App.state.eventCounter).padStart(2, '0');
      },

      nowString() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
          'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      },
    },

    // =======================================================================
    // 认证模块
    // =======================================================================
    auth: {
      init() {
        const self = App.auth;
        const $ = App.utils.$;
        App.utils.$('#loginBtn').addEventListener('click', self.openLogin);
        App.utils.$('#enterAppBtn').addEventListener('click', (e) => { e.preventDefault(); self.openLogin(); });
        App.utils.$('#bottomEnterBtn').addEventListener('click', self.openLogin);
        App.utils.$$('[data-close]', App.utils.$('#loginModal')).forEach((el) =>
          el.addEventListener('click', self.closeLogin)
        );
        App.utils.$('#loginForm').addEventListener('submit', self.handleLogin);
        App.utils.$('#logoutBtn').addEventListener('click', self.logout);

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            if (!App.utils.$('#loginModal').hidden) self.closeLogin();
            if (!App.utils.$('#app').hidden) App.notify.dismissAll();
          }
        });
      },

      openLogin() {
        const $ = App.utils.$;
        const modal = $('#loginModal');
        modal.hidden = false;
        $('#authUser').value = '';
        $('#authPass').value = '';
        $('#authErr').hidden = true;
        setTimeout(() => $('#authUser').focus(), 100);
      },

      closeLogin() {
        const modal = App.utils.$('#loginModal');
        modal.hidden = true;
        App.utils.$('#authErr').hidden = true;
      },

      handleLogin(e) {
        e.preventDefault();
        const $ = App.utils.$;
        const u = $('#authUser').value.trim();
        const p = $('#authPass').value.trim();

        // 模拟加载状态
        const btn = $('#loginForm').querySelector('.auth-submit');
        const origText = btn.textContent;
        btn.textContent = '验证中...';
        btn.disabled = true;

        setTimeout(() => {
          if (u === 'admin' && p === 'admin') {
            App.auth.closeLogin();
            App.auth.enterApp();
          } else {
            $('#authErr').hidden = false;
            // 抖动效果
            const card = App.utils.$('.auth-card');
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = 'shake 0.5s ease';
          }
          btn.textContent = origText;
          btn.disabled = false;
        }, 400);
      },

      enterApp() {
        const app = App.utils.$('#app');
        app.hidden = false;
        document.body.style.overflow = 'hidden';
        // 初始化工作台各模块
        App.kpi.start();
        App.simulator.start();
        App.eventQueue.renderList();
        App.eventDetail.showEvent(App.state.currentEventId);
        App.waveform.draw(App.state.currentEventId);
      },

      logout() {
        const app = App.utils.$('#app');
        app.hidden = true;
        document.body.style.overflow = '';
        App.kpi.stop();
        App.simulator.stop();
        App.notify.dismissAll();
        App.state.mapZoom = 1;
        App.map.resetZoom();
      },
    },

    // =======================================================================
    // 导航滚动监听
    // =======================================================================
    nav: {
      init() {
        const self = App.nav;
        const sections = App.utils.$$('section[id]');
        const navLinks = App.utils.$$('nav a[href^="#"]');

        // 点击平滑滚动
        navLinks.forEach((a) => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const target = App.utils.$(a.getAttribute('href'));
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
              self.setActive(a);
            }
          });
        });

        // 滚动监听 (节流)
        let ticking = false;
        window.addEventListener('scroll', () => {
          if (!ticking) {
            requestAnimationFrame(() => {
              self.onScroll(sections, navLinks);
              ticking = false;
            });
            ticking = true;
          }
        }, { passive: true });
      },

      onScroll(sections, navLinks) {
        const scrollPos = window.scrollY + window.innerHeight / 2;
        let current = null;

        sections.forEach((sec) => {
          if (sec.offsetTop <= scrollPos && sec.offsetTop + sec.offsetHeight > scrollPos) {
            current = sec.id;
          }
        });

        if (current) {
          navLinks.forEach((a) => {
            a.classList.toggle('nav-active', a.getAttribute('href') === '#' + current);
          });
        }
      },

      setActive(link) {
        App.utils.$$('nav a[href^="#"]').forEach((a) => a.classList.remove('nav-active'));
        if (link) link.classList.add('nav-active');
      },
    },

    // =======================================================================
    // Hero 指标动画
    // =======================================================================
    hero: {
      init() {
        const metricsEl = App.utils.$('.metrics');
        if (!metricsEl) return;

        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !App.state.metricAnimated) {
              App.state.metricAnimated = true;
              App.hero.animate();
            } else if (!entry.isIntersecting) {
              // 允许重新触发
              App.state.metricAnimated = false;
              App.hero.reset();
            }
          });
        }, { threshold: 0.4 });

        observer.observe(metricsEl);
      },

      animate() {
        const values = App.utils.$$('.metric-value');
        values.forEach((el) => {
          const target = parseFloat(el.dataset.target);
          const suffix = el.dataset.suffix || '';
          App.utils.animateNumber(el, target, 1400, suffix);
        });
      },

      reset() {
        App.utils.$$('.metric-value').forEach((el) => {
          el.textContent = '0' + (el.dataset.suffix || '');
        });
      },
    },

    // =======================================================================
    // 事件链路分步展示
    // =======================================================================
    storyline: {
      init() {
        const cards = App.utils.$$('.storyline article[data-step]');
        if (!cards.length) return;

        cards.forEach((card) => {
          card.addEventListener('click', () => {
            const step = parseInt(card.dataset.step);
            App.storyline.stepTo(step);
          });
        });

        // 自动演示按钮
        App.utils.$('#storylineAutoBtn')?.addEventListener('click', () => {
          const btn = App.utils.$('#storylineAutoBtn');
          if (App.state.autoStepTimer) {
            App.storyline.stopAuto();
            if (btn) btn.textContent = '▶ 自动演示';
          } else {
            App.storyline.autoAdvance();
            if (btn) btn.textContent = '⏸ 停止演示';
          }
        });

        // 初始状态
        App.storyline.stepTo(1);
      },

      stepTo(n) {
        App.state.activeStep = n;
        App.storyline.clearAuto();

        const cards = App.utils.$$('.storyline article[data-step]');
        cards.forEach((card) => {
          const step = parseInt(card.dataset.step);
          card.classList.remove('step-active', 'step-completed', 'step-upcoming');
          if (step < n) card.classList.add('step-completed');
          else if (step === n) card.classList.add('step-active');
          else card.classList.add('step-upcoming');
        });

        // 更新进度点
        const dots = App.utils.$$('.storyline-dot');
        dots.forEach((dot, i) => {
          dot.classList.remove('active', 'done');
          if (i + 1 < n) dot.classList.add('done');
          else if (i + 1 === n) dot.classList.add('active');
        });
      },

      autoAdvance() {
        App.storyline.clearAuto();
        App.state.autoStepTimer = setInterval(() => {
          const next = App.state.activeStep + 1;
          if (next > 4) {
            App.storyline.stepTo(1);
          } else {
            App.storyline.stepTo(next);
          }
        }, 3000);
      },

      clearAuto() {
        if (App.state.autoStepTimer) {
          clearInterval(App.state.autoStepTimer);
          App.state.autoStepTimer = null;
        }
        const btn = App.utils.$('#storylineAutoBtn');
        if (btn) btn.textContent = '▶ 自动演示';
      },

      stopAuto() {
        App.storyline.clearAuto();
        // 更新按钮状态
        const btn = App.utils.$('#storylineAutoBtn');
        if (btn) btn.textContent = '自动演示';
      },
    },

    // =======================================================================
    // 事件筛选
    // =======================================================================
    filter: {
      init() {
        const self = App.filter;
        App.utils.$$('.filter').forEach((btn) => {
          btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            App.utils.$$('.filter').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            App.state.activeFilter = level;
            App.state.activeHourFilter = null;
            // 清除趋势图选中
            App.utils.$$('.bars i').forEach((b) => b.classList.remove('selected'));
            App.eventQueue.renderList();
            App.trend.updateBars();
          });
        });
      },
    },

    // =======================================================================
    // 实时KPI
    // =======================================================================
    kpi: {
      init() {
        // KPI DOM 已在 index.html 中设置 data-kpi 属性
      },

      start() {
        App.kpi.stop();
        const intervals = App.state.kpiIntervals;

        // 在线点位: 每 4-8 秒波动 ±1
        intervals.push(setInterval(() => {
          App.state.kpiValues.online = App.utils.clamp(
            App.state.kpiValues.online + App.utils.randomInt(-1, 1), 124, 133
          );
          App.kpi.updateDisplay('online', App.state.kpiValues.online);
        }, App.utils.randomInt(4000, 8000)));

        // 平均时延: 每 6-12 秒慢速波动
        intervals.push(setInterval(() => {
          App.state.kpiValues.latency = App.utils.clamp(
            +(App.state.kpiValues.latency + App.utils.randomBetween(-0.03, 0.03)).toFixed(2),
            0.52, 0.85
          );
          App.kpi.updateDisplay('latency', App.state.kpiValues.latency.toFixed(2) + 's');
        }, App.utils.randomInt(6000, 12000)));

        // 准确率: 每 7-14 秒慢速波动
        intervals.push(setInterval(() => {
          App.state.kpiValues.accuracy = App.utils.clamp(
            +(App.state.kpiValues.accuracy + App.utils.randomBetween(-0.2, 0.2)).toFixed(1),
            93.5, 95.5
          );
          App.kpi.updateDisplay('accuracy', App.state.kpiValues.accuracy.toFixed(1) + '%');
        }, App.utils.randomInt(7000, 14000)));
      },

      stop() {
        App.state.kpiIntervals.forEach(clearInterval);
        App.state.kpiIntervals = [];
      },

      incrementToday() {
        App.state.kpiValues.today++;
        App.kpi.updateDisplay('today', App.state.kpiValues.today);
        // 脉冲动画
        const el = App.utils.$('.kpi-value[data-kpi="today"]');
        if (el) {
          el.classList.add('pulse-up');
          setTimeout(() => el.classList.remove('pulse-up'), 800);
        }
      },

      updateDisplay(key, value) {
        const el = App.utils.$('.kpi-value[data-kpi="' + key + '"]');
        if (!el) return;
        const prev = el.textContent;
        el.textContent = value;
        if (prev !== String(value)) {
          const numPrev = parseFloat(prev);
          const numVal = parseFloat(value);
          if (!isNaN(numPrev) && !isNaN(numVal)) {
            el.classList.add(numVal >= numPrev ? 'pulse-up' : 'pulse-down');
            setTimeout(() => el.classList.remove('pulse-up', 'pulse-down'), 900);
          }
        }
      },
    },

    // =======================================================================
    // 地图交互
    // =======================================================================
    map: {
      init() {
        const self = App.map;
        const container = App.utils.$('.map-container');
        if (!container) return;

        // 热点点击
        App.utils.$$('.map-hotspot').forEach((hs) => {
          hs.addEventListener('click', (e) => {
            e.stopPropagation();
            const sensorId = hs.dataset.sensor;
            // 找到该传感器的最新事件
            const eventId = self.findEventForSensor(sensorId);
            if (eventId) {
              App.state.currentEventId = eventId;
              App.eventDetail.showEvent(eventId);
              App.waveform.draw(eventId);
            }
            // 高亮热点
            App.utils.$$('.map-hotspot').forEach((h) => h.classList.remove('active'));
            hs.classList.add('active');
          });

          hs.addEventListener('mouseenter', (e) => {
            self.showTooltip(hs, e);
          });

          hs.addEventListener('mouseleave', () => {
            self.hideTooltip();
          });
        });

        // 缩放按钮
        App.utils.$('#mapZoomIn')?.addEventListener('click', () => self.zoomIn());
        App.utils.$('#mapZoomOut')?.addEventListener('click', () => self.zoomOut());
        App.utils.$('#mapZoomReset')?.addEventListener('click', () => self.resetZoom());

        // 滚轮缩放
        container.addEventListener('wheel', (e) => {
          e.preventDefault();
          if (e.deltaY < 0) self.zoomIn();
          else self.zoomOut();
        }, { passive: false });

        // 双击缩放
        container.addEventListener('dblclick', (e) => {
          if (App.state.mapZoom < 1.5) self.zoomIn();
          else self.resetZoom();
        });

        // 点击空白处取消选中
        container.addEventListener('click', (e) => {
          if (e.target === container || e.target.tagName === 'IMG') {
            App.utils.$$('.map-hotspot').forEach((h) => h.classList.remove('active'));
            self.hideTooltip();
          }
        });
      },

      showTooltip(hs, e) {
        const tooltip = App.utils.$('#mapTooltip');
        if (!tooltip) return;
        const info = JSON.parse(hs.dataset.info || '{}');
        tooltip.innerHTML =
          '<strong>' + App.utils.escapeHtml(info.name || '') + '</strong><br>' +
          '<span style="color:rgba(234,248,241,.55)">' + App.utils.escapeHtml(info.location || '') +
          (info.lastEvent ? ' · 最后: ' + App.utils.escapeHtml(info.lastEvent) : '') + '</span>';
        tooltip.hidden = false;

        const container = App.utils.$('.map-container');
        const rect = container.getBoundingClientRect();
        const hsLeft = parseFloat(hs.style.left) / 100 * rect.width;
        const hsTop = parseFloat(hs.style.top) / 100 * rect.height;
        tooltip.style.left = (hsLeft + 18) + 'px';
        tooltip.style.top = (hsTop - 50) + 'px';
      },

      hideTooltip() {
        const tooltip = App.utils.$('#mapTooltip');
        if (tooltip) tooltip.hidden = true;
      },

      findEventForSensor(sensorId) {
        // 根据传感器ID查找对应事件
        const sensorEventMap = {
          '08': 'E-240617-03', // 星河商业街
          '22': 'E-240617-02', // 江湾大道路口
          '15': 'E-240617-01', // 评路图书馆
          '30': 'E-240617-05', // 滨江隧道
          '41': 'E-240617-04', // 市民公园
        };
        return sensorEventMap[sensorId] || App.state.eventOrder[0];
      },

      zoomIn() {
        App.state.mapZoom = App.utils.clamp(App.state.mapZoom + 0.25, 1, 2);
        App.map.applyZoom();
      },

      zoomOut() {
        App.state.mapZoom = App.utils.clamp(App.state.mapZoom - 0.25, 1, 2);
        App.map.applyZoom();
      },

      resetZoom() {
        App.state.mapZoom = 1;
        App.map.applyZoom();
      },

      applyZoom() {
        const img = App.utils.$('.map-container img');
        if (img) {
          img.style.transform = 'scale(' + App.state.mapZoom + ')';
        }
        const zLabel = App.utils.$('#zoomLabel');
        if (zLabel) zLabel.textContent = Math.round(App.state.mapZoom * 100) + '%';
      },

      highlightHotspot(level) {
        // 当新事件是红/橙色时，闪烁对应热点
        const hotspots = App.utils.$$('.map-hotspot');
        const target = Array.from(hotspots).find((h) => {
          const info = JSON.parse(h.dataset.info || '{}');
          return info.riskLevel === level;
        });
        if (target) {
          target.classList.add('pulse-hotspot');
          setTimeout(() => target.classList.remove('pulse-hotspot'), 2000);
        }
      },
    },

    // =======================================================================
    // 趋势图交互
    // =======================================================================
    trend: {
      init() {
        const bars = App.utils.$$('.bars i');
        if (!bars.length) return;

        bars.forEach((bar) => {
          bar.addEventListener('mouseenter', (e) => {
            App.trend.showTooltip(bar, e);
          });
          bar.addEventListener('mouseleave', () => {
            App.trend.hideTooltip();
          });
          bar.addEventListener('click', () => {
            App.trend.handleBarClick(bar);
          });
        });

        App.trend.updateBars();
      },

      showTooltip(bar, e) {
        const tooltip = App.utils.$('#barTooltip');
        if (!tooltip) return;
        const hour = bar.dataset.hour || '';
        const count = bar.dataset.count || '0';
        const redCount = bar.dataset.redCount || '0';
        tooltip.innerHTML =
          '<strong>' + App.utils.escapeHtml(hour) + '</strong> · ' +
          count + ' 事件' +
          (redCount > 0 ? ' · <span style="color:var(--red)">' + redCount + ' 红色</span>' : '');
        tooltip.hidden = false;

        const rect = bar.getBoundingClientRect();
        const parent = App.utils.$('.bars');
        const parentRect = parent.getBoundingClientRect();
        tooltip.style.left = (rect.left - parentRect.left + rect.width / 2) + 'px';
        tooltip.style.top = (rect.top - parentRect.top - 40) + 'px';
      },

      hideTooltip() {
        const tooltip = App.utils.$('#barTooltip');
        if (tooltip) tooltip.hidden = true;
      },

      handleBarClick(bar) {
        const hour = bar.dataset.hour;
        const bars = App.utils.$$('.bars i');
        if (App.state.activeHourFilter === hour) {
          // 取消选中
          App.state.activeHourFilter = null;
          bars.forEach((b) => b.classList.remove('selected'));
        } else {
          App.state.activeHourFilter = hour;
          bars.forEach((b) => b.classList.toggle('selected', b.dataset.hour === hour));
          // 也重置等级筛选
          App.state.activeFilter = 'all';
          App.utils.$$('.filter').forEach((b) => b.classList.remove('active'));
          const allFilter = App.utils.$('.filter[data-level="all"]');
          if (allFilter) allFilter.classList.add('active');
        }
        App.eventQueue.renderList();
      },

      updateBars() {
        // 根据当前筛选更新柱状图高度和count
        const hourSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
        const bars = App.utils.$$('.bars i');

        // 统计每个时段的符合筛选条件的事件数
        const counts = hourSlots.map(() => 0);
        const redCounts = hourSlots.map(() => 0);

        App.state.eventOrder.forEach((id) => {
          const ev = App.state.events[id];
          if (!ev) return;
          const level = ev[3];
          if (App.state.activeFilter !== 'all' && level !== App.state.activeFilter) return;

          // 用事件ID最后两位映射到时段
          const slotIndex = (parseInt(id.split('-')[2]) || 1) % hourSlots.length;
          counts[slotIndex]++;
          if (level === 'red') redCounts[slotIndex]++;
        });

        // 确保至少有基础高度
        const baseCounts = [3, 5, 4, 7, 9, 12, 8];
        const maxCount = Math.max(...counts, ...baseCounts, 1);

        bars.forEach((bar, i) => {
          const displayCount = counts[i] || baseCounts[i];
          const height = Math.max(8, (displayCount / maxCount) * 100);
          bar.style.setProperty('--h', height + '%');
          bar.dataset.count = displayCount;
          bar.dataset.redCount = redCounts[i] || 0;
          bar.dataset.hour = hourSlots[i];
        });
      },
    },

    // =======================================================================
    // 事件队列
    // =======================================================================
    eventQueue: {
      init() {
        const list = App.utils.$('#eventList');
        if (!list) return;

        // 事件委托
        list.addEventListener('click', (e) => {
          const li = e.target.closest('li[data-event-id]');
          if (!li) return;
          const id = li.dataset.eventId;
          App.state.currentEventId = id;
          App.eventDetail.showEvent(id);
          App.waveform.draw(id);
        });

        // 初始渲染
        App.eventQueue.renderList();
      },

      addEvent(eventData) {
        const id = App.utils.generateId();
        const now = App.utils.nowString();
        App.state.events[id] = [
          eventData.levelName,    // [0] 等级名称
          eventData.title,        // [1] 标题
          eventData.description,  // [2] 描述
          eventData.level,        // [3] 颜色键
          now,                    // [4] 时间
          eventData.location,     // [5] 地点
          eventData.type,         // [6] 事件类型
          eventData.confidence,   // [7] 置信度
          eventData.duration,     // [8] 持续时长
          eventData.actions,      // [9] 联动动作
        ];
        App.state.eventOrder.unshift(id);

        // 限制队列长度
        while (App.state.eventOrder.length > 20) {
          // 优先移除最旧的非红色事件
          let removed = false;
          for (let i = App.state.eventOrder.length - 1; i >= 0; i--) {
            const eid = App.state.eventOrder[i];
            if (App.state.events[eid] && App.state.events[eid][3] !== 'red') {
              delete App.state.events[eid];
              App.state.eventOrder.splice(i, 1);
              removed = true;
              break;
            }
          }
          if (!removed) {
            const lastId = App.state.eventOrder.pop();
            delete App.state.events[lastId];
          }
        }

        App.eventQueue.renderList();
        App.trend.updateBars();
        App.kpi.incrementToday();
        return id;
      },

      removeEvent(id) {
        delete App.state.events[id];
        App.state.eventOrder = App.state.eventOrder.filter((eid) => eid !== id);
        App.eventQueue.renderList();
        App.trend.updateBars();
      },

      getFilteredEvents() {
        let ids = App.state.eventOrder.slice();

        // 等级筛选
        if (App.state.activeFilter !== 'all') {
          ids = ids.filter((id) => App.state.events[id] && App.state.events[id][3] === App.state.activeFilter);
        }

        // 时段筛选
        if (App.state.activeHourFilter) {
          const hourSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
          const slotIndex = hourSlots.indexOf(App.state.activeHourFilter);
          ids = ids.filter((id) => {
            const idx = (parseInt(id.split('-')[2]) || 1) % hourSlots.length;
            return idx === slotIndex;
          });
        }

        // 搜索筛选
        if (App.state.searchQuery) {
          const q = App.state.searchQuery.toLowerCase();
          ids = ids.filter((id) => {
            const ev = App.state.events[id];
            if (!ev) return false;
            return (ev[1] + ev[5] + ev[6] + id).toLowerCase().includes(q);
          });
        }

        return ids;
      },

      renderList() {
        const list = App.utils.$('#eventList');
        if (!list) return;
        const filtered = App.eventQueue.getFilteredEvents();
        const emptyEl = App.utils.$('#eventListEmpty');

        if (filtered.length === 0) {
          list.innerHTML = '';
          if (emptyEl) emptyEl.hidden = false;
        } else {
          if (emptyEl) emptyEl.hidden = true;
          list.innerHTML = filtered.map((id) => {
            const ev = App.state.events[id];
            if (!ev) return '';
            const isNew = id === App.state.eventOrder[0] && App.state.eventOrder.length > 5;
            return '<li data-event-id="' + id + '" data-level="' + ev[3] + '"' +
              (isNew ? ' class="new-event"' : '') + '>' +
              '<b class="' + ev[3] + '"></b>' +
              '<span>' + App.utils.escapeHtml(ev[1]) + '</span>' +
              '<em>' + ev[0] + (isNew ? ' <small class="event-badge-new">NEW</small>' : '') + '</em>' +
              '</li>';
          }).join('');
        }

        // 更新搜索结果计数
        const countEl = App.utils.$('#searchCount');
        if (countEl) {
          countEl.textContent = App.state.searchQuery ? '找到 ' + filtered.length + ' 条结果' : '';
        }
      },
    },

    // =======================================================================
    // 事件详情
    // =======================================================================
    eventDetail: {
      init() {
        // 处置状态点击切换
        App.utils.$('#dispositionBadge')?.addEventListener('click', () => {
          App.eventDetail.cycleDisposition();
        });

        // 复制链接按钮
        App.utils.$('#copyLinkBtn')?.addEventListener('click', () => {
          App.eventDetail.copyLink();
        });

        // 视频帧切换
        App.utils.$('#videoFrameBtn')?.addEventListener('click', () => {
          App.eventDetail.cycleVideoFrame();
        });

        // 初始加载
        App.eventDetail.showEvent(App.state.currentEventId);
      },

      showEvent(id) {
        const ev = App.state.events[id];
        if (!ev) return;
        App.state.currentEventId = id;

        const $ = App.utils.$;
        const levelEl = $('#detailLevel');
        const titleEl = $('#detailTitle');
        const textEl = $('#detailText');
        const idEl = $('#detailId');
        const timeEl = $('#detailTime');
        const confEl = $('#detailConfidence');
        const durEl = $('#detailDuration');
        const actionsEl = $('#detailActions');
        const locationEl = $('#detailLocation');

        if (levelEl) { levelEl.textContent = ev[0]; levelEl.className = 'badge ' + ev[3]; }
        if (titleEl) titleEl.textContent = ev[5] + ' · ' + ev[6];
        if (textEl) textEl.textContent = ev[2];
        if (idEl) idEl.textContent = id;
        if (timeEl) timeEl.textContent = App.utils.formatDate(ev[4]);
        if (confEl) confEl.textContent = (ev[7] || '0.85');
        if (durEl) durEl.textContent = (ev[8] || '8.0') + 's';
        if (actionsEl) actionsEl.textContent = ev[9] || '地图弹窗、视频截取、日志入库、处置队列';
        if (locationEl) locationEl.textContent = ev[5];

        // 更新波形边界
        const boundaryEl = App.utils.$('.boundary-marker');
        if (boundaryEl) boundaryEl.textContent = '事件中 ' + (ev[8] || '8.0') + 's';

        // 高亮事件列表对应项
        App.utils.$$('#eventList li').forEach((li) => {
          li.classList.toggle('event-active', li.dataset.eventId === id);
        });
      },

      cycleDisposition() {
        const states = ['pending', 'processing', 'resolved'];
        const labels = ['待处置', '处置中', '已处置'];
        const classes = ['badge-red', 'badge-orange', 'badge-green'];
        const current = states.indexOf(App.state.dispositionState);
        const next = (current + 1) % states.length;
        App.state.dispositionState = states[next];

        const badge = App.utils.$('#dispositionBadge');
        if (badge) {
          badge.textContent = labels[next];
          badge.className = 'badge disposition-badge ' + classes[next];
        }

        App.notify.show(
          next === 2 ? 'success' : 'info',
          '处置状态已更新为「' + labels[next] + '」'
        );
      },

      copyLink() {
        const id = App.state.currentEventId;
        const fakeUrl = 'https://citylisten.demo/events/' + id;
        navigator.clipboard.writeText(fakeUrl).then(() => {
          App.notify.show('success', '事件链接已复制到剪贴板');
        }).catch(() => {
          App.notify.show('info', '链接: ' + fakeUrl);
        });
      },

      cycleVideoFrame() {
        const img = App.utils.$('.replay-thumb img');
        if (!img) return;
        // 通过调整色调模拟不同帧
        const frames = [
          'none',
          'sepia(0.3) hue-rotate(10deg)',
          'sepia(0.1) brightness(1.1)',
          'none',
        ];
        const current = img.dataset.frame ? parseInt(img.dataset.frame) : 0;
        const next = (current + 1) % frames.length;
        img.dataset.frame = next;
        img.style.filter = frames[next];
        img.style.transition = 'filter 0.5s ease';

        const btn = App.utils.$('#videoFrameBtn');
        if (btn) btn.textContent = next === 0 ? '▶ 回放视频帧' : '下一帧 (' + (next + 1) + '/3)';
      },
    },

    // =======================================================================
    // 搜索
    // =======================================================================
    search: {
      init() {
        const input = App.utils.$('#searchInput');
        const clearBtn = App.utils.$('#searchClear');
        if (!input) return;

        const debouncedSearch = App.utils.debounce(function () {
          App.state.searchQuery = input.value.trim();
          App.eventQueue.renderList();
          App.trend.updateBars();
          App.search.updateClearBtn();
        }, 300);

        input.addEventListener('input', debouncedSearch);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            input.value = '';
            App.state.searchQuery = '';
            App.eventQueue.renderList();
            App.trend.updateBars();
            App.search.updateClearBtn();
            input.blur();
          }
        });

        clearBtn?.addEventListener('click', () => {
          input.value = '';
          App.state.searchQuery = '';
          App.eventQueue.renderList();
          App.trend.updateBars();
          App.search.updateClearBtn();
          input.focus();
        });
      },

      updateClearBtn() {
        const clearBtn = App.utils.$('#searchClear');
        if (clearBtn) clearBtn.hidden = !App.state.searchQuery;
      },
    },

    // =======================================================================
    // Toast 通知
    // =======================================================================
    notify: {
      init() {
        // 容器由HTML提供
      },

      show(type, message) {
        const container = App.utils.$('#toastContainer');
        if (!container) return;

        // 限制同时最多3条
        const existing = App.utils.$$('.toast', container);
        if (existing.length >= 3) {
          existing[0].remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML =
          '<span class="toast-icon">' +
          (type === 'warning' ? '🔴' : type === 'success' ? '✅' : 'ℹ️') +
          '</span> ' + App.utils.escapeHtml(message);
        toast.addEventListener('click', () => {
          toast.style.animation = 'toastOut 0.3s ease forwards';
          setTimeout(() => toast.remove(), 300);
        });

        container.appendChild(toast);
        App.state.toastCount++;

        // 自动消失
        setTimeout(() => {
          if (toast.parentNode) {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
          }
        }, 4000);
      },

      dismissAll() {
        const container = App.utils.$('#toastContainer');
        if (!container) return;
        App.utils.$$('.toast', container).forEach((t) => {
          t.style.animation = 'toastOut 0.3s ease forwards';
          setTimeout(() => t.remove(), 300);
        });
      },
    },

    // =======================================================================
    // Canvas 音频波形
    // =======================================================================
    waveform: {
      animFrame: null,
      playheadPos: 0,

      init() {
        App.utils.$('#waveformPlayBtn')?.addEventListener('click', () => {
          if (App.state.isPlayingWaveform) {
            App.waveform.stop();
          } else {
            App.waveform.play();
          }
        });
      },

      generateData(eventId) {
        const ev = App.state.events[eventId];
        const type = ev ? ev[6] : '尖叫呼救';
        const duration = ev ? parseFloat(ev[8]) || 8 : 8;
        const samples = 200;
        const data = new Float32Array(samples);

        switch (type) {
          case '尖叫呼救':
            // 不规则尖峰
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              data[i] = (Math.random() * 0.6 + 0.2) *
                (1 + 2 * Math.sin(t * Math.PI * 14) * Math.sin(t * Math.PI * 3)) *
                Math.exp(-t * 0.5);
              if (Math.random() < 0.15) data[i] *= 2.5;
            }
            break;
          case '车辆碰撞':
            // 尖锐单峰 + 衰减
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              data[i] = (t < 0.05 ? 1 : Math.exp(-t * 8)) *
                (0.8 + Math.random() * 0.4) *
                (1 - t * 0.7);
            }
            break;
          case '人群聚集':
            // 密集中等振幅
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              data[i] = (0.3 + Math.random() * 0.5) *
                (1 + 0.3 * Math.sin(t * Math.PI * 20)) *
                (0.6 + 0.4 * Math.sin(t * Math.PI * 2));
            }
            break;
          case '鸣笛':
            // 持续音调
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              data[i] = (0.4 + 0.3 * Math.sin(t * Math.PI * 30)) *
                (0.8 + 0.2 * Math.sin(t * Math.PI * 4)) *
                (t < 0.1 ? t / 0.1 : 1) *
                (t > 0.85 ? (1 - t) / 0.15 : 1);
            }
            break;
          case '玻璃破碎':
            // 尖锐起音 + 快速衰减
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              const attack = t < 0.02 ? t / 0.02 : Math.exp(-t * 12);
              data[i] = attack * (0.6 + Math.random() * 0.8) *
                (1 + Math.sin(t * Math.PI * 40) * 0.3);
            }
            break;
          default:
            // 通用波形
            for (let i = 0; i < samples; i++) {
              const t = i / samples;
              data[i] = (0.2 + Math.random() * 0.6) *
                (1 + 0.5 * Math.sin(t * Math.PI * 8)) *
                Math.exp(-t * 0.3);
            }
        }
        return data;
      },

      draw(eventId) {
        const canvas = App.utils.$('#waveformCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width * dpr;
        const height = 120 * dpr;

        canvas.width = width;
        canvas.height = height;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = '120px';

        const data = App.waveform.generateData(eventId);
        const samples = data.length;
        const midY = height / 2;
        const maxAmp = height * 0.42;

        ctx.clearRect(0, 0, width, height);

        // 背景网格
        ctx.strokeStyle = 'rgba(98,199,255,0.06)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += height / 6) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // 事件前区域 (前 25%)
        const preEnd = width * 0.25;
        ctx.fillStyle = 'rgba(98,199,255,0.04)';
        ctx.fillRect(0, 0, preEnd, height);

        // 事件后区域 (后 35%)
        const postStart = width * 0.65;
        ctx.fillStyle = 'rgba(98,199,255,0.04)';
        ctx.fillRect(postStart, 0, width - postStart, height);

        // 事件中区域
        ctx.fillStyle = 'rgba(239,77,50,0.06)';
        ctx.fillRect(preEnd, 0, postStart - preEnd, height);

        // 波形渐变
        const grad = ctx.createLinearGradient(0, midY - maxAmp, 0, midY + maxAmp);
        grad.addColorStop(0, 'rgba(98,199,255,0.8)');
        grad.addColorStop(0.5, 'rgba(98,199,255,1)');
        grad.addColorStop(1, 'rgba(98,199,255,0.8)');

        // 绘制波形路径
        ctx.beginPath();
        const stepX = width / samples;
        for (let i = 0; i < samples; i++) {
          const x = i * stepX;
          const y = midY - data[i] * maxAmp;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // 填充区域渐变
        ctx.lineTo(width, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, midY - maxAmp, 0, midY + maxAmp);
        fillGrad.addColorStop(0, 'rgba(98,199,255,0.15)');
        fillGrad.addColorStop(1, 'rgba(98,199,255,0.02)');
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // 事件边界线
        ctx.strokeStyle = 'rgba(239,77,50,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(preEnd, 0);
        ctx.lineTo(preEnd, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(postStart, 0);
        ctx.lineTo(postStart, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // 重置播放头
        App.waveform.stop();
        const playhead = App.utils.$('#waveformPlayhead');
        if (playhead) playhead.style.left = preEnd / dpr + 'px';
      },

      play() {
        if (App.state.isPlayingWaveform) return;
        App.state.isPlayingWaveform = true;

        const btn = App.utils.$('#waveformPlayBtn');
        if (btn) btn.textContent = '⏸ 停止播放';

        const playhead = App.utils.$('#waveformPlayhead');
        const canvas = App.utils.$('#waveformCanvas');
        if (!playhead || !canvas) return;

        const width = canvas.getBoundingClientRect().width;
        const startX = width * 0.25;
        const endX = width * 0.65;
        const totalDist = endX - startX;
        const duration = 3500; // 3.5 秒
        const startTime = performance.now();

        function animate(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // 在事件中区域移动，稍有回弹效果
          const eased = progress < 0.5 ?
            2 * progress * progress :
            -1 + (4 - 2 * progress) * progress;

          const pos = startX + eased * totalDist;
          playhead.style.left = pos + 'px';

          if (progress < 1) {
            App.waveform.animFrame = requestAnimationFrame(animate);
          } else {
            App.waveform.stop();
          }
        }

        App.waveform.animFrame = requestAnimationFrame(animate);
      },

      stop() {
        App.state.isPlayingWaveform = false;
        if (App.waveform.animFrame) {
          cancelAnimationFrame(App.waveform.animFrame);
          App.waveform.animFrame = null;
        }
        const btn = App.utils.$('#waveformPlayBtn');
        if (btn) btn.textContent = '▶ 播放音频片段';
      },
    },

    // =======================================================================
    // 数据导出
    // =======================================================================
    export: {
      init() {
        App.utils.$('#exportCSV')?.addEventListener('click', () => App.export.exportCSV());
        App.utils.$('#exportJSON')?.addEventListener('click', () => App.export.exportJSON());
      },

      getExportData() {
        const ids = App.eventQueue.getFilteredEvents();
        return ids.map((id) => {
          const ev = App.state.events[id];
          return { id, level: ev[0], title: ev[1], description: ev[2], colorKey: ev[3],
            time: ev[4], location: ev[5], type: ev[6], confidence: ev[7], duration: ev[8],
            actions: ev[9] };
        });
      },

      exportCSV() {
        const data = App.export.getExportData();
        const headers = ['事件编号', '等级', '标题', '描述', '地点', '类型', '置信度', '持续时长(s)', '发生时间', '联动动作'];
        const rows = data.map((ev) => [
          ev.id, ev.level, ev.title, ev.description, ev.location,
          ev.type, ev.confidence, ev.duration, App.utils.formatDate(ev.time), ev.actions,
        ]);

        const csvContent = [headers, ...rows]
          .map((row) => row.map((cell) => '"' + String(cell || '').replace(/"/g, '""') + '"').join(','))
          .join('\n');

        const bom = '﻿';
        App.export.download(bom + csvContent, 'citylisten-events.csv', 'text/csv;charset=utf-8');
        App.notify.show('success', '已导出 ' + data.length + ' 条事件为 CSV');
      },

      exportJSON() {
        const data = App.export.getExportData();
        const json = JSON.stringify(data, null, 2);
        App.export.download(json, 'citylisten-events.json', 'application/json');
        App.notify.show('success', '已导出 ' + data.length + ' 条事件为 JSON');
      },

      download(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    },

    // =======================================================================
    // 实时模拟引擎
    // =======================================================================
    simulator: {
      init() {
        App.utils.$('#simToggle')?.addEventListener('click', () => {
          if (App.state.simRunning) App.simulator.stop();
          else App.simulator.start();
        });

        App.utils.$$('.sim-speed-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            App.state.simSpeed = parseInt(btn.dataset.speed);
            App.utils.$$('.sim-speed-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            // 重启模拟器以应用新速度
            if (App.state.simRunning) {
              App.simulator.stop();
              App.simulator.start();
            }
          });
        });
      },

      start() {
        if (App.state.simRunning) return;
        App.state.simRunning = true;

        const btn = App.utils.$('#simToggle');
        if (btn) {
          btn.textContent = '⏸ 暂停模拟';
          btn.classList.add('sim-running');
        }

        App.simulator.scheduleNext();
      },

      stop() {
        App.state.simRunning = false;
        if (App.state.simTimer) {
          clearTimeout(App.state.simTimer);
          App.state.simTimer = null;
        }

        const btn = App.utils.$('#simToggle');
        if (btn) {
          btn.textContent = '▶ 启动模拟';
          btn.classList.remove('sim-running');
        }
      },

      scheduleNext() {
        if (!App.state.simRunning) return;
        // 速度越快，间隔越短
        const baseInterval = App.utils.randomInt(10000, 25000);
        const interval = baseInterval / App.state.simSpeed;

        App.state.simTimer = setTimeout(() => {
          App.simulator.generateEvent();
          App.simulator.scheduleNext();
        }, interval);
      },

      generateEvent() {
        const templates = App.simulator.templates;
        const tpl = App.utils.pick(templates);
        const confidence = (App.utils.randomBetween(0.62, 0.97)).toFixed(3);
        const duration = (App.utils.randomBetween(3.5, 22)).toFixed(1);
        const actions = ['地图弹窗、视频截取、日志入库、处置队列',
          '地图弹窗、日志入库', '视频截取、日志入库、处置队列',
          '地图弹窗、视频截取、处置队列'];

        const eventData = {
          levelName: tpl[0],
          title: tpl[1],
          description: '置信度 ' + confidence + '，持续 ' + duration + 's。' + App.utils.pick(tpl[3]),
          level: tpl[2],
          location: tpl[4],
          type: tpl[5],
          confidence: confidence,
          duration: duration,
          actions: App.utils.pick(actions),
        };

        const newId = App.eventQueue.addEvent(eventData);

        // 通知
        const isUrgent = eventData.level === 'red' || eventData.level === 'orange';
        App.notify.show(
          isUrgent ? 'warning' : 'info',
          (isUrgent ? '⚠️ ' : '') + '新' + eventData.levelName + ': ' + eventData.title
        );

        // 红/橙事件闪烁地图热点
        if (isUrgent) {
          App.map.highlightHotspot(eventData.level);
        }

        // 更新波形（如果是当前选中事件）
        if (App.state.currentEventId === newId) {
          App.waveform.draw(newId);
        }
      },

      templates: [
        // [等级名称, 标题, 颜色键, [描述选项...], 地点, 事件类型]
        ['红色预警', '星河商业街 · 尖叫呼救', 'red',
          ['已关联 CAM-08B 视频通道并生成处置摘要。', '建议立即派遣附近巡防人员到场确认。', '多个传感器交叉验证，高置信度告警。'],
          '星河商业街', '尖叫呼救'],
        ['橙色预警', '江湾大道路口 · 车辆碰撞', 'orange',
          ['已联动 CAM-22C 回放并推送交通处置。', '连续两声碰撞，疑似多车追尾。', '周边摄像头已自动截取前后30秒画面。'],
          '江湾大道路口', '车辆碰撞'],
        ['橙色预警', '滨江隧道入口 · 玻璃破碎', 'orange',
          ['建议调取附近三路监控复核。', '音频特征匹配高置信度玻璃破碎事件。', '隧道入口回声环境已验证排除。'],
          '滨江隧道入口', '玻璃破碎'],
        ['黄色预警', '评路图书馆北广场 · 人群聚集', 'yellow',
          ['系统建议巡检人员到场观察。', '聚集密度持续上升，超过常态阈值。', '周边环境音量异常升高。'],
          '评路图书馆北广场', '人群聚集'],
        ['蓝色预警', '市民公园东门 · 鸣笛', 'blue',
          ['进入持续观察队列。', '单次短促鸣笛，可能为偶然事件。', '附近无交通事故关联记录。'],
          '市民公园东门', '鸣笛'],
        ['红色预警', '火车站南广场 · 爆炸声', 'red',
          ['紧急推送至公安及消防指挥中心。', '多个传感器捕捉到冲击波特征。', '建议立即启动应急预案。'],
          '火车站南广场', '爆炸声'],
        ['橙色预警', '第一人民医院 · 争吵斗殴', 'orange',
          ['已联动医院安保及附近警务站。', '声音特征匹配群体争吵升级模式。', '建议安保人员立即到场处置。'],
          '第一人民医院', '争吵斗殴'],
        ['黄色预警', '大学城体育馆 · 人群聚集', 'yellow',
          ['建议关注聚集规模和持续时间。', '体育馆外声音密度明显增高。', '可能为活动散场导致非异常聚集。'],
          '大学城体育馆', '人群聚集'],
        ['橙色预警', '地铁三号线站台 · 尖叫呼救', 'orange',
          ['已联动站台监控及轨道公安。', '站台中部拾音器捕捉到持续呼救声。', '建议查看站台屏蔽门区域监控。'],
          '地铁三号线站台', '尖叫呼救'],
        ['蓝色预警', '科技园区中心 · 施工噪音', 'blue',
          ['进入持续观察队列。', '噪音特征匹配大型机械施工。', '已超出该区域允许施工时段。'],
          '科技园区中心', '施工噪音'],
        ['黄色预警', '老城区步行街 · 鸣笛', 'yellow',
          ['多辆车辆连续鸣笛，建议关注交通状况。', '鸣笛密度超过该区域常态值。', '可能为交通拥堵或纠纷导致。'],
          '老城区步行街', '鸣笛'],
        ['橙色预警', '会展中心 · 玻璃破碎', 'orange',
          ['已联动会展中心安保部门。', '西北侧展厅拾音器捕捉到玻璃碎裂声。', '建议调取该区域三路监控画面。'],
          '会展中心', '玻璃破碎'],
        ['红色预警', '河滨公园 · 尖叫呼救', 'red',
          ['紧急推送至附近巡逻车及水上救援。', '传感器定位在河滨步道中段。', '多个拾音器交叉验证，建议立即响应。'],
          '河滨公园', '尖叫呼救'],
        ['蓝色预警', '高新区软件园 · 车辆碰撞', 'blue',
          ['轻微刮擦，进入观察队列。', '碰撞力度较小，无人员受伤风险。', '已通知园区物业查看。'],
          '高新区软件园', '车辆碰撞'],
        ['黄色预警', '火车站北广场 · 人群聚集', 'yellow',
          ['建议关注人流密度变化趋势。', '北广场进站口区域人员持续聚集。', '可能与列车晚点有关。'],
          '火车站北广场', '人群聚集'],
        ['橙色预警', '市中心十字路口 · 车辆碰撞', 'orange',
          ['已联动交通管理中心及附近交警。', '十字路口东南角发生碰撞。', '建议查看交通信号灯状态及路口监控。'],
          '市中心十字路口', '车辆碰撞'],
        ['红色预警', '体育场 · 爆炸声', 'red',
          ['紧急推送至安保指挥中心。', '疑似烟火或爆炸物声音特征。', '建议封锁周边区域并排查。'],
          '体育场', '爆炸声'],
        ['蓝色预警', '儿童医院 · 鸣笛', 'blue',
          ['进入观察队列。', '急诊入口区域短促鸣笛。', '可能为紧急送医车辆，建议关注。'],
          '儿童医院', '鸣笛'],
        ['橙色预警', '万达广场 · 争吵斗殴', 'orange',
          ['已联动商场安保及附近派出所。', '一楼中庭区域声音特征匹配。', '建议立即调取中庭监控画面。'],
          '万达广场', '争吵斗殴'],
        ['黄色预警', '西湖景区入口 · 人群聚集', 'yellow',
          ['建议关注聚集规模和持续时间。', '入口广场人员密度超过舒适容量。', '可能为节假日正常客流。'],
          '西湖景区入口', '人群聚集'],
        ['蓝色预警', '评路图书馆北广场 · 施工噪音', 'blue',
          ['进入观察队列。', '广场东侧施工区域噪音超标。', '已超出该区域允许的噪音分贝范围。'],
          '评路图书馆北广场', '施工噪音'],
        ['橙色预警', '滨江隧道入口 · 车辆碰撞', 'orange',
          ['已联动隧道管理中心。', '隧道入口200米处发生碰撞。', '建议启动隧道入口限流措施。'],
          '滨江隧道入口', '车辆碰撞'],
      ],
    },

    // =======================================================================
    // 初始化
    // =======================================================================
    init() {
      // 1. 初始化事件数据
      this.state.events = {
        'E-240617-01': ['黄色预警', '评路图书馆北广场 · 人群聚集', '置信度 0.781，持续 18.4s。系统建议巡检人员到场观察。', 'yellow', '2024-06-17 19:42:10', '评路图书馆北广场', '人群聚集', '0.781', '18.4', '地图弹窗、日志入库、处置队列'],
        'E-240617-02': ['橙色预警', '江湾大道路口 · 车辆碰撞', '置信度 0.846，持续 7.8s。已联动 CAM-22C 回放并推送交通处置。', 'orange', '2024-06-17 19:45:32', '江湾大道路口', '车辆碰撞', '0.846', '7.8', '地图弹窗、视频截取、日志入库、处置队列'],
        'E-240617-03': ['红色预警', '星河商业街 · 尖叫呼救', '置信度 0.912，持续 11.2s。已关联 CAM-08B 视频通道并生成处置摘要。', 'red', '2024-06-17 19:48:07', '星河商业街', '尖叫呼救', '0.912', '11.2', '地图弹窗、视频截取、日志入库、处置队列'],
        'E-240617-04': ['蓝色预警', '市民公园东门 · 鸣笛', '置信度 0.632，持续 5.5s。进入持续观察队列。', 'blue', '2024-06-17 19:50:41', '市民公园东门', '鸣笛', '0.632', '5.5', '日志入库、处置队列'],
        'E-240617-05': ['橙色预警', '滨江隧道入口 · 玻璃破碎', '置信度 0.803，持续 4.6s。建议调取附近三路监控复核。', 'orange', '2024-06-17 19:52:19', '滨江隧道入口', '玻璃破碎', '0.803', '4.6', '地图弹窗、视频截取、日志入库、处置队列'],
      };
      this.state.eventOrder = ['E-240617-05', 'E-240617-04', 'E-240617-03', 'E-240617-02', 'E-240617-01'];

      // 2. 初始化各模块
      this.auth.init();
      this.nav.init();
      this.hero.init();
      this.storyline.init();
      this.filter.init();
      this.kpi.init();
      this.map.init();
      this.trend.init();
      this.eventQueue.init();
      this.eventDetail.init();
      this.search.init();
      this.notify.init();
      this.waveform.init();
      this.export.init();
      this.simulator.init();

      // 3. 全局键盘快捷键
      document.addEventListener('keydown', (e) => {
        // Ctrl+F / Cmd+F -> 聚焦搜索
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !App.utils.$('#app').hidden) {
          e.preventDefault();
          App.utils.$('#searchInput')?.focus();
        }
        // Ctrl+S -> 导出
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && !App.utils.$('#app').hidden) {
          e.preventDefault();
          App.export.exportJSON();
        }
      });

      console.log('🏙️  城市·谛听 CityListen — 声谱地图指挥台已就绪');
      console.log('   登录凭证: admin / admin');
      console.log('   快捷键: Ctrl+F 搜索 | Ctrl+S 导出 | Esc 关闭弹窗');
    },
  };

  // =========================================================================
  // 启动
  // =========================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

  // 暴露到全局作用域 (调试用)
  window.App = App;
})();
