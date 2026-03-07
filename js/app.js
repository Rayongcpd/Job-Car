/**
 * ============================================================
 * Office Management System — Frontend JavaScript
 * ============================================================
 * Handles: API calls, Auth, CRUD, File uploads, UI navigation
 * ============================================================
 */

// ============================================================
// 🔧 CONFIGURATION — เปลี่ยน URL นี้เป็น Web App URL ของคุณ
// ============================================================
const API_URL = 'https://script.google.com/macros/s/AKfycbx-0oVcXcEc4_0EUPfxBg_aDVsZD9QIhW-J-G0cP9CpntkzRevq0pDcms5HdbMrdXns_w/exec';

// ============================================================
// 🏗️ APP STATE
// ============================================================
const AppState = {
    user: null,
    announcements: [],
    vehicleLogs: [],

    /** Load user from localStorage */
    loadUser() {
        const saved = localStorage.getItem('omsUser');
        if (saved) {
            this.user = JSON.parse(saved);
            return true;
        }
        return false;
    },

    /** Save user to localStorage */
    saveUser(userData) {
        this.user = userData;
        localStorage.setItem('omsUser', JSON.stringify(userData));
    },

    /** Clear user session */
    clearUser() {
        this.user = null;
        localStorage.removeItem('omsUser');
    },

    /** Check if user is Admin */
    isAdmin() {
        return this.user && (this.user.role === 'Admin' || this.user.role === 'Superadmin');
    },

    /** Check if user is Superadmin */
    isSuperAdmin() {
        return this.user && this.user.role === 'Superadmin';
    },

    /** Initialize App */
    async init() {
        this.loadUser();
        ThemeModule.init();

        // Load settings configuration
        await Settings.init();

        // Control sidebar settings menu visibility
        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) {
            if (this.isSuperAdmin()) {
                settingsMenu.classList.remove('d-none');
            } else {
                settingsMenu.classList.add('d-none');
            }
        }

        showApp();
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => AppState.init());

