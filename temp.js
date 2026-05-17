
    let allFeedbackData = [];
    const charts = {};

    const categoryMap = {
      'tech-output': ['output_volume', 'accuracy_quality', 'speed_velocity', 'process_adherence', 'testing_rigor'],
      'sol-arch': ['root_cause', 'scalability', 'edge_cases', 'maintainability', 'architectural_design'],
      'reliability': ['availability', 'follow_through', 'crisis_response', 'punctuality_attendance'],
      'growth': ['self_learning', 'feedback_loop', 'new_pocs', 'technology_adoption'],
      'presence': ['articulation', 'stakeholder_interaction', 'discussion_energy', 'reporting_transparency'],
      'assist': ['mentorship', 'knowledge_sharing', 'collaboration', 'onboarding_support']
    };

    const nameMap = {
      'output_volume': 'Output Volume', 'accuracy_quality': 'Accuracy/Quality', 'speed_velocity': 'Delivery Speed',
      'process_adherence': 'Process Adherence', 'testing_rigor': 'Testing Rigor', 'root_cause': 'Root Cause (RCA)',
      'scalability': 'Scalability', 'edge_cases': 'Edge-Cases', 'maintainability': 'Maintainability',
      'architectural_design': 'Architecture', 'availability': 'Availability', 'follow_through': 'Follow-Through',
      'crisis_response': 'Crisis Response', 'punctuality_attendance': 'Punctuality', 'self_learning': 'Self-Learning',
      'feedback_loop': 'Feedback Loop', 'new_pocs': 'Innovation (POCs)', 'technology_adoption': 'Tech Adoption',
      'articulation': 'Articulation', 'stakeholder_interaction': 'Stakeholders', 'discussion_energy': 'Energy/Drive',
      'reporting_transparency': 'Transparency', 'mentorship': 'Mentorship', 'knowledge_sharing': 'Knowledge Sharing',
      'collaboration': 'Collaboration', 'onboarding_support': 'Onboarding'
    };

    async function initAnalysis() {
      const email = localStorage.getItem('gantec_user_email');
      if (!email) {
        window.location.href = 'login.html';
        return;
      }
      
      const syncStatus = document.getElementById('sync-status');
      syncStatus.innerHTML = '🔄 Syncing with Feedback Portal...';
      
      try {
        const response = await fetch(`/api/feedback/data?email=${encodeURIComponent(email)}&t=${Date.now()}`, {
          headers: { 'Cache-Control': 'no-cache' }
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch data');
        }

        // Standardize data format: parse stringified selections if they exist
        allFeedbackData = (result.feedback || []).map(record => {
          if (typeof record.selections === 'string') {
            try { record.selections = JSON.parse(record.selections); } catch(e) { record.selections = {}; }
          }
          return record;
        });
        
        if (allFeedbackData.length === 0) {
          syncStatus.innerHTML = '⚠️ No feedback records found yet.';
          if (typeof showToast === 'function') showToast('No feedback records found yet.', 'warning');
          updateAnalysis(); // Call to draw empty charts
          return;
        }

        syncStatus.innerHTML = `✅ Last updated: ${new Date().toLocaleTimeString()}`;
        
        // Refresh the UI with the new data
        updateAnalysis();
        if (typeof showToast === 'function') showToast('Data Synced Successfully!', 'success');
      } catch (e) {
        console.error('Failed to load dashboard data:', e);
        syncStatus.innerHTML = '❌ Sync connection lost.';
        if (typeof showToast === 'function') showToast('Sync connection lost.', 'error');
      }
    }

    function updateAnalysis() {
      const year = document.getElementById('filter-year').value;
      const month = document.getElementById('filter-month').value;
      const role = document.getElementById('filter-role').value;

      // Filter all data for the selected year
      const yearData = allFeedbackData.filter(d => d.period.startsWith(year));

      // Trend data (Full year for the selected role only)
      const trendData = yearData.filter(d => d.role === role);

      // Specific Month Snapshot
      let snapshot = null;
      if (month) {
        snapshot = trendData.find(d => d.period === `${year}-${month}`);
      } else {
        // Smart Default: Latest month with ACTUAL data
        const withData = trendData.find(d => {
          const keys = Object.keys(d.selections || {}).filter(k => k !== '_remarks');
          return keys.length > 0;
        });
        snapshot = withData || trendData[0];
      }

      // Comparison Data for Radar (Always find both for the same month)
      const targetPeriod = snapshot ? snapshot.period : `${year}-${month || '01'}`;
      const userSnapshot = yearData.find(d => d.role === 'user' && d.period === targetPeriod);
      const adminSnapshot = yearData.find(d => d.role === 'admin' && d.period === targetPeriod);

      renderOverallTrend(trendData, snapshot ? snapshot.period : null);
      renderRadarProfile(userSnapshot, adminSnapshot);
      renderDrilldown(snapshot);
      updateAIInsight(trendData, snapshot);
    }

    function updateAIInsight(trend, selectedSnapshot) {
      const insightCard = document.getElementById('ai-insight-card');
      const insightText = document.getElementById('ai-insight-text');
      
      if (!selectedSnapshot || trend.length === 0) {
        insightCard.style.display = 'none';
        return;
      }

      insightCard.style.display = 'block';
      const currentAvg = calculateOverallAvg(selectedSnapshot);
      
      // If we are looking at a specific month, compare it to the PREVIOUS record in the trend
      const currentIndex = trend.findIndex(d => d.period === selectedSnapshot.period);
      if (currentIndex > 0) {
        const prev = trend[currentIndex - 1];
        const prevAvg = calculateOverallAvg(prev);
        const diff = currentAvg - prevAvg;
        const percent = Math.round((Math.abs(diff) / (prevAvg || 1)) * 100);
        
        if (diff > 0) {
          insightText.innerHTML = `<b>Month-over-Month Growth:</b> You improved by <b>${percent}%</b> compared to ${prev.period}. Great momentum!`;
        } else if (diff < 0) {
          insightText.innerHTML = `<b>Observation:</b> Your scores are down by <b>${percent}%</b> since ${prev.period}. Consider reviewing the growth metrics below.`;
        } else {
          insightText.innerHTML = `<b>Consistency:</b> Your performance in ${selectedSnapshot.period} is perfectly stable compared to your last record.`;
        }
      } else {
        // Fallback: Yearly view or first record
        const first = trend[0];
        const diff = currentAvg - calculateOverallAvg(first);
        if (diff > 0) {
          insightText.innerHTML = `You are performing <b>above</b> your yearly starting point. Keep pushing!`;
        } else {
          insightText.innerHTML = `Welcome to your performance hub! Start filling in your monthly feedback to see growth trends here.`;
        }
      }
    }

    function calculateOverallAvg(record) {
      if (!record || !record.selections) return 0;
      let selections = record.selections;
      if (typeof selections === 'string') {
        try { selections = JSON.parse(selections); } catch(e) { selections = {}; }
      }
      const vals = Object.values(selections).map(v => Number(v)).filter(v => !isNaN(v));
      return vals.length === 0 ? 0 : (vals.reduce((a, b) => a + b, 0) / vals.length) + 1;
    }

    // Search Logic
    document.getElementById('skill-search').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('#drilldown-grid > div');
      
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(term) ? 'block' : 'none';
      });
    });

    function calculateAverage(selections, rowIds) {
      if (!selections) return 0;
      if (typeof selections === 'string') {
        try { selections = JSON.parse(selections); } catch(e) { selections = {}; }
      }
      const vals = rowIds.map(id => Number(selections[id])).filter(v => !isNaN(v));
      if (vals.length === 0) return 0;
      return (vals.reduce((a, b) => a + b, 0) / vals.length) + 1; // 1-7 scale
    }

    function renderOverallTrend(data, highlightPeriod) {
      const ctx = document.getElementById('overallChart').getContext('2d');
      if (charts.overall) charts.overall.destroy();

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      // Create a 12-month data array
      const values = new Array(12).fill(null);
      const pointRadii = new Array(12).fill(4); // Small dots for all months by default
      const pointColors = new Array(12).fill('#e2e8f0'); // Light grey for empty months
      const pointBorderColors = new Array(12).fill('#f1f5f9');

      // Map existing data to the correct month index
      data.forEach(d => {
        const monthIndex = parseInt(d.period.split('-')[1]) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          values[monthIndex] = calculateOverallAvg(d);
          
          // Historical data points are Blue
          pointRadii[monthIndex] = 6;
          pointColors[monthIndex] = '#fff';
          pointBorderColors[monthIndex] = '#6366f1';

          // Highlight logic (Green)
          if (d.period === highlightPeriod) {
            pointRadii[monthIndex] = 10;
            pointColors[monthIndex] = '#10b981';
            pointBorderColors[monthIndex] = '#fff';
          }
        }
      });

      // Special case: if highlightPeriod is set but has no data, we still show the green dot on the baseline
      if (highlightPeriod) {
        const hMonthIndex = parseInt(highlightPeriod.split('-')[1]) - 1;
        if (values[hMonthIndex] === null) {
          values[hMonthIndex] = 1; // Show at baseline if no data
          pointRadii[hMonthIndex] = 10;
          pointColors[hMonthIndex] = '#10b981';
          pointBorderColors[hMonthIndex] = '#fff';
        }
      }

      charts.overall = new Chart(ctx, {
        type: 'line',
        data: {
          labels: monthNames,
          datasets: [{
            label: 'Performance Level',
            data: values,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 4,
            tension: 0.4,
            fill: true,
            pointRadius: pointRadii,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointBorderColors,
            pointBorderWidth: 3,
            spanGaps: true 
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 1, max: 7, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    function renderRadarProfile(userRecord, adminRecord) {
      const ctx = document.getElementById('radarChart').getContext('2d');
      if (charts.radar) charts.radar.destroy();

      const radarLabels = ['Delivery', 'Architecture', 'Reliability', 'Growth', 'Presence', 'Assist'];
      
      const userData = [
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['tech-output']),
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['sol-arch']),
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['reliability']),
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['growth']),
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['presence']),
        calculateAverage(userRecord ? userRecord.selections : {}, categoryMap['assist'])
      ];

      const adminData = [
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['tech-output']),
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['sol-arch']),
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['reliability']),
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['growth']),
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['presence']),
        calculateAverage(adminRecord ? adminRecord.selections : {}, categoryMap['assist'])
      ];

      charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: radarLabels,
          datasets: [
            {
              label: 'Self-Assessment',
              data: userData,
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              borderColor: '#6366f1',
              borderWidth: 2,
              pointBackgroundColor: '#6366f1'
            },
            {
              label: 'Manager Review',
              data: adminData,
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              borderColor: '#10b981',
              borderWidth: 2,
              pointBackgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: { min: 1, max: 7, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.05)' } }
          },
          plugins: { 
            legend: { 
              display: true, 
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10, weight: '600' } }
            } 
          }
        }
      });
    }

    function renderDrilldown(record) {
      const container = document.getElementById('drilldown-grid');
      container.innerHTML = '';
      
      const selections = record ? record.selections : {};
      
        // Always show ALL 26 parameters from the nameMap to make it look "Complete"
      Object.keys(nameMap).forEach(id => {
        const val = selections[id];
        const hasData = typeof val === 'number';
        
        const percentage = hasData ? ((val + 1) / 7) * 100 : 0;
        const color = hasData 
          ? (val >= 5 ? '#10b981' : (val >= 3 ? '#6366f1' : '#f59e0b'))
          : '#e2e8f0';
        
        const levelNames = ['Stagnant', 'Fluctuating', 'Steady', 'Proactive', 'High-Perf', 'Multiplier', 'Engine'];
        const levelLabel = hasData ? levelNames[val] : 'No Entry';

        const card = document.createElement('div');
        card.style.cssText = `padding: 16px; background: ${hasData ? 'var(--bg-light)' : '#f8fafc'}; border-radius: 12px; border: 1px solid ${hasData ? 'var(--border)' : '#f1f5f9'}; opacity: ${hasData ? '1' : '0.6'};`;
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 0.75rem; font-weight: 700; color: ${hasData ? 'var(--text-primary)' : '#94a3b8'};">${nameMap[id]}</span>
            <span style="font-size: 0.6rem; font-weight: 800; color: ${color}; text-transform: uppercase;">${levelLabel}</span>
          </div>
          <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${percentage}%; background: ${color}; transition: width 0.8s ease;"></div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    initAnalysis();
  