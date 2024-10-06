import {
    DataTypes,
    Model,
    Optional
} from 'sequelize';
import sequelize from '../config/database';

interface SessionAttributes {
    id: number;
    user_id: number;
    refresh_token: string;
}

interface SessionCreationAttributes extends Optional < SessionAttributes, 'id' > {}

class Session extends Model < SessionAttributes, SessionCreationAttributes > implements SessionAttributes {
    public id!: number;
    public user_id!: number;
    public refresh_token!: string;
}

Session.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    refresh_token: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'Session'
});

export default Session;
