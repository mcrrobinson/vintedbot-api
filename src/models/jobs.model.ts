import {DataTypes,Model,Optional} from 'sequelize';
import sequelize from '../config/database';

interface CronAttributes {
    id: number;
    alert_id: Number;
    schedule: string;
}

interface UserCreationAttributes extends Optional < CronAttributes, 'id' > {}

class Cron extends Model < CronAttributes, UserCreationAttributes > implements CronAttributes {
    public id!: number;
    public alert_id!: Number;
    public schedule!: string;

}

Cron.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    alert_id: {
        type: DataTypes.NUMBER,
        allowNull: false
    },
    schedule: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Cron'
});

export default Cron;