// ============================================================
// 📡 API SERVICE
// ============================================================
const API = {
    /**
     * GET request to GAS Web App
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>}
     */
    async get(params) {
        const query = new URLSearchParams(params).toString();
        const url = `${API_URL}?${query}`;
        try {
            const res = await fetch(url);
            return await res.json();
        } catch (err) {
            console.error('API GET Error:', err);
            return { success: false, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
        }
    },

    /**
     * POST request to GAS Web App
     * @param {Object} body - JSON body
     * @returns {Promise<Object>}
     */
    async post(body) {
        // Attach credentials for admin operations
        if (AppState.user) {
            body.username = AppState.user.username;
            body.password = AppState.user.password;
        }
        try {
            // NOTE: GAS Web App ไม่ support preflight CORS (OPTIONS request)
            // ห้ามตั้ง headers ใดๆ เพื่อให้เป็น "simple request" ที่ไม่ trigger preflight
            const res = await fetch(API_URL, {
                method: 'POST',
                body: JSON.stringify(body)
            });
            return await res.json();
        } catch (err) {
            console.error('API POST Error:', err);
            return { success: false, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
        }
    }
};

// ============================================================
// 🔐 AUTH MODULE
// ============================================================
// ============================================================
// 🔐 AUTH MODULE
// ============================================================
const Auth = {
    /** Show Login Modal */
    showLoginModal() {
        // Reset form
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        new bootstrap.Modal(document.getElementById('loginModal')).show();
    },

    /** Handle login/logout click */
    checkAuthAction() {
        if (AppState.user) {
            this.logout();
        } else {
            this.showLoginModal();
        }
    },

    /** Handle login form submission */
    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            showToast('กรุณากรอก Username และ Password', 'error');
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังตรวจสอบ...';

        const result = await API.get({ action: 'login', username, password });

        if (result.success) {
            // Save password for subsequent admin API calls
            result.password = password;
            AppState.saveUser(result);
            showToast(`ยินดีต้อนรับ, ${result.name}!`, 'success');

            // Hide modal
            const modalEl = document.getElementById('loginModal');
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            showApp();
        } else {
            showToast(result.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }

        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>เข้าสู่ระบบ';
    },

    /** Handle logout */
    logout() {
        if (!confirm('ยืนยันการออกจากระบบ?')) return;
        AppState.clearUser();
        showApp(); // Refresh as guest

        // Hide settings menu
        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) settingsMenu.classList.add('d-none');

        showToast('ออกจากระบบแล้ว', 'info');
    }
};

// ============================================================
// ⚙️ SETTINGS MODULE
// ============================================================
const Settings = {
    data: {},

    /** Initialize by loading and applying settings */
    async init() {
        await this.load();
        this.applyToCSS();
    },

    /** Fetch settings from API */
    async load() {
        const result = await API.get({ action: 'getSettings' });
        if (result.success && result.data) {
            this.data = result.data;
        }
    },

    /** Apply loaded settings to CSS :root variables */
    applyToCSS() {
        const root = document.documentElement;
        if (this.data.calendarMinWidth) {
            // Default to % if numeric only (e.g. they type 100 instead of 100%)
            let widthVal = this.data.calendarMinWidth;
            if (!isNaN(widthVal) && widthVal !== '') {
                widthVal += '%';
            }
            root.style.setProperty('--calendar-min-width', widthVal);
            console.log("Applied min-width:", widthVal);
        }
        if (this.data.calendarCellMinHeight) {
            // Check if string ends with px or %, if not add px
            const heightVal = isNaN(this.data.calendarCellMinHeight) ? this.data.calendarCellMinHeight : this.data.calendarCellMinHeight + 'px';
            root.style.setProperty('--calendar-cell-min-height', heightVal);
            console.log("Applied height:", heightVal);
        }
        if (this.data.calendarFontSize) {
            const fontVal = isNaN(this.data.calendarFontSize) ? this.data.calendarFontSize : this.data.calendarFontSize + 'px';
            root.style.setProperty('--calendar-font-size', fontVal);
            console.log("Applied font size:", fontVal);
        }
    },

    /** Show settings modal and populate current values */
    showModal() {
        if (!AppState.isSuperAdmin()) return;

        document.getElementById('settingCalendarWidth').value = this.data.calendarMinWidth || '100%';
        document.getElementById('settingCellHeight').value = this.data.calendarCellMinHeight || '100';
        document.getElementById('settingFontSize').value = this.data.calendarFontSize || '11';

        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    },

    /** Save settings to API and apply immediately */
    async save() {
        if (!AppState.isSuperAdmin()) return;

        const calendarMinWidth = document.getElementById('settingCalendarWidth').value.trim();
        const calendarCellMinHeight = document.getElementById('settingCellHeight').value.trim();
        const calendarFontSize = document.getElementById('settingFontSize').value.trim();

        // Provide defaults if empty
        const settings = {
            calendarMinWidth: calendarMinWidth || '100%',
            calendarCellMinHeight: calendarCellMinHeight || '100',
            calendarFontSize: calendarFontSize || '11'
        };

        const btn = document.getElementById('btnSaveSettings');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังบันทึก...';

        const result = await API.post({
            action: 'updateSettings',
            settings: settings
        });

        if (result.success) {
            showToast(result.message, 'success');
            // Update local data and apply
            this.data = settings;
            this.applyToCSS();

            bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        } else {
            showToast(result.error || 'บันทึกไม่สำเร็จ', 'error');
        }

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save me-2"></i>บันทึกการตั้งค่า';
    }
};

// ============================================================
// 📢 ANNOUNCEMENTS MODULE
// ============================================================
// ============================================================
// 🔍 FILTER UTILS
// ============================================================
const FilterUtils = {
    /** Generate HTML for filter inputs based on type */
    updateInputs(prefix) {
        const type = document.getElementById(`${prefix}FilterType`).value;
        const container = document.getElementById(`${prefix}FilterInputs`);
        let html = '';
        const year = new Date().getFullYear();

        switch (type) {
            case 'daily':
                html = `<input type="date" class="form-control form-control-sm" id="${prefix}FilterDate">`;
                break;
            case 'monthly':
                html = `<input type="month" class="form-control form-control-sm" id="${prefix}FilterMonth">`;
                break;
            case 'quarterly':
                html = `
                    <div class="d-flex gap-2">
                        <select class="form-select form-select-sm" id="${prefix}FilterYear">
                            ${this.generateYearOptions(year)}
                        </select>
                        <select class="form-select form-select-sm" id="${prefix}FilterQuarter">
                            <option value="1">ไตรมาส 1 (ม.ค.-มี.ค.)</option>
                            <option value="2">ไตรมาส 2 (เม.ย.-มิ.ย.)</option>
                            <option value="3">ไตรมาส 3 (ก.ค.-ก.ย.)</option>
                            <option value="4">ไตรมาส 4 (ต.ค.-ธ.ค.)</option>
                        </select>
                    </div>`;
                break;
            case 'yearly':
                html = `
                    <select class="form-select form-select-sm" id="${prefix}FilterYear">
                        ${this.generateYearOptions(year)}
                    </select>`;
                break;
            case 'upcoming':
                html = `<div class="text-muted small pt-2">แสดงรายการวันนี้และอนาคต</div>`;
                break;
            default: // all
                html = `<div class="text-muted small pt-2">แสดงข้อมูลทั้งหมด</div>`;
        }
        container.innerHTML = html;
    },

    /** Generate year options (current year +/- 5) */
    generateYearOptions(currentYear) {
        let options = '';
        for (let y = currentYear + 1; y >= currentYear - 5; y--) {
            // Show Buddhist Era in text (Year + 543)
            options += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y + 543}</option>`;
        }
        return options;
    },

    /** Get filter criteria from inputs */
    getCriteria(prefix) {
        const type = document.getElementById(`${prefix}FilterType`).value;
        const criteria = { type };

        if (type === 'daily') {
            criteria.date = document.getElementById(`${prefix}FilterDate`).value;
        } else if (type === 'monthly') {
            criteria.month = document.getElementById(`${prefix}FilterMonth`).value; // YYYY-MM
        } else if (type === 'quarterly') {
            criteria.year = document.getElementById(`${prefix}FilterYear`).value;
            criteria.quarter = document.getElementById(`${prefix}FilterQuarter`).value;
        } else if (type === 'yearly') {
            criteria.year = document.getElementById(`${prefix}FilterYear`).value;
        }
        return criteria;
    },

    /** Filter data array based on criteria */
    filterData(data, criteria) {
        if (!data) return [];
        if (criteria.type === 'all') return data;

        const todayStr = new Date().toISOString().split('T')[0];

        if (criteria.type === 'upcoming') {
            // Show today + future, sorted ascending (nearest first)
            const filtered = data.filter(item => {
                if (!item.Date) return false;
                const itemDateStr = Calendar.normalizeDate(item.Date);
                return itemDateStr && itemDateStr >= todayStr;
            });
            filtered.sort((a, b) => new Date(a.Date) - new Date(b.Date));
            return filtered;
        }

        return data.filter(item => {
            if (!item.Date) return false;
            const itemDateStr = Calendar.normalizeDate(item.Date);
            if (!itemDateStr) return false;

            const [y, m, d] = itemDateStr.split('-').map(Number);

            switch (criteria.type) {
                case 'daily':
                    if (!criteria.date) return true;
                    return itemDateStr === criteria.date;
                case 'monthly':
                    if (!criteria.month) return true;
                    return itemDateStr.startsWith(criteria.month);
                case 'quarterly':
                    const q = Math.ceil(m / 3);
                    return String(y) === String(criteria.year) && String(q) === String(criteria.quarter);
                case 'yearly':
                    return String(y) === String(criteria.year);
                default:
                    return true;
            }
        });
    }
};

// ============================================================
// 📢 ANNOUNCEMENTS MODULE
// ============================================================
const Announcements = {
    /** Fetch and render all announcements */
    async load() {
        const container = document.getElementById('announcementsTableBody');
        container.innerHTML = loadingHTML();

        const result = await API.get({ action: 'getAnnouncements' });

        if (result.success) {
            AppState.announcements = result.data;
            this.applyFilter();
        } else {
            container.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render announcements table */
    render(data) {
        const container = document.getElementById('announcementsTableBody');

        if (!data || data.length === 0) {
            container.innerHTML = `<tr><td colspan="10">${emptyHTML('ยังไม่มีรายการปฏิบัติงาน')}</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        container.innerHTML = data.map((item, index) => {
            // Format time display
            let timeDisplay = '-';
            if (item.Time) {
                timeDisplay = formatTime(item.Time);
                if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
            }
            const isPast = Calendar.normalizeDate(item.Date) < today;

            return `
      <tr class="fade-in${isPast ? ' row-past' : ''}" style="animation-delay: ${index * 0.05}s">
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${formatThaiDate(item.Date)}</td>
        <td data-label="เวลา">${timeDisplay}</td>
        <td data-label="เรื่อง">
          <strong>${escapeHtml(item.Title || '')}</strong>
          <br><small class="text-muted">${truncate(item.Detail || '', 60)}</small>
        </td>
        <td data-label="สถานที่">${escapeHtml(item.Location || '-')}</td>
        <td data-label="สหกรณ์จังหวัดระยอง">${escapeHtml(item.CoopParticipation || '-')}</td>
        <td data-label="กลุ่มงาน">${escapeHtml(item.WorkGroup || '-')}</td>
        <td data-label="เอกสารแนบ">${item.FileURL ? `<a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-paperclip"></i> ดูไฟล์</a>` : '<span style="color: var(--text-muted);">-</span>'}</td>
        <td data-label="โพสต์โดย"><small>${escapeHtml(item.PostedBy || '')}</small></td>
        <td data-label="จัดการ">
          <button class="btn btn-outline-custom btn-sm me-1" onclick="Announcements.showDetail('${item.ID}')" title="ดูรายละเอียด">
            <i class="fas fa-eye"></i>
          </button>
          ${AppState.isAdmin() ? `
          <button class="btn btn-outline-custom btn-sm me-1" onclick="Announcements.showEdit('${item.ID}')" title="แก้ไข">
            <i class="fas fa-pen-to-square"></i>
          </button>
          <button class="btn btn-danger-custom btn-sm" onclick="Announcements.confirmDelete('${item.ID}')" title="ลบ">
            <i class="fas fa-trash-can"></i>
          </button>
          ` : ''}
        </td>
      </tr>
    `;
        }).join('');
    },

    /** Show detail modal */
    showDetail(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        // Format time for display
        let timeDisplay = '-';
        if (item.Time) {
            timeDisplay = formatTime(item.Time);
            if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
        }

        document.getElementById('detailModalTitle').textContent = item.Title;
        document.getElementById('detailModalBody').innerHTML = `
      <p><strong>เรื่อง:</strong> ${escapeHtml(item.Title || '-')}</p>
      <p><strong>วันที่:</strong> ${formatThaiDate(item.Date)}</p>
      <p><strong>เวลา:</strong> ${timeDisplay}</p>
      <p><strong>สถานที่:</strong> ${escapeHtml(item.Location || '-')}</p>
      <p><strong>สหกรณ์จังหวัดระยอง:</strong> ${escapeHtml(item.CoopParticipation || '-')}</p>
      <p><strong>กลุ่มงาน:</strong> ${escapeHtml(item.WorkGroup || '-')}</p>
      ${item.FileURL ? `<p><strong>เอกสารแนบ:</strong> <a href="${item.FileURL}" target="_blank" class="file-link"><i class="fas fa-download"></i> ดาวน์โหลดไฟล์</a></p>` : ''}
      <hr style="border-color: var(--border-color);">
      <div class="detail-text">${escapeHtml(item.Detail || 'ไม่มีรายละเอียด')}</div>
      <hr style="border-color: var(--border-color);">
      <p class="text-muted small" style="text-align: right;"><strong>โพสต์โดย:</strong> ${item.PostedBy}</p>
    `;
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    },

    /** Show add form modal */
    showAdd() {
        document.getElementById('annFormTitle').textContent = 'เพิ่มงานใหม่';
        document.getElementById('annFormId').value = '';
        document.getElementById('annTitle').value = '';
        document.getElementById('annDate').value = new Date().toISOString().split('T')[0];

        // Populate and set default time (e.g., nearest hour or 09:00)
        this.populateTimeSelects();
        // Remove default time to prevent errors
        document.getElementById('annTimeHour').value = '';
        document.getElementById('annTimeMinute').value = '';

        document.getElementById('annTimeSuffix').value = 'น.';
        document.getElementById('annLocation').value = '';
        document.getElementById('annCoopParticipation').value = '';
        document.getElementById('annWorkGroup').value = '';
        document.getElementById('annDetail').value = '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Populate hour and minute selects */
    populateTimeSelects() {
        const hourSelect = document.getElementById('annTimeHour');
        const minuteSelect = document.getElementById('annTimeMinute');

        // Clear existing options
        hourSelect.innerHTML = '<option value="" selected disabled>ชม.</option>';
        minuteSelect.innerHTML = '<option value="" selected disabled>นาที</option>';

        // Hours 00-23
        for (let i = 0; i < 24; i++) {
            const val = String(i).padStart(2, '0');
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            hourSelect.appendChild(opt);
        }

        // Minutes 00-59
        for (let i = 0; i < 60; i++) {
            const val = String(i).padStart(2, '0');
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            minuteSelect.appendChild(opt);
        }
    },

    /** Show edit form modal */
    showEdit(id) {
        const item = AppState.announcements.find(a => a.ID === id);
        if (!item) return;

        document.getElementById('annFormTitle').textContent = 'แก้ไขงาน';
        document.getElementById('annFormId').value = item.ID;
        document.getElementById('annTitle').value = item.Title || '';
        document.getElementById('annDate').value = Calendar.normalizeDate(item.Date) || '';

        // Populate select options first
        this.populateTimeSelects();

        // Parse time string (HH:mm) to set selects
        const timeStr = parseTimeForInput(item.Time); // Returns HH:mm or ''
        if (timeStr && timeStr.includes(':')) {
            const [h, m] = timeStr.split(':');
            document.getElementById('annTimeHour').value = h;
            document.getElementById('annTimeMinute').value = m;
        } else {
            // Default if empty
            document.getElementById('annTimeHour').value = '';
            document.getElementById('annTimeMinute').value = '';
        }

        document.getElementById('annTimeSuffix').value = item.TimeSuffix || 'น.';
        document.getElementById('annLocation').value = item.Location || '';
        document.getElementById('annCoopParticipation').value = item.CoopParticipation || '';
        document.getElementById('annWorkGroup').value = item.WorkGroup || '';
        document.getElementById('annDetail').value = item.Detail || '';
        document.getElementById('annFile').value = '';
        document.getElementById('annFileURL').value = item.FileURL || '';
        new bootstrap.Modal(document.getElementById('annFormModal')).show();
    },

    /** Save announcement (add or update) */
    async save() {
        const id = document.getElementById('annFormId').value;
        const title = document.getElementById('annTitle').value.trim();
        const date = document.getElementById('annDate').value;
        // Combine hour and minute
        const hour = document.getElementById('annTimeHour').value;
        const minute = document.getElementById('annTimeMinute').value;
        let time = '';
        if (hour && minute) {
            time = `${hour}:${minute}`;
        }

        const timeSuffix = document.getElementById('annTimeSuffix').value;
        const location = document.getElementById('annLocation').value.trim();
        const coopParticipation = document.getElementById('annCoopParticipation').value;
        const workGroup = document.getElementById('annWorkGroup').value.trim();
        const detail = document.getElementById('annDetail').value.trim();
        let fileURL = document.getElementById('annFileURL').value;
        const fileInput = document.getElementById('annFile');

        if (!title) {
            showToast('กรุณากรอกเรื่อง', 'error');
            return;
        }
        if (!date) {
            showToast('กรุณาระบุวันที่', 'error');
            return;
        }

        // Handle file upload if selected
        if (fileInput.files.length > 0) {
            showToast('กำลังอัปโหลดไฟล์...', 'info');
            const uploadResult = await uploadFile(fileInput.files[0]);
            if (uploadResult.success) {
                fileURL = uploadResult.fileURL;
            } else {
                showToast(uploadResult.error || 'อัปโหลดไฟล์ล้มเหลว', 'error');
                return;
            }
        }

        const action = id ? 'updateAnnouncement' : 'addAnnouncement';
        const payload = { action, title, date, time, timeSuffix, location, coopParticipation, workGroup, detail, fileURL };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('annFormModal')).hide();
            this.load();
            Calendar.load(); // Refresh calendar
        } else {
            showToast(result.error, 'error');
        }
    },

    /** Apply filter */
    applyFilter() {
        const criteria = FilterUtils.getCriteria('ann');
        const filtered = FilterUtils.filterData(AppState.announcements, criteria);
        this.render(filtered);
    },

    /** Reset filter */
    resetFilter() {
        document.getElementById('annFilterType').value = 'all';
        FilterUtils.updateInputs('ann');
        this.applyFilter();
    },

    /** Confirm and delete announcement */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบรายการนี้หรือไม่?')) return;

        const result = await API.post({ action: 'deleteAnnouncement', id });

        if (result.success) {
            showToast(result.message, 'success');
            this.load();
            Dashboard.load();
        } else {
            showToast(result.error, 'error');
        }
    }
};

// ============================================================
// 🚗 VEHICLE LOGS MODULE
// ============================================================
const VehicleLogs = {
    /** Fetch and render all vehicle logs */
    async load() {
        const container = document.getElementById('vehicleTableBody');
        container.innerHTML = loadingHTML();

        const result = await API.get({ action: 'getVehicleLogs' });

        if (result.success) {
            AppState.vehicleLogs = result.data;
            this.applyFilter();
        } else {
            container.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render vehicle logs table */
    render(data) {
        const container = document.getElementById('vehicleTableBody');

        if (!data || data.length === 0) {
            container.innerHTML = `<tr><td colspan="10">${emptyHTML('ยังไม่มีบันทึกการใช้รถ')}</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        container.innerHTML = data.map((item, index) => {
            const isPast = Calendar.normalizeDate(item.Date) < today;
            return `
      <tr class="fade-in${isPast ? ' row-past' : ''}" style="animation-delay: ${index * 0.05}s">
        <td data-label="#"><span style="color: var(--text-muted); font-size: 12px;">${index + 1}</span></td>
        <td data-label="วันที่">${formatThaiDate(item.Date)}</td>
        <td data-label="เวลาไป">${formatTime(item.DepartureTime)}</td>
        <td data-label="เวลากลับ">${formatTime(item.ReturnTime)}</td>
        <td data-label="ทะเบียนรถ"><strong>${escapeHtml(item.CarLicense || '')}</strong></td>
        <td data-label="จุดประสงค์">${escapeHtml(item.Purpose || '-')}</td>
        <td data-label="ปลายทาง">${escapeHtml(item.Destination || '')}</td>
        <td data-label="ผู้ขอใช้/กลุ่มงาน">${escapeHtml(item.Requestor || item.requestor || '-')}</td>
        <td data-label="พนักงานขับ">${item.Driver === 'พนักงานขับรถลา' ? '<span style="color:#dc3545;font-weight:bold;">' + escapeHtml(item.Driver) + '</span>' : escapeHtml(item.Driver || '')}</td>
        <td data-label="สถานะ"><span class="badge-status badge-${(item.Status || '').toLowerCase()}">${escapeHtml(item.Status || '')}</span></td>
        <td data-label="จัดการ">
          ${AppState.isAdmin() ? `
          <button class="btn btn-outline-custom btn-sm me-1" onclick="ExportUtils.printVehicleForm('${item.ID}')" title="พิมพ์ใบขออนุญาต">
            <i class="fas fa-print"></i>
          </button>
          <button class="btn btn-outline-custom btn-sm me-1" onclick="VehicleLogs.showEdit('${item.ID}')" title="แก้ไข">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger-custom btn-sm" onclick="VehicleLogs.confirmDelete('${item.ID}')" title="ลบ">
            <i class="fas fa-trash"></i>
          </button>
          ` : ''}
        </td>
      </tr>
    `;
        }).join('');
    },

    /** Show add form modal */
    showAdd() {
        document.getElementById('vehFormTitle').textContent = 'เพิ่มบันทึกการใช้รถ';
        document.getElementById('vehFormId').value = '';
        document.getElementById('vehDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('vehCarLicense').value = '';
        document.getElementById('vehPurpose').value = '';
        document.getElementById('vehDestination').value = '';
        document.getElementById('vehRequestor').value = '';
        document.getElementById('vehDepartureTime').value = '';
        document.getElementById('vehReturnTime').value = '';

        document.getElementById('vehDriver').value = '';
        document.getElementById('vehStatus').value = 'Active';
        new bootstrap.Modal(document.getElementById('vehFormModal')).show();
    },

    /** Show edit form modal */
    showEdit(id) {
        const item = AppState.vehicleLogs.find(v => v.ID === id);
        if (!item) return;

        document.getElementById('vehFormTitle').textContent = 'แก้ไขบันทึกการใช้รถ';
        document.getElementById('vehFormId').value = item.ID;
        // Format date to YYYY-MM-DD for input[type="date"]
        document.getElementById('vehDate').value = Calendar.normalizeDate(item.Date);
        document.getElementById('vehCarLicense').value = item.CarLicense || '';
        document.getElementById('vehPurpose').value = item.Purpose || '';
        document.getElementById('vehDestination').value = item.Destination || '';
        // Handle potential case sensitivity or missing field
        document.getElementById('vehRequestor').value = item.Requestor || item.requestor || '';
        // Format time for input[type="time"] - handles ISO strings from Google Sheets
        document.getElementById('vehDepartureTime').value = parseTimeForInput(item.DepartureTime);
        document.getElementById('vehReturnTime').value = parseTimeForInput(item.ReturnTime);

        document.getElementById('vehDriver').value = item.Driver || '';
        document.getElementById('vehStatus').value = item.Status || 'Active';
        new bootstrap.Modal(document.getElementById('vehFormModal')).show();
    },

    /** Save vehicle log (add or update) */
    async save() {
        const id = document.getElementById('vehFormId').value;
        const date = document.getElementById('vehDate').value;
        const carLicense = document.getElementById('vehCarLicense').value.trim();
        const purpose = document.getElementById('vehPurpose').value.trim();
        const destination = document.getElementById('vehDestination').value.trim();
        const requestor = document.getElementById('vehRequestor').value.trim();
        const departureTime = document.getElementById('vehDepartureTime').value;
        const returnTime = document.getElementById('vehReturnTime').value;
        const mileageStart = '';
        const mileageEnd = '';
        const driver = document.getElementById('vehDriver').value.trim();
        const status = document.getElementById('vehStatus').value;

        if (!date || !destination || !requestor || !purpose) {
            showToast('กรุณากรอกข้อมูลที่จำเป็น (วันที่, จุดประสงค์, ปลายทาง, ผู้ขอ)', 'error');
            return;
        }

        const action = id ? 'updateVehicleLog' : 'addVehicleLog';
        const payload = { action, date, carLicense, purpose, destination, requestor, departureTime, returnTime, mileageStart, mileageEnd, driver, status };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('vehFormModal')).hide();
            this.load();
            Dashboard.load();
        } else {
            showToast(result.error, 'error');
        }
    },

    /** Apply filter */
    applyFilter() {
        const criteria = FilterUtils.getCriteria('veh');
        const filtered = FilterUtils.filterData(AppState.vehicleLogs, criteria);
        this.render(filtered);
    },

    /** Reset filter */
    resetFilter() {
        document.getElementById('vehFilterType').value = 'upcoming';
        FilterUtils.updateInputs('veh');
        this.applyFilter();
    },

    /** Confirm and delete vehicle log */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบบันทึกนี้หรือไม่?')) return;

        const result = await API.post({ action: 'deleteVehicleLog', id });

        if (result.success) {
            showToast(result.message, 'success');
            this.load();
            Calendar.load();
        } else {
            showToast(result.error, 'error');
        }
    }
};



// ============================================================
// 📅 CALENDAR MODULE
// ============================================================
const Calendar = {
    currentDate: new Date(),
    events: [],

    THAI_MONTHS: [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
        'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
        'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ],
    THAI_DAYS: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],

    /** Normalize any date format to YYYY-MM-DD (Bangkok timezone) */
    normalizeDate(dateVal) {
        if (!dateVal) return '';
        const str = String(dateVal);
        // Already YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        // Parse as date and format to Bangkok timezone
        const d = new Date(str);
        if (isNaN(d.getTime())) return str;
        // Convert to Bangkok timezone (UTC+7)
        const bangkok = new Date(d.getTime() + (7 * 60 * 60 * 1000));
        const y = bangkok.getUTCFullYear();
        const m = String(bangkok.getUTCMonth() + 1).padStart(2, '0');
        const day = String(bangkok.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    },

    /** Load data from both modules and render calendar */
    async load() {
        const grid = document.getElementById('calendarGrid');
        grid.innerHTML = '<div style="grid-column: span 7;"><div class="loading-spinner"><div class="spinner-border"></div></div></div>';

        // Fetch both data sources in parallel
        const [annResult, vehResult] = await Promise.all([
            API.get({ action: 'getAnnouncements' }),
            API.get({ action: 'getVehicleLogs' })
        ]);

        this.events = [];

        if (annResult.success && annResult.data) {
            annResult.data.forEach(item => {
                if (item.Date) {
                    this.events.push({
                        type: 'announcement',
                        date: this.normalizeDate(item.Date),
                        label: item.Title || 'งาน',
                        id: item.ID,
                        detail: item.Detail || '',
                        postedBy: item.PostedBy || '',
                        workGroup: item.WorkGroup || '',
                        time: item.Time || '',
                        timeSuffix: item.TimeSuffix || '',
                        location: item.Location || '',
                        coopParticipation: item.CoopParticipation || ''
                    });
                }
            });
        }

        if (vehResult.success && vehResult.data) {
            vehResult.data.forEach(item => {
                if (item.Date) {
                    this.events.push({
                        type: 'vehicle',
                        date: this.normalizeDate(item.Date),
                        label: item.CarLicense || 'รถ',
                        id: item.ID,
                        driver: item.Driver || '',
                        status: item.Status || '',
                        purpose: item.Purpose || '',
                        destination: item.Destination || '',
                        requestor: item.Requestor || item.requestor || '',
                        departureTime: item.DepartureTime || '',
                        returnTime: item.ReturnTime || '',
                        postedBy: item.PostedBy || ''
                    });
                }
            });
        }

        this.render();
    },

    /** Render the calendar grid for currentDate month */
    render() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();

        // Update title (Thai Buddhist Era = +543)
        const thaiYear = year + 543;
        document.getElementById('calendarTitle').textContent =
            `${this.THAI_MONTHS[month]} ${thaiYear}`;

        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Build events map: 'YYYY-MM-DD' -> [events]
        const eventsMap = {};
        this.events.forEach(ev => {
            const key = ev.date;
            if (!eventsMap[key]) eventsMap[key] = [];
            eventsMap[key].push(ev);
        });

        let html = '';

        // Day names header
        this.THAI_DAYS.forEach(d => {
            html += `<div class="calendar-day-name">${d}</div>`;
        });

        // Previous month trailing days
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day other-month"><div class="day-number">${day}</div></div>`;
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayEvents = eventsMap[dateStr] || [];

            const newsEvents = dayEvents.filter(e => e.type === 'announcement');
            const vehicleEvents = dayEvents.filter(e => e.type === 'vehicle');

            let eventsHtml = '';

            if (newsEvents.length > 0) {
                eventsHtml += `<div class="calendar-event announcement" onclick="Calendar.showGroup('${dateStr}', 'announcement')" title="ดูการปฏิบัติงาน">
                    <span class="event-icon">📋</span> <span class="event-label">การปฏิบัติงาน</span> <span class="event-count">(${newsEvents.length})</span>
                </div>`;
            }

            if (vehicleEvents.length > 0) {
                eventsHtml += `<div class="calendar-event vehicle" onclick="Calendar.showGroup('${dateStr}', 'vehicle')" title="ดูบันทึกการใช้รถ">
                    <span class="event-icon">🚗</span> <span class="event-label">บันทึกการใช้รถ</span> <span class="event-count">(${vehicleEvents.length})</span>
                </div>`;
            }

            html += `<div class="calendar-day${isToday ? ' today' : ''}">
                <div class="day-number">${d}</div>
                ${eventsHtml}
            </div>`;
        }

        // Next month leading days (fill to complete grid)
        const totalCells = firstDay + daysInMonth;
        const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-day other-month"><div class="day-number">${i}</div></div>`;
        }

        document.getElementById('calendarGrid').innerHTML = html;
    },

    /** Navigate to previous month */
    prev() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.render();
    },

    /** Navigate to next month */
    next() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.render();
    },

    /** Go back to today */
    goToday() {
        this.currentDate = new Date();
        this.render();
    },

    /** Show event detail in modal */
    showEvent(e, type, id) {
        // Legacy function, kept just in case, but showGroup is preferred now.
        this.showGroup(this.currentDate.toISOString().split('T')[0], type);
    },

    /** Show grouped events in modal */
    showGroup(dateStr, type) {
        // Prevent bubbling if called from onclick directly (though in HTML we passed string values)
        if (event) event.stopPropagation();

        const typeName = type === 'announcement' ? 'การปฏิบัติงาน' : 'บันทึกการใช้รถ';

        // Format dateStr (YYYY-MM-DD) to Thai date
        const [yyyy, mm, dd] = dateStr.split('-');
        const thaiYear = parseInt(yyyy) + 543;
        const thaiMonth = Calendar.THAI_MONTHS[parseInt(mm) - 1];
        const thaiDate = `วันที่ ${parseInt(dd)} ${thaiMonth} ${thaiYear}`;

        const modalTitle = `${thaiDate} - ${typeName}`;

        // Filter events
        const groupEvents = this.events.filter(ev => ev.date === dateStr && ev.type === type);

        let html = '<div class="list-group list-group-flush">';
        if (groupEvents.length === 0) {
            html += '<div class="p-3 text-center text-muted">ไม่พบข้อมูล</div>';
        } else {
            groupEvents.forEach(ev => {
                if (type === 'announcement') {
                    // Format time display
                    let timeDisplay = '-';
                    if (ev.time) {
                        timeDisplay = formatTime(ev.time);
                        if (ev.timeSuffix) timeDisplay += ' ' + escapeHtml(ev.timeSuffix);
                    }

                    html += `
                        <div class="list-group-item bg-transparent border-bottom">
                            <h6 class="mb-1 text-primary">${escapeHtml(ev.label)}</h6>
                            <p class="mb-1 small text-secondary"><i class="fas fa-clock me-1"></i> เวลา: ${timeDisplay}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-map-marker-alt me-1"></i> สถานที่: ${escapeHtml(ev.location || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-handshake me-1"></i> สหกรณ์จังหวัดระยอง: ${escapeHtml(ev.coopParticipation || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-layer-group me-1"></i> กลุ่มงาน: ${escapeHtml(ev.workGroup || '-')}</p>
                            <p class="mb-1 small text-secondary"><i class="fas fa-file-alt me-1"></i> รายละเอียด: ${escapeHtml(ev.detail || '-')}</p>
                            <hr style="border-color: var(--border-color); margin: 8px 0;">
                            <small class="text-muted d-block text-end fst-italic" style="font-size:0.7em;"><i class="fas fa-user me-1"></i> ผู้สร้างโพสนี้: ${escapeHtml(ev.postedBy)}</small>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="list-group-item bg-transparent border-bottom">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0 text-primary">🚗 เลขทะเบียน : ${escapeHtml(ev.label)} <span class="${ev.driver === 'พนักงานขับรถลา' ? 'fw-bold' : 'fw-normal'}" style="font-size:0.85em;${ev.driver === 'พนักงานขับรถลา' ? 'color:#dc3545;' : 'color:var(--text-muted);'}">(พนักงานขับรถ : ${escapeHtml(ev.driver || '-')})</span></h6>
                                <span class="badge-status badge-${(ev.status || '').toLowerCase()}">${escapeHtml(ev.status)}</span>
                            </div>
                            <p class="mb-1 small text-secondary"><i class="fas fa-user-tag me-1"></i> ผู้ขอใช้รถ : ${escapeHtml(ev.requestor || '-')}</p>
                            <div class="d-flex gap-3 mb-1 small text-secondary">
                                <span><i class="fas fa-clock me-1"></i> เวลาไป : ${formatTime(ev.departureTime)}</span>
                                <span><i class="fas fa-clock me-1"></i> เวลากลับ : ${formatTime(ev.returnTime)}</span>
                            </div>
                            <p class="mb-1 small text-secondary"><i class="fas fa-map-marker-alt me-1"></i> สถานที่ : ${escapeHtml(ev.destination || '-')}</p>
                            <p class="mb-0 small text-secondary"><i class="fas fa-bullseye me-1"></i> เพื่อ : ${escapeHtml(ev.purpose || '-')}</p>
                            <hr style="border-color: var(--border-color); margin: 8px 0;">
                            <small class="text-muted d-block text-end fst-italic" style="font-size:0.7em;"><i class="fas fa-user me-1"></i> ผู้สร้างโพสนี้: ${escapeHtml(ev.postedBy || '-')}</small>
                        </div>
                    `;
                }
            });
        }
        html += '</div>';

        document.getElementById('detailModalTitle').textContent = modalTitle;
        document.getElementById('detailModalBody').innerHTML = html;
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    }
};

