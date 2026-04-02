/**
 * Seed script to populate locations in Azure Table Storage
 * Run this after setting up your Azure Table Storage to import locations from JSON
 *
 * Usage (local):
 *   npm run seed
 *
 * Usage (production with function key):
 *   API_URL=https://your-api.azurewebsites.net/api FUNCTION_KEY=your-key npm run seed
 *
 * Or via API:
 *   POST /api/manage/seed with the locations data and x-functions-key header
 */

const fs = require('fs');
const path = require('path');

async function seedLocations() {
  // Read locations from all continent JSON files and merge
  const continents = ['north-america', 'south-america', 'europe', 'middle-east', 'asia', 'oceania', 'africa'];
  const allLocations = continents.flatMap(continent => {
    const filePath = path.join(__dirname, '..', 'data', `locations-${continent}.json`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).locations;
  });
  const data = { locations: allLocations };

  // API URL - use environment variable or default to localhost
  const apiUrl = process.env.API_URL || 'http://localhost:7071/api';
  const functionKey = process.env.FUNCTION_KEY;

  console.log(`Seeding ${data.locations.length} locations to ${apiUrl}...`);

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Add function key if provided (for production Azure Functions)
    if (functionKey) {
      headers['x-functions-key'] = functionKey;
    }

    const url = `${apiUrl}/manage/seed`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    const text = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', text);

    if (response.ok && text) {
      const result = JSON.parse(text);
      console.log(`✓ Successfully seeded ${result.added} locations!`);
      process.exit(0);
    } else {
      console.error('✗ Failed to seed locations');
      console.error('Make sure the API is running and FUNCTION_KEY is set for production');
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Error seeding locations:', error.message);
    process.exit(1);
  }
}

seedLocations();
