// jobManager.js
const cron = require('node-cron');

class JobManager {
    jobs: {
        [key: number]: any
    }
    constructor() {
        this.jobs = {};
    }

    // Schedule a new job
    scheduleJob(id:number, cronExpression: string, task:any) {
        if (this.jobs[id]) {
            throw new Error('Job ID already exists.');
        }

        // Schedule the job
        const job = cron.schedule(cronExpression, () => {
            try {
                task();
            } catch (error) {
                console.error(`Error in job ${id}:`, error);
            }
        });

        this.jobs[id] = job
    }

    // Cancel a job
    cancelJob(id:number) {
        if (this.jobs[id]) {
            try {
                this.jobs[id].stop();
            } catch {
                throw new Error('Error stopping job.');
            }
            delete this.jobs[id];

        } else {
            throw new Error('Job not found.');
        }
    }

    // Get all jobs
    getAllJobs() {
        return this.jobs;
    }
}

module.exports = new JobManager();
