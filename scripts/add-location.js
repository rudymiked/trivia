#!/usr/bin/env node
/**
 * Interactive script to add new locations to locations.json
 * 
 * Usage:
 *   node scripts/add-location.js
 *   
 * Or provide args directly:
 *   node scripts/add-location.js --clue "Paris" --category places --type landmark --difficulty easy --lat 48.8566 --lng 2.3522 --country France
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const locationsPath = path.join(__dirname, '..', 'data', 'locations.json');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function main() {
  console.log('\n📍 Add New Location(s) to PinPoint\n');

  const data = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
  const addMore = true;
  let added = 0;

  while (addMore) {
    console.log(`\n--- New Location ${added + 1} ---`);

    const clue = await question('Clue/Name: ');
    if (!clue.trim()) {
      console.log('Cancelled. No clue entered.');
      break;
    }

    const category = await question('Category (places/questions/geography): ');
    if (!['places', 'questions', 'geography'].includes(category)) {
      console.log('Invalid category. Use: places, questions, or geography');
      continue;
    }

    let type = 'landmark';
    if (category === 'places') {
      type = await question(
        'Type (landmark/city/country) [landmark]: '
      );
      if (!type) type = 'landmark';
    } else if (category === 'questions') {
      type = 'trivia';
    } else if (category === 'geography') {
      type = await question(
        'Type (river/mountain/lake/desert/island/ocean/region) [region]: '
      );
      if (!type) type = 'region';
    }

    const difficulty = await question('Difficulty (easy/medium/hard): ');
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      console.log('Invalid difficulty. Use: easy, medium, or hard');
      continue;
    }

    const lat = parseFloat(await question('Latitude: '));
    const lng = parseFloat(await question('Longitude: '));
    const country = await question('Country: ');

    let answer = '';
    if (category === 'questions') {
      answer = await question('Answer: ');
    }

    const location = {
      clue,
      category,
      type,
      difficulty,
      target: { lat, lng },
      country,
    };

    if (answer) {
      location.answer = answer;
    }

    data.locations.push(location);
    added++;

    console.log(`✓ Added: ${clue}`);

    const more = await question('\nAdd another location? (y/n) [n]: ');
    if (!more.toLowerCase().startsWith('y')) {
      break;
    }
  }

  if (added > 0) {
    fs.writeFileSync(locationsPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`\n✓ Saved ${added} location(s) to data/locations.json`);
    console.log(`Total locations now: ${data.locations.length}`);
    console.log('\nNext steps:');
    console.log('  1. npm run seed (to seed locally)');
    console.log('  2. Push to GitHub to trigger the seed workflow');
  }

  rl.close();
}

main().catch(console.error);
