<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-container">
        <div class="hero-badge">
          <span class="badge-icon">🌿</span>
          <span>Next-Generation Precision Agriculture</span>
        </div>
        <h1 class="hero-title">
          Grow Smarter. <span class="highlight">Harvest Healthier.</span>
        </h1>
        <p class="hero-subtitle">
          The all-in-one Smart Gardening System. Plan microclimate zones, prevent crop crowding with bed capacity algorithms, eliminate companion conflicts, and collaborate with team members seamlessly.
        </p>

        <div class="hero-cta-group">
          <router-link to="/dashboard" class="btn btn-primary btn-lg">
            🌱 Open Dashboard
          </router-link>
          <router-link to="/catalog" class="btn btn-outline btn-lg">
            📖 Browse Plant Catalog
          </router-link>
          <router-link to="/auth?mode=register" class="btn btn-secondary btn-lg">
            ✨ Create Free Account
          </router-link>
        </div>

        <div class="hero-metrics">
          <div class="metric-card">
            <span class="metric-value">32+</span>
            <span class="metric-label">Botanical Profiles</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">100%</span>
            <span class="metric-label">Precision Spacing</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">4 Roles</span>
            <span class="metric-label">Granular RBAC</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">0 Conflicting</span>
            <span class="metric-label">Companion Engine</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Three Main System Pillars -->
    <section class="pillars-section">
      <div class="section-header">
        <span class="section-tag">System Architecture</span>
        <h2 class="section-title">Designed for Modern Agricultural Precision</h2>
        <p class="section-desc">Experience three intuitive views tailored for gardeners, public visitors, and agricultural teams.</p>
      </div>

      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-icon">🏡</div>
          <h3>1. Interactive Landing Page</h3>
          <p>Public showcase presenting the platform capabilities, architecture guidelines, live telemetry statistics, and quick-start entry points.</p>
          <ul class="pillar-features">
            <li>✓ System overview & quick telemetry preview</li>
            <li>✓ Direct navigation to public & private views</li>
            <li>✓ Responsive layout designed for desktop and mobile</li>
          </ul>
        </div>

        <div class="pillar-card highlight-pillar">
          <div class="pillar-icon">📚</div>
          <h3>2. Public Reference Hub</h3>
          <p>Open access knowledge center with the complete 32-plant botanical catalog, invitation acceptance flow, and secure authentication portal.</p>
          <ul class="pillar-features">
            <li>✓ Searchable botanical catalog with sunlight & water filters</li>
            <li>✓ Granular plant spacing & companion synergy guidelines</li>
            <li>✓ Frictionless sign in, registration & secure password reset</li>
          </ul>
          <router-link to="/catalog" class="card-link">Explore Catalog &rarr;</router-link>
        </div>

        <div class="pillar-card">
          <div class="pillar-icon">📊</div>
          <h3>3. Private Operational Dashboard</h3>
          <p>Command center for authenticated gardeners to manage physical plots, microclimate zones, crop allocations, and team collaborators.</p>
          <ul class="pillar-features">
            <li>✓ Dynamic bed utilization gauge (% capacity)</li>
            <li>✓ Automated companion pairing & conflict advisor</li>
            <li>✓ Role-based access control (Owner, Admin, Member, Viewer)</li>
          </ul>
          <router-link to="/dashboard" class="card-link">Launch Dashboard &rarr;</router-link>
        </div>
      </div>
    </section>

    <!-- Core Feature Highlights -->
    <section class="features-section">
      <div class="section-header">
        <span class="section-tag">Feature Suite F1 – F5</span>
        <h2 class="section-title">Everything Needed to Cultivate Thriving Gardens</h2>
      </div>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feat-icon">🔐</div>
          <h4>F1: Accounts & Security</h4>
          <p>JWT-based stateless authentication with bcrypt password hashing, input validation, and password recovery workflows.</p>
        </div>

        <div class="feature-card">
          <div class="feat-icon">🛡️</div>
          <h4>F2: Role-Based Access Control</h4>
          <p>Granular 4-tier roles (Owner, Admin, Member, Viewer) with secure tokenized invitations and automated role enforcement.</p>
        </div>

        <div class="feature-card">
          <div class="feat-icon">📐</div>
          <h4>F3: Gardens & Microclimate Zones</h4>
          <p>Configure multiple physical locations with localized timezones, area dimensions, sun exposure, and soil types.</p>
        </div>

        <div class="feature-card">
          <div class="feat-icon">🌿</div>
          <h4>F4: Botanical Catalog & Reference</h4>
          <p>Pre-seeded reference library of 32 crops including tomatoes, basil, carrots, peppers, and lavender with environmental rules.</p>
        </div>

        <div class="feature-card">
          <div class="feat-icon">🌱</div>
          <h4>F5: Zone Crop Inventory</h4>
          <p>Track plant instances, crop quantities, bed area consumption, and live companion planting synergy scores.</p>
        </div>

        <div class="feature-card">
          <div class="feat-icon">⚡</div>
          <h4>Dual-Dialect Backend</h4>
          <p>Fastify REST API powered by SQLite in local development and MariaDB/MySQL in production with zero downtime migrations.</p>
        </div>
      </div>
    </section>

    <!-- Interactive Live Preview Section -->
    <section class="preview-section">
      <div class="preview-box">
        <div class="preview-info">
          <h3>Ready to start growing?</h3>
          <p>Explore the plant catalog or sign in to your dashboard to set up your first garden bed.</p>
        </div>
        <div class="preview-actions">
          <router-link to="/dashboard" class="btn btn-primary">Go to Dashboard</router-link>
          <router-link to="/catalog" class="btn btn-outline">Search Plant Catalog</router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'LandingView'
};
</script>

