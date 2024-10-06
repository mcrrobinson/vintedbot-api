import sequelize from '../config/database';
import User from './user.model';

const db = {
  sequelize,
  User
};

export default db;
