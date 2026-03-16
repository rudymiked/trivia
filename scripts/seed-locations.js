/**
 * Seed script to populate locations in Azure Table Storage
 * Run this after setting up your Azure Table Storage to import locations from JSON
 *
 * Usage:
 *   node scripts/seed-locations.js
 *
 * Or via API:
 *   POST /api/admin/seed with the locations JSON
 */

const fs = require('fs');
const path = require('path');

async function seedLocations() {
  // Read locations from JSON file
  const locationsPath = path.join(__dirname, '..', 'data', 'locations.json');
  const data = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));

  // API URL - use environment variable or default to localhost
  const apiUrl = process.env.API_URL || 'http://localhost:7071/api';

  console.log(`Seeding ${data.locations.length} locations to ${apiUrl}...`);

  try {
    const response = await fetch(`${apiUrl}/manage/seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', text);

    if (response.ok && text) {
      const result = JSON.parse(text);
      console.log(`Successfully seeded ${result.added} locations!`);
    } else {
      console.error('Failed to seed locations');
    }
  } catch (error) {
    console.error('Error seeding locations:', error);
  }
}

seedLocations();
