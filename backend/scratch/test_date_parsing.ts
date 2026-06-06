const val1 = '2026-06-03 02:35:03.961+00';
const parsed1 = new Date(val1 + '+00:00');
console.log('Value:', val1);
console.log('Parsed string:', val1 + '+00:00');
console.log('Date:', parsed1);
console.log('getTime():', parsed1.getTime());
console.log('isNaN:', Number.isNaN(parsed1.getTime()));
