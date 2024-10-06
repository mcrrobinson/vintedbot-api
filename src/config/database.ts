import { Sequelize } from 'sequelize';

// no encryption
const sequelize = new Sequelize('postgres', 'postgres', 'axtgFHUm1hlxtacyZZAZhlW', {
  host: 'vintedbot.czockm2k8vjk.eu-west-2.rds.amazonaws.com', // Replace 'endpoint' with your actual host
  port: 5432,
  dialect: 'postgres',
  define: {
    timestamps: false, // Optional: Disable automatic timestamps if not needed
  },
  dialectOptions: {
    ssl: {
      require: false, // This is required if your PostgreSQL server mandates SSL connections
      rejectUnauthorized: false, // Set to true if you have a valid SSL certificate
    },
  },
});

export default sequelize;
