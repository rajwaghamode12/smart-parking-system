
  let activeTab = 'home';
  let tabFloorFilter = 'all';
  let tabPM = 'UPI';
  let lastTabBooking = null;

  function showTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    
    const target = document.getElementById(`tab-${tabId}`);
    const navBtn = document.getElementById(`nav-${tabId}`);
    if (target) target.classList.add('active');
    if (navBtn) navBtn.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'map') renderTabMap();
    if (tabId === 'booking') populateTabSlots();
    if (tabId === 'admin') renderTabAdmin();
  }

  // MAP TAB LOGIC
  function switchTabFloor(flr, btn) {
    tabFloorFilter = flr;
    document.querySelectorAll('.floor-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTabMap();
  }

  function renderTabMap() {
    const container = document.getElementById('unifiedSlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    const zones = ['A', 'B', 'C', 'D'];
    zones.forEach(z => {
      const zoneSlots = parkingData.filter(s => s.zone === z);
      const floorName = zoneSlots[0].floor;
      if (tabFloorFilter !== 'all' && !floorName.toLowerCase().includes(tabFloorFilter.toLowerCase()) && !tabFloorFilter.toLowerCase().includes(floorName.toLowerCase())) return;

      const zoneCard = document.createElement('div');
      zoneCard.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:20px; padding:20px; margin-bottom:20px;';
      
      const header = document.createElement('div');
      header.className = 'flex-between';
      header.style.marginBottom = '14px';
      header.innerHTML = `<strong>Zone ${z} (${zoneSlots[0].floor})</strong> <span class="badge badge-purple">${zoneSlots.filter(s=>s.status==='free').length} Free</span>`;
      zoneCard.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'slots-grid';

      zoneSlots.forEach(slot => {
        const card = document.createElement('div');
        card.className = `slot-card ${slot.status}`;
        card.onclick = () => {
          if (slot.status === 'free') {
            showTab('booking');
            document.getElementById('uSlotSelect').value = slot.id;
            calcTabPrice();
          } else {
            showToast(`Slot ${slot.id} is currently ${slot.status.toUpperCase()}!`, 'info');
          }
        };

        let icon = slot.status === 'free' ? '🅿️' : '🚗';
        if (slot.type === 'ev') icon = '⚡';
        if (slot.type === 'handicap') icon = '♿';

        card.innerHTML = `
          <div class="slot-number">${slot.id}</div>
          <div class="slot-icon">${icon}</div>
          <div class="slot-type-badge">${slot.status.toUpperCase()}</div>
        `;
        grid.appendChild(card);
      });

      zoneCard.appendChild(grid);
      container.appendChild(zoneCard);
    });

    // Sidebar
    const freeC = parkingData.filter(s => s.status==='free').length;
    const occC = parkingData.filter(s => s.status==='occupied').length;
    const resC = parkingData.filter(s => s.status==='reserved').length;

    document.getElementById('uFree').textContent = freeC;
    document.getElementById('uOccupied').textContent = occC;
    document.getElementById('uReserved').textContent = resC;

    const rate = Math.round(((48 - freeC) / 48) * 100);
    document.getElementById('uRate').textContent = rate + '%';
    document.getElementById('uProgressFill').style.width = rate + '%';

    // Log Feed
    const feed = document.getElementById('uIotLogFeed');
    if (feed) feed.innerHTML = iotLogs.slice(0, 8).map(l => `<div>${l}</div>`).join('');
  }

  // BOOKING TAB LOGIC
  function populateTabSlots() {
    const select = document.getElementById('uSlotSelect');
    if (!select) return;
    select.innerHTML = '';

    const user = getCurrentUser();
    if (user) {
      if (user.name) document.getElementById('uDriverName').value = user.name;
      if (user.plate) document.getElementById('uVehicleNo').value = user.plate;
    }

    const free = parkingData.filter(s => s.status === 'free');
    if (free.length === 0) {
      select.innerHTML = '<option value="">No Free Slots Available</option>';
      return;
    }

    free.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `Slot ${s.id} (${s.floor} - ${s.type.toUpperCase()})`;
      select.appendChild(opt);
    });

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('uEntryTime').value = now.toISOString().slice(0, 16);

    calcTabPrice();
  }

  function selectTabPM(pm, el) {
    tabPM = pm;
    document.querySelectorAll('.u-pm').forEach(c => c.classList.remove('active'));
    if (el) el.classList.add('active');

    const upiView = document.getElementById('uUpiPaymentView');
    const cardView = document.getElementById('uCardPaymentView');
    const walletView = document.getElementById('uWalletPaymentView');

    if (upiView) upiView.style.display = pm === 'UPI' ? 'block' : 'none';
    if (cardView) cardView.style.display = pm === 'CARD' ? 'block' : 'none';
    if (walletView) walletView.style.display = pm === 'WALLET' ? 'block' : 'none';

    if (pm === 'WALLET') {
      const user = getCurrentUser();
      const bal = user ? user.walletBalance || 0 : 0;
      const balEl = document.getElementById('uPayWalletBal');
      if (balEl) balEl.textContent = `₹${bal}`;
      showToast(`Selected SmartPark Wallet (Balance: ₹${bal})`, 'info');
    } else if (pm === 'CARD') {
      showToast('Selected Credit / Debit Card Payment', 'info');
    } else if (pm === 'UPI') {
      showToast('Selected UPI / QR Payment Method', 'info');
      calcTabPrice();
    }
  }

  function calcTabPrice() {
    const slotEl = document.getElementById('uSlotSelect');
    if (!slotEl) return;
    const slotId = slotEl.value;
    const hours = parseInt(document.getElementById('uDurationHours').value) || 1;
    const info = getDynamicRateInfo(slotId);

    document.getElementById('uSurgeBadge').className = `badge ${info.surgeBadgeClass}`;
    document.getElementById('uSurgeBadge').textContent = info.surgeLabel;
    document.getElementById('uSurgeText').textContent = `System Occupancy: ${info.occupancyRatio}%`;

    document.getElementById('uSumSlot').textContent = slotId || 'N/A';
    document.getElementById('uSumRate').textContent = `₹${info.hourlyRate}/hr`;
    document.getElementById('uSumDur').textContent = `${hours} Hour${hours>1?'s':''}`;
    
    const total = (hours * info.hourlyRate) + 5;
    document.getElementById('uSumTotal').textContent = `₹${total}`;

    const canvas = document.getElementById('uPaymentCanvasQR');
    if (canvas && slotId) {
      renderCanvasQR('uPaymentCanvasQR', `upi://pay?pa=smartpark@okicici&pn=SmartPark&am=${total}&cu=INR`);
    }
  }

  async function handleTabBookingSubmit(e) {
    e.preventDefault();
    const driver = document.getElementById('uDriverName').value;
    const vehicle = document.getElementById('uVehicleNo').value.toUpperCase();
    const slotId = document.getElementById('uSlotSelect').value;
    const hours = parseInt(document.getElementById('uDurationHours').value);
    const entry = document.getElementById('uEntryTime').value;
    const phone = document.getElementById('uPhone').value;

    const info = getDynamicRateInfo(slotId);
    const totalAmount = (hours * info.hourlyRate) + 5;
    const bookingId = generateBookingId();

    const payload = {
      id: bookingId, driverName: driver, vehicleNo: vehicle, slotId, hours,
      entryTime: entry, phone, amount: totalAmount, paymentMethod: tabPM,
      timestamp: new Date().toISOString(), status: 'CONFIRMED'
    };

    const res = await MockAPI.createBooking(payload);
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }

    lastTabBooking = payload;
    showToast(`Booking ${bookingId} confirmed! ₹${totalAmount} paid via ${tabPM}`, 'success');

    document.getElementById('uTicketCard').style.display = 'block';
    document.getElementById('uTicketId').textContent = bookingId;
    document.getElementById('uTktVeh').textContent = vehicle;
    document.getElementById('uTktSlot').textContent = slotId;

    renderCanvasQR('uCanvasQR', generateQRData(bookingId));
    populateTabSlots();
  }

  function printUTicket() {
    if (lastTabBooking) exportBookingReceiptPDF(lastTabBooking);
  }

  // ADMIN TAB LOGIC
  function renderTabAdmin() {
    const tbody = document.getElementById('uAdminTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allBookings = JSON.parse(localStorage.getItem('sp_bookings') || '[]');
    const filter = document.getElementById('uAdminFilter') ? document.getElementById('uAdminFilter').value : 'all';

    let totalRev = 0;
    let totalCancelled = 0;
    let totalRefunded = 0;
    let totalActive = 0;

    allBookings.forEach(b => {
      const isCancelled = (b.bookingStatus === 'CANCELLED' || b.status === 'CANCELLED');
      if (isCancelled) {
        totalCancelled++;
        totalRefunded += (b.refundAmount || 0);
        totalRev += (b.amount - (b.refundAmount || 0));
      } else {
        totalActive++;
        totalRev += b.amount;
      }
    });

    let displayBookings = allBookings;
    if (filter !== 'all') {
      displayBookings = allBookings.filter(b => {
        const isCancelled = (b.bookingStatus === 'CANCELLED' || b.status === 'CANCELLED');
        const isExpired = (b.bookingStatus === 'EXPIRED' || b.status === 'EXPIRED');
        if (filter === 'CANCELLED') return isCancelled;
        if (filter === 'EXPIRED') return isExpired;
        return !isCancelled && !isExpired;
      });
    }

    if (displayBookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center; color:var(--text-muted);">No matching bookings found.</td></tr>`;
    } else {
      displayBookings.forEach(b => {
        const isCancelled = (b.bookingStatus === 'CANCELLED' || b.status === 'CANCELLED');
        const isExpired = (b.bookingStatus === 'EXPIRED' || b.status === 'EXPIRED');
        const isConfirmed = (!b.bookingStatus || b.bookingStatus === 'CONFIRMED') && !isCancelled && !isExpired;

        let statusBadge = `<span class="badge badge-green" style="font-size:0.7rem;">Confirmed</span>`;
        if (isCancelled) statusBadge = `<span class="badge badge-red" style="font-size:0.7rem;">Cancelled</span>`;
        else if (isExpired) statusBadge = `<span class="badge badge-yellow" style="font-size:0.7rem;">Expired</span>`;

        const refundText = isCancelled
          ? `<span style="color:var(--green-light); font-weight:bold;">₹${b.refundAmount || 0}</span>`
          : `<span style="color:var(--text-muted);">-</span>`;

        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
          <td style="font-family:monospace; color:var(--accent-light); padding:8px 4px;">${b.id}</td>
          <td>
            <div style="font-weight:600;">${b.driverName}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${b.vehicleNo}</div>
          </td>
          <td><span class="badge badge-purple">${b.slotId}</span></td>
          <td style="color:var(--green-light); font-weight:700;">₹${b.amount}</td>
          <td>${statusBadge}</td>
          <td>${refundText}</td>
          <td>
            <div class="flex gap-4">
              <button class="btn btn-ghost btn-sm" style="padding:2px 6px;" onclick='exportBookingReceiptPDF(${JSON.stringify(b)})' title="Export PDF">📥</button>
              ${isConfirmed ? `
                <button class="btn btn-warning btn-sm" style="padding:2px 6px; background:rgba(245,158,11,0.2); color:var(--yellow);" onclick="promptExtendBooking('${b.id}')" title="Extend Slot Duration">⏳</button>
                <button class="btn btn-danger btn-sm" style="padding:2px 6px;" onclick="adminCancelSlotTab('${b.id}')" title="Cancel & Refund">🚫</button>
                <button class="btn btn-ghost btn-sm" style="padding:2px 6px; font-size:0.7rem; color:var(--accent-light);" onclick="simulateBookingExpiry('${b.id}')" title="Test 15-Minute Expiry Alert">⚡ 15m</button>
              ` : ''}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    document.getElementById('uAdminRev').textContent = `₹${totalRev}`;
    document.getElementById('uAdminBookings').textContent = totalActive;
    document.getElementById('uAdminCancellations').textContent = totalCancelled;
    document.getElementById('uAdminRefunds').textContent = `₹${totalRefunded}`;

    renderTabApiLogs();
  }

  async function adminCancelSlotTab(bookingId) {
    if (confirm(`Admin Override: Cancel booking ${bookingId} and release slot immediately?`)) {
      const res = await MockAPI.cancelBooking(bookingId, true);
      if (res.success) {
        showToast(`Booking ${bookingId} cancelled! Slot ${res.slotId} released. Refund: ₹${res.refundAmount}`, 'success');
        renderTabAdmin();
      } else {
        showToast(res.error, 'error');
      }
    }
  }

  function renderTabApiLogs() {
    const feed = document.getElementById('uApiConsoleFeed');
    const badge = document.getElementById('uApiBadge');
    if (!feed) return;
    badge.textContent = `${apiLogs.length} Calls`;

    feed.innerHTML = apiLogs.map(l => {
      const col = l.status < 300 ? '#34d399' : '#f87171';
      return `<div style="border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:2px;"><span style="color:${col};">[${l.method} ${l.status}]</span> ${l.endpoint} <span style="color:#64748b;">(${l.latencyMs}ms)</span></div>`;
    }).join('');
  }

  function controlUGate(type, action) {
    const arm = document.getElementById(`u${type === 'entry' ? 'Entry' : 'Exit'}Arm`);
    const badge = document.getElementById(`u${type === 'entry' ? 'Entry' : 'Exit'}Badge`);

    if (action === 'open') {
      arm.classList.add('open');
      badge.textContent = 'OPEN';
      badge.className = 'badge badge-green';
      showToast(`${type.toUpperCase()} Gate Opened!`, 'success');
      logApiCall('POST', `/api/v1/gates/${type}/open`, 200, { state: 'OPEN' });
    } else {
      arm.classList.remove('open');
      badge.textContent = 'CLOSED';
      badge.className = 'badge badge-red';
      showToast(`${type.toUpperCase()} Gate Closed!`, 'info');
      logApiCall('POST', `/api/v1/gates/${type}/close`, 200, { state: 'CLOSED' });
    }
  }

  // Hero mini-grid
  const heroGrid = document.getElementById('heroSlotGrid');
  const heroSlots = [0,1,0,0, 1,0,0,1, 0,0,1,0];
  function buildHeroGrid() {
    if (!heroGrid) return;
    heroGrid.innerHTML = '';
    heroSlots.forEach((s,i) => {
      const d = document.createElement('div');
      d.className = 'mini-slot ' + (s===1?'occ':'free');
      heroGrid.appendChild(d);
    });
    document.getElementById('hpcFree').textContent = heroSlots.filter(s=>s===0).length;
    document.getElementById('hpcOccupied').textContent = heroSlots.filter(s=>s===1).length;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildHeroGrid();
    renderTabMap();
    populateTabSlots();
    renderTabAdmin();
    MockAPI.getSlots();
  });