// ============================================================
// 📁 FILE UPLOAD HELPER
// ============================================================

/**
 * Upload a File via Base64 to GAS → Google Drive
 * @param {File} file
 * @returns {Promise<Object>}
 */
async function uploadFile(file) {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        return { success: false, error: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB' };
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function () {
            // Extract base64 data (remove "data:...;base64," prefix)
            const base64Data = reader.result.split(',')[1];
            const result = await API.post({
                action: 'uploadFile',
                fileName: file.name,
                mimeType: file.type,
                base64Data: base64Data
            });
            resolve(result);
        };
        reader.onerror = () => resolve({ success: false, error: 'อ่านไฟล์ล้มเหลว' });
        reader.readAsDataURL(file);
    });
}

// ============================================================
// 🎨 UI HELPERS
// ============================================================

// ============================================================
// 🎨 UI HELPERS
// ============================================================

/** Show app section and update UI based on auth state */
function showApp() {
    // Show app section (it should be visible by default, but ensuring here)
    document.getElementById('appSection').style.display = 'flex';

    const user = AppState.user;
    const authLink = document.getElementById('authMenuLink');
    const authIcon = authLink.querySelector('i');

    if (user) {
        // Logged In
        document.getElementById('userDisplayName').textContent = user.name;
        document.getElementById('userDisplayRole').textContent = user.role;
        document.getElementById('userAvatar').textContent = (user.name || 'U').charAt(0);
        document.getElementById('userAvatar').innerHTML = (user.name || 'U').charAt(0); // Text avatar

        // Update Auth Link to Logout (Red)
        authLink.className = 'nav-link text-danger mt-2';
        authLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> ออกจากระบบ';

        // Show Admin Only Elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = AppState.isAdmin() ? 'inline-block' : 'none';
        });

        // Show SuperAdmin Only Elements
        document.querySelectorAll('.superadmin-only').forEach(el => {
            el.style.display = AppState.isSuperAdmin() ? 'block' : 'none';
        });

        // Show Auth Only Elements
        document.querySelectorAll('.auth-only').forEach(el => {
            el.style.display = 'block';
        });

        // Show Settings Menu if Superadmin
        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) {
            if (AppState.isSuperAdmin()) {
                settingsMenu.classList.remove('d-none');
            } else {
                settingsMenu.classList.add('d-none');
            }
        }

    } else {
        // Guest
        document.getElementById('userDisplayName').textContent = 'ผู้เยี่ยมชม';
        document.getElementById('userDisplayRole').textContent = 'บุคคลทั่วไป';
        document.getElementById('userAvatar').innerHTML = '<i class="fas fa-user"></i>';

        // Update Auth Link to Login (Normal)
        authLink.className = 'nav-link mt-2';
        authLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> เข้าสู่ระบบ';

        // Hide Admin Only Elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });

        // Hide SuperAdmin Only Elements
        document.querySelectorAll('.superadmin-only').forEach(el => {
            el.style.display = 'none';
        });

        // Hide Auth Only Elements
        document.querySelectorAll('.auth-only').forEach(el => {
            el.style.display = 'none';
        });

        // Hide Settings Menu
        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) {
            settingsMenu.classList.add('d-none');
        }
    }

    // Refresh current view if we are already viewing data
    const activePage = document.querySelector('.page-section.active-page');
    if (activePage) {
        // If we just logged in/out, re-render the current list to show/hide action buttons
        const pageId = activePage.id.replace('page-', '');
        if (pageId === 'announcements') Announcements.render(AppState.announcements);
        if (pageId === 'vehicles') VehicleLogs.render(AppState.vehicleLogs);
        if (pageId === 'calendar') Calendar.load();
        if (pageId === 'logs') SystemLogs.load();
        if (pageId === 'dashboard') Dashboard.load();
    } else {
        // Default to calendar
        navigateTo('calendar');
    }
}

