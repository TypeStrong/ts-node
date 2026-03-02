import carData from './car.json' assert { type: 'json' };

if (carData.color !== 'fuchsia') throw new Error('failed to import json');

const { default: dynamicCarData } = await import('./car.json', {
  assert: { type: 'json' },
});

if (dynamicCarData.doors !== 'open') throw new Error('failed to dynamically import json');

console.log(`A ${carData.color} car has ${carData.seats} seats and the doors are ${dynamicCarData.doors}.`);

// Test that omitting the assertion causes node to throw an error
await import('./car.json').then(
  () => {
    throw new Error('should have thrown');
  },
  (error: any) => {
    if (error.code !== 'ERR_IMPORT_ASSERTION_TYPE_MISSING') {
      throw error;
    }
    /* error is expected */
  }
);
console.log('Done!');