<style scoped>
.landing-page {
  display: flex;
  flex-direction: column;
  gap: 3.5rem;
  padding-bottom: 3rem;
}

.hero-section {
  background: linear-gradient(135deg, #1b4d24 0%, #2e7d32 50%, #388e3c 100%);
  color: white;
  border-radius: 20px;
  padding: 4rem 2.5rem;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(46, 125, 50, 0.25);
}

.hero-container {
  max-width: 900px;
  margin: 0 auto;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  padding: 0.4rem 1rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 1.25rem;
  letter-spacing: -0.02em;
}

.highlight {
  color: #a7f3d0;
}

.hero-subtitle {
  font-size: 1.15rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 2rem;
  max-width: 780px;
  margin-left: auto;
  margin-right: auto;
}

.hero-cta-group {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 3rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.25rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.btn-lg {
  padding: 0.85rem 1.75rem;
  font-size: 1.05rem;
}

.btn-primary {
  background-color: #10b981;
  color: #064e3b;
  font-weight: 700;
}

.btn-primary:hover {
  background-color: #34d399;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn-outline {
  background: transparent;
  color: white;
  border-color: rgba(255, 255, 255, 0.6);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: white;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: #a7f3d0;
}

.metric-label {
  font-size: 0.825rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Pillars Section */
.pillars-section, .features-section {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}

.section-tag {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #2e7d32;
  background: #e8f5e9;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  margin-bottom: 0.5rem;
}

.section-title {
  font-size: 2rem;
  font-weight: 800;
  color: #1a202c;
  margin: 0.25rem 0 0.75rem;
}

.section-desc {
  font-size: 1rem;
  color: #4a5568;
  line-height: 1.5;
}

.pillars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.pillar-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}

.pillar-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.highlight-pillar {
  border-color: #10b981;
  background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
  position: relative;
}

.pillar-icon {
  font-size: 2.25rem;
}

.pillar-card h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.pillar-card p {
  font-size: 0.925rem;
  color: #4a5568;
  line-height: 1.5;
  margin: 0;
}

.pillar-features {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #2d3748;
}

.card-link {
  margin-top: auto;
  font-weight: 700;
  color: #2e7d32;
  text-decoration: none;
  font-size: 0.95rem;
}

.card-link:hover {
  text-decoration: underline;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feat-icon {
  font-size: 1.75rem;
  margin-bottom: 0.25rem;
}

.feature-card h4 {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0;
}

.feature-card p {
  font-size: 0.875rem;
  color: #4a5568;
  line-height: 1.45;
  margin: 0;
}

/* Preview Box */
.preview-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  flex-wrap: wrap;
}

.preview-info h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 0.5rem;
}

.preview-info p {
  color: #4a5568;
  margin: 0;
}

.preview-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.preview-actions .btn-primary {
  background-color: #2e7d32;
  color: white;
}

.preview-actions .btn-primary:hover {
  background-color: #1b4d24;
}

.preview-actions .btn-outline {
  color: #2e7d32;
  border-color: #2e7d32;
}

.preview-actions .btn-outline:hover {
  background: #e8f5e9;
}
</style>