/** Navigate between pages */
function navigateTo(page) {
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Show target page
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active-page'));
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) targetPage.classList.add('active-page');

    // Load data for the page
    switch (page) {
        case 'calendar':
            Calendar.load();
            break;
        case 'announcements':
            Announcements.load();
            break;
        case 'vehicles':
            VehicleLogs.load();
            break;
        case 'logs':
            SystemLogs.load();
            break;
        case 'dashboard':
            Dashboard.load();
            break;
    }

    // Close sidebar on mobile
    document.querySelector('.sidebar')?.classList.remove('show');
}

/** Toggle sidebar on mobile */
function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('show');
}

/** Show toast notification */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;
    toast.innerHTML = `<i class="fas ${iconMap[type] || iconMap.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/** Animate counter from 0 to target */
function animateCounter(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.textContent = current.toLocaleString();
    }, 30);
}

/** Loading HTML */
function loadingHTML() {
    return `<tr><td colspan="10"><div class="loading-spinner"><div class="spinner-border"></div></div></td></tr>`;
}

/** Empty state HTML */
function emptyHTML(message) {
    return `<div class="empty-state"><i class="fas fa-inbox"></i><p>${message}</p></div>`;
}

/** Escape HTML special characters */
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Truncate string */
function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.slice(0, length) + '...' : str;
}

/** Format number */
function formatNumber(n) {
    if (n === '' || n === undefined || n === null) return '-';
    return Number(n).toLocaleString();
}

/** Format date to Thai format (d MMM yyyy) */
function formatThaiDate(dateVal) {
    if (!dateVal) return '-';

    // Thai Short Months
    const months = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.',
        'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.',
        'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    // Normalize to YYYY-MM-DD
    const dateStr = Calendar.normalizeDate(dateVal);
    if (!dateStr) return '-';

    const [y, m, d] = dateStr.split('-').map(Number);
    const thaiYear = y + 543;

    return `${d} ${months[m - 1]} ${thaiYear}`;
}

/** 
 * Parse time value for input[type="time"] (returns '' instead of '-' for empty)
 * Handles ISO strings from Google Sheets (1899-12-30T01:30:00.000Z) and HH:mm:ss
 */
function parseTimeForInput(timeVal) {
    if (!timeVal) return '';

    const str = String(timeVal);

    // If it's a full ISO date string (like 1899-12-30T...)
    if (str.includes('T')) {
        const d = new Date(str);
        if (isNaN(d.getTime())) return '';
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // If it's already HH:mm or HH:mm:ss
    if (str.includes(':')) {
        return str.substring(0, 5);
    }

    try {
        // If it's a full ISO string or Date object
        const d = new Date(timeVal);
        // Check if valid date and not just "12:00" string treated as date (which might be invalid or epoch)
        // Actually, if it's "HH:mm", new Date("HH:mm") is "Invalid Date" in most browsers
        if (!isNaN(d.getTime()) && String(timeVal).includes('T')) {
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        }
    } catch (e) { }

    // Fallback for simple string HH:mm or HH:mm:ss
    const s = String(timeVal);
    if (s.includes(':')) {
        const parts = s.split(':');
        // ensure padded
        const h = parts[0].padStart(2, '0');
        const m = parts[1].padStart(2, '0');
        return `${h}:${m}`;
    }
    return '';
}

/**
 * Format time for display (e.g. 13:30)
 */
function formatTime(timeVal) {
    if (!timeVal) return '-';

    // If it's a full date string (like 1899-12-30T...)
    if (String(timeVal).includes('T')) {
        const d = new Date(timeVal);
        if (isNaN(d.getTime())) return '-';
        // Adjust for timezone if needed, or just take UTC hours/min if coming from sheet as formatted
        // Google Sheets often sends 1899-12-30T... for time-only cells adjusted to script timezone
        // Let's assume the time part is correct in local time if standard string, 
        // or just parse simple HH:mm if it fits
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // If it's already HH:mm:ss
    if (String(timeVal).includes(':')) {
        return String(timeVal).substring(0, 5);
    }

    return timeVal;
}

// ============================================================
// 🌓 THEME MODULE
// ============================================================
const ThemeModule = {
    init() {
        const savedTheme = localStorage.getItem('oms-theme');
        // If no saved theme, default to 'light' (which is default in CSS, so NO data-theme attribute)
        // If saved is 'dark', apply it.
        if (savedTheme === 'dark') {
            this.apply('dark');
        } else {
            this.apply('light');
        }
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        const target = current === 'dark' ? 'light' : 'dark';
        this.apply(target);
    },

    apply(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            const checkbox = document.getElementById('checkbox');
            if (checkbox) checkbox.checked = true;
        } else {
            document.documentElement.removeAttribute('data-theme');
            const checkbox = document.getElementById('checkbox');
            if (checkbox) checkbox.checked = false;
        }
        localStorage.setItem('oms-theme', theme);
    }
};

/** Global toggle function */
function toggleTheme() {
    ThemeModule.toggle();
}

// ============================================================
// 📊 DASHBOARD MODULE
// ============================================================
const Dashboard = {
    charts: {},

    load() {
        if (!AppState.isAdmin()) return;

        // Process existing data
        const announcements = AppState.announcements || [];
        const vehicles = AppState.vehicleLogs || [];

        // Update Overview Cards
        let activeVeh = 0;
        vehicles.forEach(v => {
            if (v.Status === 'Active') activeVeh++;
        });

        animateCounter('dashTotalAnn', announcements.length);
        animateCounter('dashTotalVeh', vehicles.length);
        animateCounter('dashActiveVeh', activeVeh);

        // Render Charts
        this.renderVehiclePieChart(vehicles);
        this.renderAnnBarChart(announcements);
        this.renderMonthlyTrendChart(announcements, vehicles);
    },

    renderVehiclePieChart(vehicles) {
        const ctx = document.getElementById('vehiclePieChart');
        if (!ctx) return;

        // Count by License
        const counts = {};
        vehicles.forEach(v => {
            const license = v.CarLicense || 'ไม่ระบุ';
            counts[license] = (counts[license] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);

        if (this.charts.vehiclePie) this.charts.vehiclePie.destroy();

        this.charts.vehiclePie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#6c63ff', '#ff6b9d', '#2ecc71', '#f39c12', '#3498db', '#9b59b6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { font: { family: 'Prompt' }, color: 'var(--text-primary)' } }
                }
            }
        });
    },

    renderAnnBarChart(announcements) {
        const ctx = document.getElementById('annBarChart');
        if (!ctx) return;

        // Count by WorkGroup
        const counts = {};
        announcements.forEach(a => {
            const group = a.WorkGroup || 'ไม่ระบุ';
            counts[group] = (counts[group] || 0) + 1;
        });

        // Sort by highest count
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10); // Top 10
        const labels = sorted.map(item => item[0]);
        const data = sorted.map(item => item[1]);

        if (this.charts.annBar) this.charts.annBar.destroy();

        this.charts.annBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'จำนวนงาน',
                    data: data,
                    backgroundColor: '#6c63ff',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: 'Prompt' }, color: 'var(--text-secondary)' } },
                    x: { ticks: { font: { family: 'Prompt' }, color: 'var(--text-secondary)' } }
                }
            }
        });
    },

    renderMonthlyTrendChart(announcements, vehicles) {
        const ctx = document.getElementById('monthlyTrendChart');
        if (!ctx) return;

        // Get last 6 months labels
        const labels = [];
        const monthsStr = [];
        const d = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(d.getFullYear(), d.getMonth() - i, 1);
            labels.push(`${Calendar.THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`);
            const mStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsStr.push(mStr);
        }

        // Count for each month
        const annData = new Array(6).fill(0);
        const vehData = new Array(6).fill(0);

        announcements.forEach(a => {
            if (!a.Date) return;
            const dateStr = Calendar.normalizeDate(a.Date);
            const m = dateStr.substring(0, 7);
            const idx = monthsStr.indexOf(m);
            if (idx !== -1) annData[idx]++;
        });

        vehicles.forEach(v => {
            if (!v.Date) return;
            const dateStr = Calendar.normalizeDate(v.Date);
            const m = dateStr.substring(0, 7);
            const idx = monthsStr.indexOf(m);
            if (idx !== -1) vehData[idx]++;
        });

        if (this.charts.trend) this.charts.trend.destroy();

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'การปฏิบัติงาน',
                        data: annData,
                        borderColor: '#6c63ff',
                        backgroundColor: 'rgba(108, 99, 255, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'การใช้รถราชการ',
                        data: vehData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Prompt' }, color: 'var(--text-primary)' } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: 'Prompt' }, color: 'var(--text-secondary)' } },
                    x: { ticks: { font: { family: 'Prompt' }, color: 'var(--text-secondary)' } }
                }
            }
        });
    }
};

// ============================================================
// 📄 EXPORT & PRINT UTILS
// ============================================================
const ExportUtils = {
    /** Export current table view to Excel */
    exportToExcel(type) {
        let tableId = '';
        let fileName = '';

        if (type === 'announcements') {
            tableId = 'announcementsTableBody';
            fileName = 'รายงานการปฏิบัติงาน_' + this.getTimestamp() + '.xlsx';
        } else if (type === 'vehicles') {
            tableId = 'vehicleTableBody';
            fileName = 'รายงานการขอใช้รถราชการ_' + this.getTimestamp() + '.xlsx';
        } else {
            return;
        }

        const table = document.getElementById(tableId).closest('table');
        if (!table) return;

        // Clone table to modify it before export
        const cloneTable = table.cloneNode(true);

        // Remove columns with 'จัดการ' or 'เอกสารแนบ' if needed, here we just remove the last column (จัดการ)
        const ths = cloneTable.querySelectorAll('th');
        if (ths.length > 0 && ths[ths.length - 1].innerText.includes('จัดการ')) {
            cloneTable.querySelectorAll('tr').forEach(row => {
                if (row.lastElementChild) {
                    row.removeChild(row.lastElementChild);
                }
            });
        }

        const wb = XLSX.utils.table_to_book(cloneTable, { sheet: "Sheet1" });
        XLSX.writeFile(wb, fileName);
    },

    /** Print simple table view */
    printTable(type) {
        document.body.classList.add('printing-table');
        if (type === 'announcements') {
            document.body.classList.add('print-announcements');
        } else if (type === 'vehicles') {
            document.body.classList.add('print-vehicles');
        }

        window.print();

        // Clean up classes after print dialog closes
        setTimeout(() => {
            document.body.classList.remove('printing-table', 'print-announcements', 'print-vehicles');
        }, 1000);
    },

    /** Generate and print the vehicle request form */
    printVehicleForm(id) {
        const item = AppState.vehicleLogs.find(v => v.ID === id);
        if (!item) {
            showToast('ไม่พบข้อมูลบันทึก', 'error');
            return;
        }

        // Populate the print template
        const template = document.getElementById('printTemplate');
        if (!template) return;

        const dateObj = new Date(Calendar.normalizeDate(item.Date));
        const thaiYear = dateObj.getFullYear() + 543;
        const thaiMonth = Calendar.THAI_MONTHS[dateObj.getMonth()];
        const thaiDay = dateObj.getDate();

        // Safe DOM updates
        const updateText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text || '-';
        };

        updateText('pt-date', `${thaiDay} ${thaiMonth} ${thaiYear}`);
        updateText('pt-requestor', item.Requestor || item.requestor);
        updateText('pt-purpose', item.Purpose);
        updateText('pt-destination', item.Destination);
        updateText('pt-car', item.CarLicense);
        updateText('pt-driver', item.Driver);
        updateText('pt-time-dep', formatTime(item.DepartureTime));
        updateText('pt-time-ret', formatTime(item.ReturnTime));

        // Trigger print mode
        document.body.classList.add('printing-form');
        window.print();

        // Clean up
        setTimeout(() => {
            document.body.classList.remove('printing-form');
        }, 1000);
    },

    getTimestamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }
};

// ============================================================
// 📋 SYSTEM LOGS MODULE
// ============================================================
const SystemLogs = {
    /** Fetch and render all system logs */
    async load() {
        if (!AppState.isSuperAdmin()) return;

        const container = document.getElementById('logsTableBody');
        container.innerHTML = loadingHTML();

        const result = await API.get({ action: 'getLogs', username: AppState.user.username, password: AppState.user.password });

        if (result.success) {
            this.render(result.data);
        } else {
            container.innerHTML = emptyHTML(result.error || 'ไม่สามารถโหลดข้อมูลบันทึกระบบได้');
        }
    },

    /** Render logs table */
    render(data) {
        const container = document.getElementById('logsTableBody');

        if (!data || data.length === 0) {
            container.innerHTML = `<tr><td colspan="5">${emptyHTML('ยังไม่มีบันทึกข้อมูล')}</td></tr>`;
            return;
        }

        container.innerHTML = data.map((item, index) => {
            const dateObj = new Date(item.Timestamp);
            // Format to basic Thai display with time
            const dateDisplay = isNaN(dateObj.getTime()) ? escapeHtml(item.Timestamp) :
                formatThaiDate(item.Timestamp) + ' ' + dateObj.toLocaleTimeString('th-TH');

            let actionColor = 'var(--text-color)';
            if (item.Action === 'Add') actionColor = '#28a745';
            else if (item.Action === 'Update') actionColor = '#ffc107';
            else if (item.Action === 'Delete') actionColor = '#dc3545';

            return `
      <tr class="fade-in" style="animation-delay: ${Math.min(index * 0.02, 0.5)}s">
        <td data-label="วันที่/เวลา" style="white-space: nowrap;">${dateDisplay}</td>
        <td data-label="ผู้ใช้งาน"><strong>${escapeHtml(item.Username || '-')}</strong></td>
        <td data-label="การกระทำ"><span style="color: ${actionColor}; font-weight: bold;">${escapeHtml(item.Action || '-')}</span></td>
        <td data-label="ส่วนงาน">${escapeHtml(item.Module || '-')}</td>
        <td data-label="รายละเอียด" style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.Detail || '-')}</td>
      </tr>
    `;
        }).join('');
    }
};
