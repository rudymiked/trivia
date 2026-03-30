#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const locationsPath = path.join(__dirname, '..', 'data', 'locations.json');

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function prettyType(type) {
  const map = {
    landmark: 'landmark',
    city: 'city',
    country: 'country',
    region: 'region',
    river: 'river',
    mountain: 'mountain range',
    lake: 'lake',
    desert: 'desert',
    island: 'island',
    ocean: 'sea',
  };

  return map[type] || type || 'location';
}

function buildQuestionTemplates(location) {
  const typeLabel = prettyType(location.type);
  const country = location.country;

  return {
    easy: [
      `Which ${typeLabel} is shown here in ${country}?`,
      `Name this ${typeLabel} located in ${country}.`,
      `What ${typeLabel} is marked on the map in ${country}?`,
    ],
    medium: [
      `Identify the ${typeLabel} at this location in ${country}.`,
      `Which ${typeLabel} does this map point to in ${country}?`,
      `What is the name of the ${typeLabel} shown here in ${country}?`,
    ],
    hard: [
      `Pinpoint the ${typeLabel} highlighted at this exact location in ${country}.`,
      `Which notable ${typeLabel} is being referenced here in ${country}?`,
      `What ${typeLabel} is represented by this exact spot in ${country}?`,
    ],
  };
}

function buildQuestionEntry(location, difficulty, clue) {
  const question = {
    clue,
    category: 'questions',
    type: 'trivia',
    difficulty,
    target: location.target,
    country: location.country,
    answer: location.clue,
  };

  if (location.bounds) {
    question.bounds = location.bounds;
  }

  return question;
}

function main() {
  const raw = fs.readFileSync(locationsPath, 'utf8');
  const data = JSON.parse(raw);
  const locations = data.locations;
  const sourceLocations = locations.filter((location) => location.category !== 'questions');

  const existingClues = new Set(
    locations
      .filter((location) => location.category === 'questions')
      .map((location) => normalize(location.clue))
  );

  const generated = [];

  for (const location of sourceLocations) {
    const templates = buildQuestionTemplates(location);

    for (const difficulty of ['easy', 'medium', 'hard']) {
      for (const clue of templates[difficulty]) {
        const normalizedClue = normalize(clue);
        if (existingClues.has(normalizedClue)) {
          continue;
        }

        existingClues.add(normalizedClue);
        generated.push(buildQuestionEntry(location, difficulty, clue));
      }
    }
  }

  data.locations.push(...generated);
  fs.writeFileSync(locationsPath, JSON.stringify(data, null, 2) + '\n');

  const questionLocations = data.locations.filter((location) => location.category === 'questions');
  const counts = questionLocations.reduce(
    (accumulator, location) => {
      accumulator[location.difficulty] += 1;
      return accumulator;
    },
    { easy: 0, medium: 0, hard: 0 }
  );

  console.log(`Generated ${generated.length} new question clues.`);
  console.log(`Questions totals -> easy=${counts.easy}, medium=${counts.medium}, hard=${counts.hard}`);
}

main();