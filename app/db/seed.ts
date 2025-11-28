import { db } from './index';
import { weightClasses } from './schema';

/**
 * Database seeding script
 * Run with: tsx app/db/seed.ts
 */

async function seed() {
  console.log('🌱 Starting database seed...');

  // Seed Weight Classes
  console.log('📦 Seeding weight classes...');
  
  const weightClassesData = [
    // Male weight classes (similar to UFC)
    { name: 'Flyweight', minWeight: '52.00', maxWeight: '57.00', gender: 'male', description: 'Up to 125 lbs (56.7 kg)' },
    { name: 'Bantamweight', minWeight: '57.01', maxWeight: '61.20', gender: 'male', description: '126-135 lbs (57.2-61.2 kg)' },
    { name: 'Featherweight', minWeight: '61.21', maxWeight: '65.80', gender: 'male', description: '136-145 lbs (61.7-65.8 kg)' },
    { name: 'Lightweight', minWeight: '65.81', maxWeight: '70.30', gender: 'male', description: '146-155 lbs (66.2-70.3 kg)' },
    { name: 'Welterweight', minWeight: '70.31', maxWeight: '77.10', gender: 'male', description: '156-170 lbs (70.8-77.1 kg)' },
    { name: 'Middleweight', minWeight: '77.11', maxWeight: '83.90', gender: 'male', description: '171-185 lbs (77.6-83.9 kg)' },
    { name: 'Light Heavyweight', minWeight: '83.91', maxWeight: '93.00', gender: 'male', description: '186-205 lbs (84.4-93.0 kg)' },
    { name: 'Heavyweight', minWeight: '93.01', maxWeight: '120.00', gender: 'male', description: '206-265 lbs (93.4-120.2 kg)' },
    
    // Female weight classes
    { name: 'Strawweight', minWeight: '48.00', maxWeight: '52.20', gender: 'female', description: 'Up to 115 lbs (52.2 kg)' },
    { name: 'Flyweight', minWeight: '52.21', maxWeight: '57.00', gender: 'female', description: '116-125 lbs (52.6-56.7 kg)' },
    { name: 'Bantamweight', minWeight: '57.01', maxWeight: '61.20', gender: 'female', description: '126-135 lbs (57.2-61.2 kg)' },
    { name: 'Featherweight', minWeight: '61.21', maxWeight: '65.80', gender: 'female', description: '136-145 lbs (61.7-65.8 kg)' },
  ] as const;

  await db.insert(weightClasses).values(weightClassesData);

  console.log(`✅ Seeded ${weightClassesData.length} weight classes`);
  console.log('🎉 Database seeding completed!');
  
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

