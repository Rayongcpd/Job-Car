/**
 * ============================================================
 * CPD-RAYONG | Office Management System — Frontend JavaScript
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

        // Handle Return to Calendar Group Modal after closing vehicle form
        document.getElementById('vehFormModal').addEventListener('hidden.bs.modal', async () => {
            if (VehicleLogs.editFromCalendar) {
                VehicleLogs.editFromCalendar = false;
                
                // If there's an active load, wait for it to finish to display fresh data
                if (Calendar._lastLoadPromise) {
                    await Calendar._lastLoadPromise;
                }

                if (Calendar.lastOpenedGroup) {
                    // Small delay to ensure the DOM and Bootstrap state are ready for a new modal
                    setTimeout(() => {
                        Calendar.showGroup(Calendar.lastOpenedGroup.dateStr, Calendar.lastOpenedGroup.type);
                    }, 100);
                }
            }
        });

        // Toggle Cancel Reason visibility
        document.getElementById('vehStatus').addEventListener('change', (e) => {
            const group = document.getElementById('vehCancelReasonGroup');
            if (e.target.value === 'Cancelled') {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });

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
        loginBtn.innerHTML = '<i data-lucide="log-in" style="width:18px;height:18px;" class="me-2"></i>เข้าสู่ระบบ';
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

    /**
     * Color presets: 10+default for Announcements, 10+default for Vehicles (22 total).
     * Apply with applyPreset('ann', i) or applyPreset('veh', i).
     */
    PRESETS: {
        ann: [
            {
                name: '\u2b50 \u0e04\u0e48\u0e32\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19',
                colorAnn: '#6c63ff', colorAnnTime: '#596275', colorAnnLocation: '#596275',
                colorAnnCoop: '#596275', colorAnnGroup: '#596275', colorAnnDetail: '#596275'
            },
            {
                name: '\ud83c\udf0a Ocean Breeze',
                colorAnn: '#4361ee', colorAnnTime: '#0096c7', colorAnnLocation: '#0077b6',
                colorAnnCoop: '#023e8a', colorAnnGroup: '#48cae4', colorAnnDetail: '#90e0ef'
            },
            {
                name: '\ud83c\udf38 Cherry Blossom',
                colorAnn: '#e63946', colorAnnTime: '#f72585', colorAnnLocation: '#b5179e',
                colorAnnCoop: '#7209b7', colorAnnGroup: '#e91e63', colorAnnDetail: '#9c27b0'
            },
            {
                name: '\ud83c\udf3f Emerald Forest',
                colorAnn: '#2d6a4f', colorAnnTime: '#40916c', colorAnnLocation: '#52b788',
                colorAnnCoop: '#74c69d', colorAnnGroup: '#95d5b2', colorAnnDetail: '#1b4332'
            },
            {
                name: '\ud83c\udf05 Sunset Gold',
                colorAnn: '#e76f51', colorAnnTime: '#f4a261', colorAnnLocation: '#e9c46a',
                colorAnnCoop: '#264653', colorAnnGroup: '#2a9d8f', colorAnnDetail: '#e9c46a'
            },
            {
                name: '\ud83c\udf19 Midnight Chic',
                colorAnn: '#3d405b', colorAnnTime: '#81b29a', colorAnnLocation: '#f2cc8f',
                colorAnnCoop: '#f4f1de', colorAnnGroup: '#e07a5f', colorAnnDetail: '#81b29a'
            },
            {
                name: '\ud83d\udc8e Royal Purple',
                colorAnn: '#6a0dad', colorAnnTime: '#9b59b6', colorAnnLocation: '#8e44ad',
                colorAnnCoop: '#d7bde2', colorAnnGroup: '#a569bd', colorAnnDetail: '#c39bd3'
            },
            {
                name: '\ud83c\udf8a Coral Dawn',
                colorAnn: '#ff6b6b', colorAnnTime: '#ee5a24', colorAnnLocation: '#f79f1f',
                colorAnnCoop: '#ffc312', colorAnnGroup: '#c0392b', colorAnnDetail: '#ff9ff3'
            },
            {
                name: '\ud83c\udf0c Deep Universe',
                colorAnn: '#0c0032', colorAnnTime: '#190061', colorAnnLocation: '#240090',
                colorAnnCoop: '#3500d3', colorAnnGroup: '#282828', colorAnnDetail: '#3500d3'
            },
            {
                name: '\ud83e\udded Desert Dusk',
                colorAnn: '#b5451b', colorAnnTime: '#e7835a', colorAnnLocation: '#ebb28e',
                colorAnnCoop: '#8c5523', colorAnnGroup: '#c87941', colorAnnDetail: '#f9dbc0'
            },
            {
                name: '\ud83e\udd84 Pastel Dream',
                colorAnn: '#c77dff', colorAnnTime: '#a29bfe', colorAnnLocation: '#74b9ff',
                colorAnnCoop: '#81ecec', colorAnnGroup: '#fd79a8', colorAnnDetail: '#fdcb6e'
            }
        ],
        veh: [
            {
                name: '\u2b50 \u0e04\u0e48\u0e32\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19',
                colorVeh: '#ff6b9d', colorVehRequestor: '#596275', colorVehDeparture: '#596275',
                colorVehReturn: '#596275', colorVehDestination: '#596275', colorVehPurpose: '#596275'
            },
            {
                name: '\ud83d\udd25 Fire Drive',
                colorVeh: '#ff6b9d', colorVehRequestor: '#ff4d6d', colorVehDeparture: '#c9184a',
                colorVehReturn: '#ff758c', colorVehDestination: '#ff8fab', colorVehPurpose: '#ffb3c1'
            },
            {
                name: '\ud83c\udf0a Cool Teal',
                colorVeh: '#14b8a6', colorVehRequestor: '#0d9488', colorVehDeparture: '#0f766e',
                colorVehReturn: '#134e4a', colorVehDestination: '#99f6e4', colorVehPurpose: '#5eead4'
            },
            {
                name: '\u26a1 Electric Purple',
                colorVeh: '#7c3aed', colorVehRequestor: '#6d28d9', colorVehDeparture: '#5b21b6',
                colorVehReturn: '#a855f7', colorVehDestination: '#c084fc', colorVehPurpose: '#e879f9'
            },
            {
                name: '\ud83c\udf4a Citrus Pop',
                colorVeh: '#f97316', colorVehRequestor: '#ea580c', colorVehDeparture: '#c2410c',
                colorVehReturn: '#fb923c', colorVehDestination: '#fed7aa', colorVehPurpose: '#fbbf24'
            },
            {
                name: '\ud83c\udf3f Mint Fresh',
                colorVeh: '#10b981', colorVehRequestor: '#059669', colorVehDeparture: '#047857',
                colorVehReturn: '#065f46', colorVehDestination: '#6ee7b7', colorVehPurpose: '#a7f3d0'
            },
            {
                name: '\ud83c\udf39 Rose Gold',
                colorVeh: '#c9446e', colorVehRequestor: '#e8749a', colorVehDeparture: '#d4a5a5',
                colorVehReturn: '#b5446e', colorVehDestination: '#f4c2c2', colorVehPurpose: '#e8acd0'
            },
            {
                name: '\ud83c\udf29\ufe0f Storm Grey',
                colorVeh: '#636e72', colorVehRequestor: '#2d3436', colorVehDeparture: '#74b9ff',
                colorVehReturn: '#b2bec3', colorVehDestination: '#dfe6e9', colorVehPurpose: '#81ecec'
            },
            {
                name: '\ud83d\udccd Crimson Tide',
                colorVeh: '#8b0000', colorVehRequestor: '#dc143c', colorVehDeparture: '#ff6347',
                colorVehReturn: '#b22222', colorVehDestination: '#cd5c5c', colorVehPurpose: '#f08080'
            },
            {
                name: '\ud83d\udcda Sapphire Blue',
                colorVeh: '#1a5276', colorVehRequestor: '#1f618d', colorVehDeparture: '#2e86c1',
                colorVehReturn: '#3498db', colorVehDestination: '#85c1e9', colorVehPurpose: '#aed6f1'
            },
            {
                name: '\ud83c\udf5c Neon Lime',
                colorVeh: '#39d353', colorVehRequestor: '#00b300', colorVehDeparture: '#009900',
                colorVehReturn: '#7fff00', colorVehDestination: '#adff2f', colorVehPurpose: '#ccff66'
            }
        ]
    },

    /**
     * Apply a preset palette to the color pickers for a given section.
     * @param {'ann'|'veh'} section - which section's presets to apply
     * @param {number} index - index of the preset in the section's array
     */
    applyPreset(section, index) {
        const preset = this.PRESETS[section][index];
        if (!preset) return;

        // Highlight active swatch in this section only
        document.querySelectorAll(`.preset-swatch-${section}`).forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });

        // Map preset keys to input element IDs
        const idMap = {
            colorAnn: 'settingColorAnn',
            colorAnnTime: 'settingColorAnnTime',
            colorAnnLocation: 'settingColorAnnLocation',
            colorAnnCoop: 'settingColorAnnCoop',
            colorAnnGroup: 'settingColorAnnGroup',
            colorAnnDetail: 'settingColorAnnDetail',
            colorVeh: 'settingColorVeh',
            colorVehRequestor: 'settingColorVehRequestor',
            colorVehDeparture: 'settingColorVehDeparture',
            colorVehReturn: 'settingColorVehReturn',
            colorVehDestination: 'settingColorVehDestination',
            colorVehPurpose: 'settingColorVehPurpose'
        };

        Object.entries(preset).forEach(([key, value]) => {
            if (key === 'name') return;
            const el = document.getElementById(idMap[key]);
            if (el) el.value = value;
        });
    },

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
        if (this.data.colorAnn) {
            root.style.setProperty('--color-announcement', this.data.colorAnn);
            console.log("Applied color announcement:", this.data.colorAnn);
        }
        if (this.data.colorVeh) {
            root.style.setProperty('--color-vehicle', this.data.colorVeh);
            console.log("Applied color vehicle:", this.data.colorVeh);
        }
        if (this.data.colorAnnTime) root.style.setProperty('--color-ann-time', this.data.colorAnnTime);
        if (this.data.colorAnnLocation) root.style.setProperty('--color-ann-location', this.data.colorAnnLocation);
        if (this.data.colorAnnCoop) root.style.setProperty('--color-ann-coop', this.data.colorAnnCoop);
        if (this.data.colorAnnGroup) root.style.setProperty('--color-ann-group', this.data.colorAnnGroup);
        if (this.data.colorAnnDetail) root.style.setProperty('--color-ann-detail', this.data.colorAnnDetail);

        if (this.data.colorVehRequestor) root.style.setProperty('--color-veh-requestor', this.data.colorVehRequestor);
        if (this.data.colorVehDeparture) root.style.setProperty('--color-veh-departure', this.data.colorVehDeparture);
        if (this.data.colorVehReturn) root.style.setProperty('--color-veh-return', this.data.colorVehReturn);
        if (this.data.colorVehDestination) root.style.setProperty('--color-veh-destination', this.data.colorVehDestination);
        if (this.data.colorVehPurpose) root.style.setProperty('--color-veh-purpose', this.data.colorVehPurpose);
    },

    /** Show settings modal and populate current values */
    showModal() {
        if (!AppState.isSuperAdmin()) return;

        document.getElementById('settingCalendarWidth').value = this.data.calendarMinWidth || '100%';
        document.getElementById('settingCellHeight').value = this.data.calendarCellMinHeight || '100';
        document.getElementById('settingFontSize').value = this.data.calendarFontSize || '11';

        // Set colors, fallback to defaults if not set
        document.getElementById('settingColorAnn').value = this.data.colorAnn || '#6c63ff';
        document.getElementById('settingColorVeh').value = this.data.colorVeh || '#ff6b9d';
        document.getElementById('settingColorAnnTime').value = this.data.colorAnnTime || '#596275';
        document.getElementById('settingColorAnnLocation').value = this.data.colorAnnLocation || '#596275';
        document.getElementById('settingColorAnnCoop').value = this.data.colorAnnCoop || '#596275';
        document.getElementById('settingColorAnnGroup').value = this.data.colorAnnGroup || '#596275';
        document.getElementById('settingColorAnnDetail').value = this.data.colorAnnDetail || '#596275';

        document.getElementById('settingColorVehRequestor').value = this.data.colorVehRequestor || '#596275';
        document.getElementById('settingColorVehDeparture').value = this.data.colorVehDeparture || '#596275';
        document.getElementById('settingColorVehReturn').value = this.data.colorVehReturn || '#596275';
        document.getElementById('settingColorVehDestination').value = this.data.colorVehDestination || '#596275';
        document.getElementById('settingColorVehPurpose').value = this.data.colorVehPurpose || '#596275';

        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    },

    /** Save settings to API and apply immediately */
    async save() {
        if (!AppState.isSuperAdmin()) return;

        const calendarMinWidth = document.getElementById('settingCalendarWidth').value.trim();
        const calendarCellMinHeight = document.getElementById('settingCellHeight').value.trim();
        const calendarFontSize = document.getElementById('settingFontSize').value.trim();
        const colorAnn = document.getElementById('settingColorAnn').value;
        const colorVeh = document.getElementById('settingColorVeh').value;
        // Provide defaults if empty
        const settings = {
            calendarMinWidth: calendarMinWidth || '100%',
            calendarCellMinHeight: calendarCellMinHeight || '100',
            calendarFontSize: calendarFontSize || '11',
            colorAnn: colorAnn || '#6c63ff',
            colorVeh: colorVeh || '#ff6b9d',
            colorAnnTime: document.getElementById('settingColorAnnTime').value || '#596275',
            colorAnnLocation: document.getElementById('settingColorAnnLocation').value || '#596275',
            colorAnnCoop: document.getElementById('settingColorAnnCoop').value || '#596275',
            colorAnnGroup: document.getElementById('settingColorAnnGroup').value || '#596275',
            colorAnnDetail: document.getElementById('settingColorAnnDetail').value || '#596275',
            colorVehRequestor: document.getElementById('settingColorVehRequestor').value || '#596275',
            colorVehDeparture: document.getElementById('settingColorVehDeparture').value || '#596275',
            colorVehReturn: document.getElementById('settingColorVehReturn').value || '#596275',
            colorVehDestination: document.getElementById('settingColorVehDestination').value || '#596275',
            colorVehPurpose: document.getElementById('settingColorVehPurpose').value || '#596275'
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
        btn.innerHTML = '<i data-lucide="save" style="width:16px;height:16px;" class="me-2"></i>บันทึกการตั้งค่า';
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
                html = `<div class="small pt-2" style="color:var(--text-tertiary)">แสดงรายการวันนี้และอนาคต</div>`;
                break;
            default: // all
                html = `<div class="small pt-2" style="color:var(--text-tertiary)">แสดงข้อมูลทั้งหมด</div>`;
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
        const listContainer = document.getElementById('announcementsList');
        listContainer.innerHTML = `<div class="loading-spinner"><div class="spinner-border"></div></div>`;

        const result = await API.get({ action: 'getAnnouncements' });

        if (result.success) {
            AppState.announcements = result.data;
            this.applyFilter();
        } else {
            listContainer.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render announcements cards */
    render(data) {
        const listContainer = document.getElementById('announcementsList');
        const tableContainer = document.getElementById('announcementsTableBody');

        if (!data || data.length === 0) {
            listContainer.innerHTML = emptyHTML('ยังไม่มีรายการปฏิบัติงาน');
            tableContainer.innerHTML = '';
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        // Card view
        listContainer.innerHTML = data.map((item, index) => {
            let timeDisplay = '-';
            if (item.Time) {
                timeDisplay = formatTime(item.Time);
                if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
            }
            const isPast = Calendar.normalizeDate(item.Date) < today;

            return `
      <div class="list-card fade-in${isPast ? ' row-past' : ''}" style="animation-delay: ${index * 0.05}s">
        <div class="list-card-header">
          <div class="list-card-title">${escapeHtml(item.Title || '')}</div>
          <span style="color:var(--text-tertiary);font-size:12px;white-space:nowrap">#${index + 1}</span>
        </div>
        <div class="list-card-meta">
          <span><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${formatThaiDate(item.Date)}</span>
          <span><i data-lucide="clock" style="width:12px;height:12px;"></i> ${timeDisplay}</span>
          ${item.Location ? `<span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${escapeHtml(item.Location)}</span>` : ''}
          ${item.CoopParticipation ? `<span><i data-lucide="users" style="width:12px;height:12px;"></i> ${escapeHtml(item.CoopParticipation)}</span>` : ''}
          ${item.WorkGroup ? `<span><i data-lucide="layers" style="width:12px;height:12px;"></i> ${escapeHtml(item.WorkGroup)}</span>` : ''}
        </div>
        <div class="list-card-body">${escapeHtml(truncate(item.Detail || '', 120))}</div>
        <div class="list-card-footer">
          <span style="font-size:12px;color:var(--text-tertiary)"><i data-lucide="user" style="width:12px;height:12px;"></i> ${escapeHtml(item.PostedBy || '')}</span>
          <div class="list-card-actions">
            ${item.FileURL ? `<a href="${item.FileURL}" target="_blank" class="file-link"><i data-lucide="paperclip" style="width:14px;height:14px;"></i></a>` : ''}
            <button class="btn btn-outline-custom btn-sm" onclick="Announcements.showDetail('${item.ID}')" title="ดูรายละเอียด">
              <i data-lucide="eye" style="width:14px;height:14px;"></i>
            </button>
            ${AppState.isAdmin() ? `
            <button class="btn btn-outline-custom btn-sm" onclick="Announcements.showEdit('${item.ID}')" title="แก้ไข">
              <i data-lucide="pencil" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-danger-custom btn-sm" onclick="Announcements.confirmDelete('${item.ID}')" title="ลบ">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
        }).join('');

        // Hidden table for print
        tableContainer.innerHTML = data.map((item, index) => {
            let timeDisplay = '-';
            if (item.Time) {
                timeDisplay = formatTime(item.Time);
                if (item.TimeSuffix) timeDisplay += ' ' + escapeHtml(item.TimeSuffix);
            }
            const isPast = Calendar.normalizeDate(item.Date) < today;
            return `
      <tr class="${isPast ? 'row-past' : ''}">
        <td>${index + 1}</td>
        <td>${formatThaiDate(item.Date)}</td>
        <td>${timeDisplay}</td>
        <td><strong>${escapeHtml(item.Title || '')}</strong><br><small>${truncate(item.Detail || '', 40)}</small></td>
        <td>${escapeHtml(item.Location || '-')}</td>
        <td>${escapeHtml(item.CoopParticipation || '-')}</td>
        <td>${escapeHtml(item.WorkGroup || '-')}</td>
        <td>${item.FileURL ? 'มี' : '-'}</td>
        <td>${escapeHtml(item.PostedBy || '')}</td>
        <td></td>
      </tr>
    `;
        }).join('');

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
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
      ${item.FileURL ? `<p><strong>เอกสารแนบ:</strong> <a href="${item.FileURL}" target="_blank" class="file-link"><i data-lucide="download" style="width:14px;height:14px;"></i> ดาวน์โหลดไฟล์</a></p>` : ''}
      <hr style="border-color: var(--border-light);">
      <div class="detail-text">${escapeHtml(item.Detail || 'ไม่มีรายละเอียด')}</div>
      <hr style="border-color: var(--border-light);">
      <p class="small" style="text-align: right;color:var(--text-tertiary)"><strong>โพสต์โดย:</strong> ${item.PostedBy}</p>
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
        const sendNotification = document.getElementById('annSendNotification').checked;

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
        const payload = { action, title, date, time, timeSuffix, location, coopParticipation, workGroup, detail, fileURL, sendNotification };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('annFormModal')).hide();
            this.load();
            Calendar.load(); 
            Dashboard.load();
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
            Calendar.load();
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
    editFromCalendar: false,

    /** Fetch and render all vehicle logs */
    async load() {
        const listContainer = document.getElementById('vehicleList');
        listContainer.innerHTML = `<div class="loading-spinner"><div class="spinner-border"></div></div>`;

        const result = await API.get({ action: 'getVehicleLogs' });

        if (result.success) {
            AppState.vehicleLogs = result.data;
            this.applyFilter();
        } else {
            listContainer.innerHTML = emptyHTML('ไม่สามารถโหลดข้อมูลได้');
        }
    },

    /** Render vehicle logs cards */
    render(data) {
        const listContainer = document.getElementById('vehicleList');
        const tableContainer = document.getElementById('vehicleTableBody');

        if (!data || data.length === 0) {
            listContainer.innerHTML = emptyHTML('ยังไม่มีบันทึกการใช้รถ');
            tableContainer.innerHTML = '';
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        // Card view
        listContainer.innerHTML = data.map((item, index) => {
            const isPast = Calendar.normalizeDate(item.Date) < today;
            const statusClass = (item.Status || '').toLowerCase();
            const statusLabel = item.Status === 'Pending' ? 'Prebook (รอดำเนินการ)' : escapeHtml(item.Status || '');
            return `
      <div class="list-card fade-in${isPast ? ' row-past' : ''}" style="animation-delay: ${index * 0.05}s">
        <div class="list-card-header">
          <div class="list-card-title">${escapeHtml(item.Purpose || '-')}</div>
          <span class="badge-status badge-${statusClass}">${statusLabel}</span>
        </div>
        <div class="list-card-meta">
          <span><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${formatThaiDate(item.Date)}</span>
          <span><i data-lucide="car" style="width:12px;height:12px;"></i> ${escapeHtml(item.CarLicense || '')}</span>
          <span><i data-lucide="clock" style="width:12px;height:12px;"></i> ${formatTime(item.DepartureTime)} - ${formatTime(item.ReturnTime)}</span>
          ${item.Destination ? `<span><i data-lucide="map-pin" style="width:12px;height:12px;"></i> ${escapeHtml(item.Destination)}</span>` : ''}
        </div>
        <div class="list-card-body">
          ผู้ขอ: <strong>${escapeHtml(item.Requestor || item.requestor || '-')}</strong>
          <span style="color:var(--text-tertiary)"> · ${escapeHtml(item.PassengerCount || 1)} คน · พนักงานขับ: ${item.Driver === 'พนักงานขับรถลา' ? '<span style="color:var(--accent-danger);font-weight:bold;">' + escapeHtml(item.Driver) + '</span>' : escapeHtml(item.Driver || '-')}</span>
        </div>
        <div class="list-card-footer">
          <span style="font-size:12px;color:var(--text-tertiary)">#${index + 1}</span>
          <div class="list-card-actions">
            ${AppState.isAdmin() ? `
            <button class="btn btn-outline-custom btn-sm" onclick="ExportUtils.printVehicleForm('${item.ID}')" title="พิมพ์ใบขออนุญาต">
              <i data-lucide="printer" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-outline-custom btn-sm" onclick="VehicleLogs.showEdit('${item.ID}')" title="แก้ไข">
              <i data-lucide="pencil" style="width:14px;height:14px;"></i>
            </button>
            <button class="btn btn-danger-custom btn-sm" onclick="VehicleLogs.confirmDelete('${item.ID}')" title="ลบ">
              <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
            </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
        }).join('');

        // Hidden table for print
        tableContainer.innerHTML = data.map((item, index) => {
            const isPast = Calendar.normalizeDate(item.Date) < today;
            return `
      <tr class="${isPast ? 'row-past' : ''}">
        <td>${index + 1}</td>
        <td>${formatThaiDate(item.Date)}</td>
        <td>${formatTime(item.DepartureTime)}</td>
        <td>${formatTime(item.ReturnTime)}</td>
        <td>${escapeHtml(item.CarLicense || '')}</td>
        <td>${escapeHtml(item.Purpose || '-')}</td>
        <td>${escapeHtml(item.Destination || '')}</td>
        <td>${escapeHtml(item.Requestor || item.requestor || '-')} (${escapeHtml(item.PassengerCount || 1)} คน)</td>
        <td>${escapeHtml(item.Driver || '')}</td>
        <td>${escapeHtml(item.Status || '')}</td>
        <td></td>
      </tr>
    `;
        }).join('');

        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 10);
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
        document.getElementById('vehPassengerCount').value = '1';
        document.getElementById('vehDepartureTime').value = '';
        document.getElementById('vehReturnTime').value = '';

        document.getElementById('vehDriver').value = '';
        document.getElementById('vehStatus').value = 'Approved';
        document.getElementById('vehCancelReason').value = '';
        document.getElementById('vehCancelReasonGroup').style.display = 'none';
        new bootstrap.Modal(document.getElementById('vehFormModal')).show();
    },

    /** Show edit form modal */
    showEdit(id, fromCalendar = false) {
        const item = AppState.vehicleLogs.find(v => v.ID === id);
        if (!item) return;

        this.editFromCalendar = fromCalendar;

        // Close detail modal if open
        const detailModalEl = document.getElementById('detailModal');
        const detailModalInstance = bootstrap.Modal.getInstance(detailModalEl);
        if (detailModalInstance) detailModalInstance.hide();

        document.getElementById('vehFormTitle').textContent = 'แก้ไขบันทึกการใช้รถ';
        document.getElementById('vehFormId').value = item.ID;
        // Format date to YYYY-MM-DD for input[type="date"]
        document.getElementById('vehDate').value = Calendar.normalizeDate(item.Date);
        document.getElementById('vehCarLicense').value = item.CarLicense || '';
        document.getElementById('vehPurpose').value = item.Purpose || '';
        document.getElementById('vehDestination').value = item.Destination || '';
        // Handle potential case sensitivity or missing field
        document.getElementById('vehRequestor').value = item.Requestor || item.requestor || '';
        document.getElementById('vehPassengerCount').value = item.PassengerCount || 1;
        // Format time for input[type="time"] - handles ISO strings from Google Sheets
        document.getElementById('vehDepartureTime').value = parseTimeForInput(item.DepartureTime);
        document.getElementById('vehReturnTime').value = parseTimeForInput(item.ReturnTime);

        document.getElementById('vehDriver').value = item.Driver || '';
        const status = item.Status || 'Approved';
        document.getElementById('vehStatus').value = status;
        document.getElementById('vehCancelReason').value = item.CancelReason || '';
        document.getElementById('vehCancelReasonGroup').style.display = status === 'Cancelled' ? 'block' : 'none';
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
        const passengerCount = document.getElementById('vehPassengerCount').value || 1;
        const departureTime = document.getElementById('vehDepartureTime').value;
        const returnTime = document.getElementById('vehReturnTime').value;
        const mileageStart = '';
        const mileageEnd = '';
        const driver = document.getElementById('vehDriver').value.trim();
        const status = document.getElementById('vehStatus').value;
        const sendNotification = document.getElementById('vehSendNotification').checked;

        if (!date || !destination || !requestor || !purpose) {
            showToast('กรุณากรอกข้อมูลที่จำเป็น (วันที่, จุดประสงค์, ปลายทาง, ผู้ขอ)', 'error');
            return;
        }

        const action = id ? 'updateVehicleLog' : 'addVehicleLog';
        const cancelReason = document.getElementById('vehCancelReason').value.trim();
        const payload = { action, date, carLicense, purpose, destination, requestor, passengerCount, departureTime, returnTime, mileageStart, mileageEnd, driver, status, sendNotification, cancelReason };
        if (id) payload.id = id;

        const result = await API.post(payload);

        if (result.success) {
            showToast(result.message, 'success');
            const loadPromise = Calendar.load(); // Start loading immediately
            bootstrap.Modal.getInstance(document.getElementById('vehFormModal')).hide();
            this.load();
            Dashboard.load();
            await loadPromise; // Ensure it finishes if called from elsewhere
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

    /** Quick update status directly from calendar detail modal (admin only) */
    async quickUpdateStatus(evDataB64, newStatus) {
        let ev;
        try {
            ev = JSON.parse(decodeURIComponent(atob(evDataB64)));
        } catch (e) {
            showToast('ข้อมูลไม่ถูกต้อง', 'error');
            return;
        }

        // Close current detail modal
        const detailModalEl = document.getElementById('detailModal');
        const detailModalInstance = bootstrap.Modal.getInstance(detailModalEl);
        if (detailModalInstance) detailModalInstance.hide();

        let cancelReason = '';
        if (newStatus === 'Cancelled') {
            cancelReason = prompt('กรุณาระบุเหตุผลในการยกเลิก (ระบุได้สูงสุด 100 ตัวอักษร):') || 'ไม่ระบุ';
            if (cancelReason === null) return; 
        }

        // Build payload from calendar event data (no need for AppState.vehicleLogs)
        const payload = {
            action: 'updateVehicleLog',
            id: ev.id,
            date: Calendar.normalizeDate(ev.date),
            carLicense: ev.label || '',
            purpose: ev.purpose || '',
            destination: ev.destination || '',
            requestor: ev.requestor || '',
            passengerCount: ev.passengerCount || 1,
            departureTime: parseTimeForInput(ev.departureTime),
            returnTime: parseTimeForInput(ev.returnTime),
            mileageStart: '',
            mileageEnd: '',
            driver: ev.driver || '',
            status: newStatus,
            cancelReason: cancelReason,
            sendNotification: false
        };

        showToast('กำลังเปลี่ยนสถานะ...', 'info');
        const result = await API.post(payload);

        if (result.success) {
            showToast(`เปลี่ยนสถานะเป็น "${newStatus}" สำเร็จ ✅`, 'success');
            this.load();
            Calendar.load();
            Dashboard.load();
        } else {
            showToast(result.error || 'เกิดข้อผิดพลาด', 'error');
        }
    },

    /** Confirm and delete vehicle log */
    async confirmDelete(id) {
        if (!confirm('ต้องการลบบันทึกนี้หรือไม่?')) return;

        const result = await API.post({ action: 'deleteVehicleLog', id });

        if (result.success) {
            showToast(result.message, 'success');
            this.load();
            Calendar.load();
            Dashboard.load();
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
    lastOpenedGroup: null, // { dateStr, type }
    _lastLoadPromise: null,

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

        // Fetch both data sources in parallel and store promise
        this._lastLoadPromise = (async () => {
            const [annResult, vehResult] = await Promise.all([
                API.get({ action: 'getAnnouncements' }),
                API.get({ action: 'getVehicleLogs' })
            ]);

            this.events = [];

            if (annResult.success && annResult.data) {
                AppState.announcements = annResult.data; // Sync to AppState
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
                AppState.vehicleLogs = vehResult.data; // Sync to AppState
                vehResult.data.forEach(item => {
                    if (item.Date) {
                        const status = item.Status || '';
                        const isAdmin = AppState.isAdmin();

                        // If Pending, it's a Prebook. Only show to admins.
                        if (status === 'Pending') {
                            if (isAdmin) {
                                this.events.push({
                                    type: 'prebook',
                                    date: this.normalizeDate(item.Date),
                                    label: item.CarLicense || 'รถ',
                                    id: item.ID,
                                    driver: item.Driver || '',
                                    status: 'Pending',
                                    purpose: item.Purpose || '',
                                    destination: item.Destination || '',
                                    requestor: item.Requestor || item.requestor || '',
                                    passengerCount: item.PassengerCount || 1,
                                    departureTime: item.DepartureTime || '',
                                    returnTime: item.ReturnTime || '',
                                    postedBy: item.PostedBy || ''
                                });
                            }
                        } else if (status === 'Approved' || status === 'Completed' || status === 'Cancelled') {
                            // General users see Approved/Completed/Cancelled
                            this.events.push({
                                type: status === 'Cancelled' ? 'cancelled' : 'vehicle',
                                date: this.normalizeDate(item.Date),
                                label: item.CarLicense || 'รถ',
                                id: item.ID,
                                driver: item.Driver || '',
                                status: status,
                                purpose: item.Purpose || '',
                                destination: item.Destination || '',
                                requestor: item.Requestor || item.requestor || '',
                                passengerCount: item.PassengerCount || 1,
                                departureTime: item.DepartureTime || '',
                                returnTime: item.ReturnTime || '',
                                postedBy: item.PostedBy || '',
                                cancelReason: item.CancelReason || ''
                            });
                        }
                    }
                });
            }
            return true;
        })();

        await this._lastLoadPromise;
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
            const prebookEvents = dayEvents.filter(e => e.type === 'prebook');
            const cancelledEvents = dayEvents.filter(e => e.type === 'cancelled');

            let dotsHtml = '<div class="calendar-event-dots">';
            let countsHtml = '';

            if (newsEvents.length > 0) {
                for (let i = 0; i < Math.min(newsEvents.length, 3); i++) {
                    dotsHtml += `<span class="calendar-event-dot announcement" onclick="Calendar.showGroup('${dateStr}', 'announcement')" title="ดูการปฏิบัติงาน"></span>`;
                }
                if (newsEvents.length > 3) {
                    countsHtml += `<span class="calendar-event-count announcement" onclick="Calendar.showGroup('${dateStr}', 'announcement')">+${newsEvents.length}</span>`;
                }
            }
            if (vehicleEvents.length > 0) {
                for (let i = 0; i < Math.min(vehicleEvents.length, 3); i++) {
                    dotsHtml += `<span class="calendar-event-dot vehicle" onclick="Calendar.showGroup('${dateStr}', 'vehicle')" title="ดูบันทึกการใช้รถ"></span>`;
                }
                if (vehicleEvents.length > 3) {
                    countsHtml += `<span class="calendar-event-count vehicle" onclick="Calendar.showGroup('${dateStr}', 'vehicle')">+${vehicleEvents.length}</span>`;
                }
            }
            if (prebookEvents.length > 0) {
                for (let i = 0; i < Math.min(prebookEvents.length, 2); i++) {
                    dotsHtml += `<span class="calendar-event-dot prebook" onclick="Calendar.showGroup('${dateStr}', 'prebook')" title="ดู Prebook (รอนุมัติ)"></span>`;
                }
            }
            if (cancelledEvents.length > 0) {
                for (let i = 0; i < Math.min(cancelledEvents.length, 2); i++) {
                    dotsHtml += `<span class="calendar-event-dot cancelled" onclick="Calendar.showGroup('${dateStr}', 'cancelled')" title="ดูรายการที่ยกเลิก"></span>`;
                }
            }
            dotsHtml += '</div>';

            html += `<div class="calendar-day${isToday ? ' today' : ''}" onclick="Calendar.showDayDetail('${dateStr}')">
                <div class="day-number">${d}</div>
                ${dotsHtml}
                ${countsHtml}
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
        this.showGroup(this.currentDate.toISOString().split('T')[0], type);
    },

    /** Show day detail in modal popup */
    showDayDetail(dateStr) {
        if (event) event.stopPropagation();

        const [yyyy, mm, dd] = dateStr.split('-');
        const thaiYear = parseInt(yyyy) + 543;
        const thaiMonth = Calendar.THAI_MONTHS[parseInt(mm) - 1];
        const modalTitle = `รายการในวันที่ ${parseInt(dd)} ${thaiMonth} ${thaiYear}`;

        const dayEvents = this.events.filter(ev => ev.date === dateStr);

        let html = '<div class="list-group list-group-flush">';
        if (dayEvents.length === 0) {
            html += '<div class="p-3 text-center" style="color:var(--text-tertiary)">ไม่มีรายการในวันนี้</div>';
        } else {
            dayEvents.forEach(ev => {
                const dotClass = ev.type === 'announcement' ? 'announcement' : ev.type === 'vehicle' ? 'vehicle' : ev.type === 'prebook' ? 'prebook' : 'cancelled';
                const typeLabel = ev.type === 'announcement' ? 'การปฏิบัติงาน' : ev.type === 'vehicle' ? 'บันทึกการใช้รถ' : ev.type === 'prebook' ? 'Prebook' : 'รายการที่ยกเลิก';
                const timeStr = ev.time ? formatTime(ev.time) : (ev.departureTime ? formatTime(ev.departureTime) : '');
                const isVehicle = ev.type === 'vehicle' || ev.type === 'prebook' || ev.type === 'cancelled';
                const vehicleMeta = isVehicle ? `<br>ผู้ขอใช้รถ: ${escapeHtml(ev.requestor || '-')} · ${ev.passengerCount || 1} คน` : '';
                html += `
                    <div class="list-group-item bg-transparent border-bottom">
                        <div class="d-flex align-items-start gap-2">
                            <span class="calendar-event-dot ${dotClass}" style="margin-top:6px;flex-shrink:0;"></span>
                            <div>
                                <div class="small" style="color:var(--text-tertiary)">${typeLabel}${timeStr ? ' · ' + timeStr : ''}</div>
                                <div style="color:var(--accent-primary);font-weight:500;">${escapeHtml(ev.label)}</div>
                                <div class="small" style="color:var(--text-secondary)">${escapeHtml(ev.location || ev.destination || ev.purpose || '-')}${vehicleMeta}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        html += '</div>';

        document.getElementById('detailModalTitle').textContent = modalTitle;
        document.getElementById('detailModalBody').innerHTML = html;
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    },

    /** Show grouped events in modal */
    showGroup(dateStr, type) {
        // Prevent bubbling if called from onclick directly (though in HTML we passed string values)
        if (event) event.stopPropagation();

        this.lastOpenedGroup = { dateStr, type };

        let typeName = 'การปฏิบัติงาน';
        if (type === 'vehicle') typeName = 'บันทึกการใช้รถ';
        if (type === 'prebook') typeName = 'Prebook (รอนุมัติ)';
        if (type === 'cancelled') typeName = 'รายการที่ยกเลิก';

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
            html += '<div class="p-3 text-center" style="color:var(--text-tertiary)">ไม่พบข้อมูล</div>';
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
                            <h6 class="mb-1" style="color:var(--accent-primary)">${escapeHtml(ev.label)}</h6>
                            <p class="mb-1 small" style="color: var(--color-ann-time, var(--text-secondary)) !important;"><i data-lucide="clock" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> เวลา: ${timeDisplay}</p>
                            <p class="mb-1 small" style="color: var(--color-ann-location, var(--text-secondary)) !important;"><i data-lucide="map-pin" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> สถานที่: ${escapeHtml(ev.location || '-')}</p>
                            <p class="mb-1 small" style="color: var(--color-ann-coop, var(--text-secondary)) !important;"><i data-lucide="users" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> สหกรณ์จังหวัดระยอง: ${escapeHtml(ev.coopParticipation || '-')}</p>
                            <p class="mb-1 small" style="color: var(--color-ann-group, var(--text-secondary)) !important;"><i data-lucide="layers" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> กลุ่มงาน: ${escapeHtml(ev.workGroup || '-')}</p>
                            <p class="mb-1 small" style="color: var(--color-ann-detail, var(--text-secondary)) !important;"><i data-lucide="file-text" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> รายละเอียด: ${escapeHtml(ev.detail || '-')}</p>
                            <hr style="border-color: var(--border-light); margin: 8px 0;">
                            <small class="d-block text-end fst-italic" style="font-size:0.7em;color:var(--text-tertiary)"><i data-lucide="user" style="width:10px;height:10px;display:inline;vertical-align:middle;" class="me-1"></i> ผู้สร้างโพสนี้: ${escapeHtml(ev.postedBy)}</small>
                        </div>
                    `;
                } else {
                    // Build quick-status buttons for admin
                    const isAdminView = AppState.isAdmin();
                    const currentStatus = ev.status || '';
                    const statusBadgeClass = currentStatus.toLowerCase() === 'pending' ? 'prebook' : currentStatus.toLowerCase();
                    const statusLabel = currentStatus === 'Pending' ? 'Prebook (รอดำเนินการ)' : escapeHtml(currentStatus);

                    // Status options
                    const allStatuses = [
                        { value: 'Pending',   label: 'Pending (รอดำเนินการ)',  cls: 'btn-warning' },
                        { value: 'Approved',  label: 'Approved (อนุมัติ)',     cls: 'btn-success' },
                        { value: 'Completed', label: 'Completed (เสร็จสิ้น)', cls: 'btn-info' },
                        { value: 'Cancelled', label: 'Cancelled (ยกเลิก)',     cls: 'btn-danger' },
                    ];

                    let quickStatusHtml = '';
                    if (isAdminView) {
                        // Encode ev to base64 to safely pass in onclick attribute
                        const evData = {
                            id: ev.id,
                            date: ev.date,
                            label: ev.label,
                            purpose: ev.purpose,
                            destination: ev.destination,
                            requestor: ev.requestor,
                            passengerCount: ev.passengerCount,
                            departureTime: ev.departureTime,
                            returnTime: ev.returnTime,
                            driver: ev.driver
                        };
                        const evB64 = btoa(encodeURIComponent(JSON.stringify(evData)));
                        
                        const items = allStatuses
                            .filter(s => s.value !== currentStatus)
                            .map(s => `<li><button class="dropdown-item d-flex align-items-center gap-2 py-2" onclick="VehicleLogs.quickUpdateStatus('${evB64}', '${s.value}')"><span class="status-indicator-dot bg-${s.value.toLowerCase()}"></span>${s.label}</button></li>`)
                            .join('');

                        quickStatusHtml = `
                            <div class="mt-2 d-flex align-items-center justify-content-between gap-2">
                                <div class="d-flex align-items-center gap-2">
                                    <small style="font-size:0.72em;color:var(--text-tertiary)"><i data-lucide="refresh-cw" style="width:10px;height:10px;display:inline;vertical-align:middle;" class="me-1"></i>เปลี่ยนสถานะ:</small>
                                    <div class="dropdown">
                                        <button class="btn btn-outline-custom btn-sm dropdown-toggle px-3" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="font-size:0.75em; padding: 3px 12px; border-radius: 20px;">
                                            เลือกเพื่อเปลี่ยนสถานะ
                                        </button>
                                        <ul class="dropdown-menu shadow-sm border-0 mt-1" style="font-size:0.85em; border-radius: 12px; overflow: hidden;">
                                            ${items}
                                        </ul>
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-sm px-3 d-flex align-items-center gap-1" onclick="VehicleLogs.showEdit('${ev.id}', true)" style="font-size:0.75em; padding: 3px 12px; border-radius: 20px;">
                                    <i data-lucide="pencil" style="width:12px;height:12px;"></i> แก้ไข
                                </button>
                            </div>`;
                    }

                    html += `
                        <div class="list-group-item bg-transparent border-bottom">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="mb-0" style="color:var(--accent-primary)">🚗 เลขทะเบียน : ${escapeHtml(ev.label)} <span class="${ev.driver === 'พนักงานขับรถลา' ? 'fw-bold' : 'fw-normal'}" style="font-size:0.85em;${ev.driver === 'พนักงานขับรถลา' ? 'color:var(--accent-danger);' : 'color:var(--text-tertiary);'}">(พนักงานขับรถ : ${escapeHtml(ev.driver || '-')})</span></h6>
                                <span class="badge-status badge-${statusBadgeClass}">${statusLabel}</span>
                            </div>
                            <p class="mb-1 small" style="color: var(--color-veh-requestor, var(--text-secondary)) !important;"><i data-lucide="user" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> ผู้ขอใช้รถ : ${escapeHtml(ev.requestor || '-')} <span class="ms-2"><i data-lucide="users" style="width:12px;height:12px;display:inline;vertical-align:middle;"></i> ${escapeHtml(ev.passengerCount || 1)} คน</span></p>
                            <div class="d-flex gap-3 mb-1 small">
                                <span style="color: var(--color-veh-departure, var(--text-secondary)) !important;"><i data-lucide="clock" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> เวลาไป : ${formatTime(ev.departureTime)}</span>
                                <span style="color: var(--color-veh-return, var(--text-secondary)) !important;"><i data-lucide="clock" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> เวลากลับ : ${formatTime(ev.returnTime)}</span>
                            </div>
                            <p class="mb-1 small" style="color: var(--color-veh-destination, var(--text-secondary)) !important;"><i data-lucide="map-pin" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> สถานที่ : ${escapeHtml(ev.destination || '-')}</p>
                            <p class="mb-0 small" style="color: var(--color-veh-purpose, var(--text-secondary)) !important;"><i data-lucide="target" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> เพื่อ : ${escapeHtml(ev.purpose || '-')}</p>
                            ${ev.status === 'Cancelled' ? `<p class="mt-2 mb-0 p-2 rounded small" style="background: var(--accent-danger-subtle); border-left: 3px solid var(--accent-danger); color: var(--accent-danger);"><i data-lucide="x-circle" style="width:12px;height:12px;display:inline;vertical-align:middle;" class="me-1"></i> <strong>เหตุผลที่ยกเลิก:</strong> ${escapeHtml(ev.cancelReason || 'ไม่ระบุ')}</p>` : ''}
                            ${quickStatusHtml}
                            <hr style="border-color: var(--border-light); margin: 8px 0;">
                            <small class="d-block text-end fst-italic" style="font-size:0.7em;color:var(--text-tertiary)"><i data-lucide="user" style="width:10px;height:10px;display:inline;vertical-align:middle;" class="me-1"></i> ผู้สร้างโพสนี้: ${escapeHtml(ev.postedBy || '-')}</small>
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
    document.getElementById('appSection').style.display = 'flex';

    const user = AppState.user;
    const authLink = document.getElementById('authMenuLink');

    if (user) {
        document.getElementById('userDisplayName').textContent = user.name;
        document.getElementById('userDisplayRole').textContent = user.role;
        document.getElementById('userAvatar').textContent = (user.name || 'U').charAt(0);
        document.getElementById('userAvatar').style.fontSize = '14px';

        // Auth button -> Logout
        authLink.className = 'btn-ghost';
        authLink.innerHTML = '<i data-lucide="log-out" style="width:16px;height:16px;"></i><span class="d-none d-md-inline">ออกจากระบบ</span>';

        document.querySelectorAll('.admin-only').forEach(el => {
            if (AppState.isAdmin()) {
                const tag = el.tagName.toLowerCase();
                const isInline = (tag === 'span' || tag === 'a' || tag === 'button');
                el.style.setProperty('display', isInline ? 'inline-flex' : 'flex', 'important');
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        document.querySelectorAll('.superadmin-only').forEach(el => {
            if (AppState.isSuperAdmin()) {
                el.style.setProperty('display', 'flex', 'important');
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });

        document.querySelectorAll('.auth-only').forEach(el => {
            el.style.setProperty('display', 'flex', 'important');
        });

        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) {
            if (AppState.isSuperAdmin()) {
                settingsMenu.classList.remove('d-none');
            } else {
                settingsMenu.classList.add('d-none');
            }
        }

    } else {
        document.getElementById('userDisplayName').textContent = 'ผู้เยี่ยมชม';
        document.getElementById('userDisplayRole').textContent = 'บุคคลทั่วไป';
        document.getElementById('userAvatar').innerHTML = '<i data-lucide="user" style="width:16px;height:16px;"></i>';
        document.getElementById('userAvatar').style.fontSize = '';

        authLink.className = 'btn-ghost';
        authLink.innerHTML = '<i data-lucide="log-in" style="width:16px;height:16px;"></i><span class="d-none d-md-inline">เข้าสู่ระบบ</span>';

        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        document.querySelectorAll('.superadmin-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        document.querySelectorAll('.auth-only').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });

        const settingsMenu = document.getElementById('settingsMenuLink');
        if (settingsMenu) settingsMenu.classList.add('d-none');
    }

    // Re-init icons after DOM update
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);

    const activePage = document.querySelector('.page-section.active-page');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        if (pageId === 'announcements') Announcements.render(AppState.announcements);
        if (pageId === 'vehicles') VehicleLogs.render(AppState.vehicleLogs);
        if (pageId === 'calendar') Calendar.load();
        if (pageId === 'logs') SystemLogs.load();
        if (pageId === 'dashboard') Dashboard.load();
    } else {
        navigateTo('calendar');
    }
}

/** Navigate between pages */
function navigateTo(page) {
    // Update nav links (both desktop and mobile)
    document.querySelectorAll('.topbar-nav-item').forEach(el => el.classList.remove('active'));
    const activeLinks = document.querySelectorAll(`[data-page="${page}"]`);
    activeLinks.forEach(el => el.classList.add('active'));

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

    // Close mobile nav
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) mobileNav.classList.remove('show');
}

/** Toggle mobile navigation drawer */
function toggleMobileNav() {
    const mobileNav = document.getElementById('mobileNav');
    if (mobileNav) mobileNav.classList.toggle('show');
}

/** Show toast notification */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const iconMap = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;
    toast.innerHTML = `<i data-lucide="${iconMap[type] || iconMap.info}" style="width:18px;height:18px;flex-shrink:0;"></i><span>${message}</span>`;
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
    el.textContent = (target || 0).toLocaleString();
}


/** Loading HTML */
function loadingHTML() {
    return `<tr><td colspan="10"><div class="loading-spinner"><div class="spinner-border"></div></div></td></tr>`;
}

/** Empty state HTML */
function emptyHTML(message) {
    return `<div class="empty-state"><i data-lucide="inbox" style="width:48px;height:48px;"></i><p>${message}</p></div>`;
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

// Theme removed — single light theme only

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
            if (v.Status === 'Approved') activeVeh++;
        });

        animateCounter('dashTotalAnn', announcements.length);
        animateCounter('dashTotalVeh', vehicles.length);
        animateCounter('dashActiveVeh', activeVeh);

        // Render Charts
        this.renderVehiclePieChart(vehicles);
        this.renderAnnBarChart(announcements);
        this.renderReqBarChart(vehicles);
        this.renderMonthlyTrendChart(announcements, vehicles);
    },

    renderVehiclePieChart(vehicles) {
        const ctx = document.getElementById('vehiclePieChart');
        if (!ctx) return;

        // Count by License
        const counts = {};
        vehicles.forEach(v => {
            const license = (v.CarLicense || 'ไม่ระบุ').trim().replace(/\s+/g, ' ');
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
                    backgroundColor: ['#d97757', '#5a7d6a', '#c9a96e', '#5a7d9a', '#c45c5c', '#8a7d6a'],
                    borderWidth: 0
                }]
            },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { font: { family: 'Inter' }, color: 'var(--text-primary)' } }
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
                    backgroundColor: '#d97757',
                    borderRadius: 6
                }]
            },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: 'Inter' }, color: 'var(--text-secondary)' } },
                    x: { ticks: { font: { family: 'Inter' }, color: 'var(--text-secondary)' } }
                }
            }
        });
    },

    renderReqBarChart(vehicles) {
        const ctx = document.getElementById('reqBarChart');
        if (!ctx) return;

        // Count by Requestor
        const counts = {};
        vehicles.forEach(v => {
            let requestor = (v.Requestor || v.requestor || 'ไม่ระบุ').trim();
            counts[requestor] = (counts[requestor] || 0) + 1;
        });

        // Sort by highest count
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5 requestors
        const labels = sorted.map(item => item[0]);
        const data = sorted.map(item => item[1]);

        if (this.charts.reqBar) this.charts.reqBar.destroy();

        this.charts.reqBar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'จำนวนการขอใช้รถ',
                    data: data,
                    backgroundColor: '#5a7d6a',
                    borderRadius: 6
                }]
            },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Inter' }, color: 'var(--text-secondary)' } },
                    y: { ticks: { font: { family: 'Inter' }, color: 'var(--text-secondary)' } }
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
                        borderColor: '#d97757',
                        backgroundColor: 'rgba(217, 119, 87, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'การใช้รถราชการ',
                        data: vehData,
                        borderColor: '#5a7d6a',
                        backgroundColor: 'rgba(90, 125, 106, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { font: { family: 'Inter' }, color: 'var(--text-primary)' } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: 'Inter' }, color: 'var(--text-secondary)' } },
                    x: { ticks: { font: { family: 'Inter' }, color: 'var(--text-secondary)' } }
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
        updateText('pt-requestor', (item.Requestor || item.requestor) + ` (จำนวน ${item.PassengerCount || 1} คน)`);
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

            let actionColor = 'var(--text-secondary)';
            if (item.Action === 'Add') actionColor = 'var(--accent-secondary)';
            else if (item.Action === 'Update') actionColor = 'var(--accent-tertiary)';
            else if (item.Action === 'Delete') actionColor = 'var(--accent-danger)';

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
