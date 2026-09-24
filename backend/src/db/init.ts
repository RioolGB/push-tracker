import { db, seedAdmin } from './index.js';

seedAdmin();
db.close();
console.log('Database initialised.');