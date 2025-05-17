// Server side js logic 
import * as helpers from './helpers.js';
import * as db from './db.js';
import cron from 'node-cron';

// Everyday at 4:00am : 
cron.schedule(
    '0 4 * * *',
    () => {
        console.log('Running scheduled task at 4:00 AM');
        // Replace with actual implementation if needed
    },
    {timezone : 'Asia/Kolkata'}
);

export { helpers, db };







